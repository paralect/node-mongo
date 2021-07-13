const monk = require('monk');
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
  constructor(collection, options = {}) {
    super(collection, options);

    _.defaults(this._options, defaultOptions);

    this._bus = this._options.emitter || new EventEmitter();

    this.generateId = () => monk.id().toHexString();

    this.atomic = {
      bulkWrite: collection.bulkWrite,
      createIndex: collection.createIndex,
      drop: collection.drop,
      dropIndex: collection.dropIndex,
      dropIndexes: collection.dropIndexes,
      findOneAndDelete: collection.findOneAndDelete,
      findOneAndUpdate: collection.findOneAndUpdate,
      insert: collection.insert,
      remove: collection.remove,
      update: collection.update,
    };

    collection.manager.executeWhenOpened()
      .then(async () => {
        await collection.manager._db.command({ create: collection.name });
      })
      .catch((error) => {
        // a collection already exists
        if (error.code !== 48) {
          throw error;
        }
      });
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

    await this._collection.insert(created, options);

    created.forEach((doc) => {
      this._bus.emit('created', {
        doc,
      });
    });

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

    await this._collection.update(
      { ...query, _id: doc._id },
      updated,
      { ...options, replaceOne: true },
    );

    this._bus.emit('updated', {
      doc: updated,
      prevDoc: doc,
    });

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
    const { results: docs } = await this.find(query, findOptions);
    if (docs.length === 0) return [];

    const updated = await Promise.all(docs.map(async (doc) => {
      let entity = _.cloneDeep(doc);

      if (this._options.addUpdatedOnField) entity.updatedOn = new Date().toISOString();
      entity = await updateFn(entity);
      const validated = await this._validate(entity);

      return validated;
    }));

    const updatePromises = updated.map((doc) => this._collection.update(
      { ...query, _id: doc._id },
      doc,
      { ...options, replaceOne: true },
    ));

    await Promise.all(updatePromises);

    updated.forEach((doc, index) => {
      this._bus.emit('updated', {
        doc,
        prevDoc: docs[index],
      });
    });

    return updated;
  }

  async remove(query, options = {}) {
    const findOptions = {};
    if (options.session) findOptions.session = options.session;
    const removed = await this.find(query, findOptions);
    await this._collection.remove(query, options);

    removed.results.forEach((doc) => {
      this._bus.emit('removed', {
        doc,
      });
    });

    return removed;
  }

  async performTransaction(transactionFn, options = {}) {
    if (!_.isFunction(transactionFn)) {
      throw new MongoServiceError(
        MongoServiceError.INVALID_ARGUMENT,
        `performTransaction: first argument is invalid. Expected a function but got ${typeof transactionFn}`,
      );
    }

    await this._collection.manager.executeWhenOpened();

    const session = this._collection.manager._client.startSession(options);

    try {
      await session.withTransaction(transactionFn);
    } catch (error) {
      session.endSession();
      throw error;
    }
  }
}

module.exports = MongoService;
