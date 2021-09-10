const { ObjectId } = require('mongodb');
const { EventEmitter } = require('events');
const _ = require('lodash');

const MongoQueryService = require('./mongo-query-service');
const MongoServiceError = require('./mongo-service-error');

const defaultOptions = {
  addCreatedOnField: true,
  addUpdatedOnField: true,
  useStringId: true,
  validate: undefined,
  emitter: undefined,
};

class MongoService extends MongoQueryService {
  constructor(collection, options = {}, client) {
    super(collection, options, client);

    _.defaults(this._options, defaultOptions);

    this._bus = this._options.emitter || new EventEmitter();

    this.generateId = () => (new ObjectId()).toHexString();

    this.atomic = {
      bulkWrite: collection.bulkWrite,
      createIndex: collection.createIndex,
      drop: collection.drop,
      dropIndex: collection.dropIndex,
      dropIndexes: collection.dropIndexes,
      findOneAndDelete: collection.findOneAndDelete,
      findOneAndUpdate: collection.findOneAndUpdate,
      insert: collection.insertOne,
      remove: collection.deleteOne,
      update: collection.updateOne,
    };
    this.atomic.bulkWrite = collection.bulkWrite.bind(collection);
    this.atomic.createIndex = collection.createIndex.bind(collection);
    this.atomic.drop = collection.drop.bind(collection);
    this.atomic.dropIndex = collection.dropIndex.bind(collection);
    this.atomic.dropIndexes = collection.dropIndexes.bind(collection);
    this.atomic.findOneAndDelete = collection.findOneAndDelete.bind(collection);
    this.atomic.findOneAndUpdate = collection.findOneAndUpdate.bind(collection);
    this.atomic.insert = collection.insertOne.bind(collection);
    this.atomic.remove = collection.deleteOne.bind(collection);
    this.atomic.update = collection.updateOne.bind(collection);
  }

  static _deepCompare(data, initialData, properties) {
    let changed = false;

    if (Array.isArray(properties)) {
      changed = _.find(properties, (prop) => {
        const value = _.get(data, prop);
        const initialValue = _.get(initialData, prop);

        return !_.isEqual(value, initialValue);
      }) !== undefined;
    } else {
      Object.keys(properties).forEach((prop) => {
        if (changed) return;

        const value = _.get(data, prop);
        const initialValue = _.get(initialData, prop);

        if (_.isEqual(value, properties[prop]) && !_.isEqual(initialValue, properties[prop])) {
          changed = true;
        }
      });
    }

    return changed;
  }

  async _validate(entity) {
    if (this._options.validate) {
      const { value, error } = await this._options.validate(entity);

      if (error) {
        throw new MongoServiceError(
          MongoServiceError.INVALID_SCHEMA,
          `Document schema is invalid: ${JSON.stringify(error)}`,
          error,
        );
      }

      return value;
    }

    return entity;
  }

  emit(eventName, event) {
    return this._bus.emit(eventName, event);
  }

  once(eventName, handler) {
    return this._bus.once(eventName, handler);
  }

  on(eventName, handler) {
    return this._bus.on(eventName, handler);
  }

  onPropertiesUpdated(properties, handler) {
    return this.on('updated', (event) => {
      const isChanged = MongoService._deepCompare(event.doc, event.prevDoc, properties);
      if (isChanged) handler(event);
    });
  }

  async create(objs, options = {}) {
    const entities = _.isArray(objs) ? objs : [objs];

    const created = await Promise.all(entities.map(async (doc) => {
      const entity = _.cloneDeep(doc);

      if (this._options.useStringId && !entity._id) entity._id = this.generateId();
      if (this._options.addCreatedOnField && !entity.createdOn) {
        entity.createdOn = new Date().toISOString();
      }
      const validated = await this._validate(entity);

      return validated;
    }));

    const createCallback = (doc) => {
      this._bus.emit('created', {
        doc,
      });
    };

    await this._collection.insertMany(created, options, createCallback);

    return created.length > 1 ? created : created[0];
  }

  async updateOne(query, updateFn, options = {}) {
    if (!_.isFunction(updateFn)) {
      throw new MongoServiceError(
        MongoServiceError.INVALID_ARGUMENT,
        `updateOne: second argument is invalid. Expected a function but got ${typeof updateFn}`,
      );
    }

    const findOptions = {};
    if (options.session) findOptions.session = options.session;
    const doc = await this.findOne(query, findOptions);
    if (!doc) {
      throw new MongoServiceError(
        MongoServiceError.NOT_FOUND,
        `updateOne: document not found. Query: ${JSON.stringify(query)}`,
      );
    }

    let entity = _.cloneDeep(doc);

    if (this._options.addUpdatedOnField) entity.updatedOn = new Date().toISOString();
    entity = await updateFn(entity);
    const updated = await this._validate(entity);

    const updateCallback = () => {
      this._bus.emit('updated', {
        doc: updated,
        prevDoc: doc,
      });
    };

    await this._collection.updateOne(
      { ...query, _id: doc._id },
      { $set: updated },
      options,
      updateCallback,
    );

    return updated;
  }

  async updateMany(query, updateFn, options = {}) {
    if (!_.isFunction(updateFn)) {
      throw new MongoServiceError(
        MongoServiceError.INVALID_ARGUMENT,
        `updateMany: second argument is invalid. Expected a function but got ${typeof updateFn}`,
      );
    }

    const findOptions = {};
    if (options.session) findOptions.session = options.session;
    const { results } = await this.find(query, findOptions);
    const docs = await results.toArray();
    if (docs.length === 0) return [];

    const updated = await Promise.all(docs.map(async (doc) => {
      let entity = _.cloneDeep(doc);

      if (this._options.addUpdatedOnField) entity.updatedOn = new Date().toISOString();
      entity = await updateFn(entity);
      const validated = await this._validate(entity);

      return validated;
    }));

    const updateCallback = (doc) => {
      this._bus.emit('updated', {
        doc,
        prevDoc: docs.find((d) => d._id === doc._id),
      });
    };

    await this._collection.updateMany(
      { ...query, _id: { $in: updated.map((doc) => doc._id) } },
      updateFn,
      options,
      updateCallback,
    );

    return updated;
  }

  async remove(query, options = {}) {
    const findOptions = {};
    if (options.session) findOptions.session = options.session;

    const deleteCallback = (doc) => {
      this._bus.emit('removed', {
        doc,
      });
    };
    const removed = await this._collection.deleteMany(query, options, deleteCallback);

    return removed;
  }

  async performTransaction(transactionFn, options = {}) {
    if (!_.isFunction(transactionFn)) {
      throw new MongoServiceError(
        MongoServiceError.INVALID_ARGUMENT,
        `performTransaction: first argument is invalid. Expected a function but got ${typeof transactionFn}`,
      );
    }

    const session = this._client.startSession(options);

    try {
      await session.withTransaction(() => transactionFn(session));
    } finally {
      session.endSession();
    }
  }
}

module.exports = MongoService;
