const { EventEmitter } = require('events');
const _ = require('lodash');

const MongoQueryService = require('./MongoQueryService');
const idGenerator = require('./idGenerator');
const MongoServiceError = require('./MongoServiceError');


const { logger = console } = global;

const defaultOptions = {
  addCreatedOnField: true,
  addUpdatedOnField: true,
  useStringId: true,
  validateSchema: undefined,
};

class MongoService extends MongoQueryService {
  constructor(collection, options = {}, eventBus = new EventEmitter()) {
    super(collection, options);

    _.defaults(this._options, defaultOptions);

    this.logger = logger;
    this._bus = eventBus;
    this.atomic = {
      insert: (query, insertOptions = {}) => {
        return collection.insert(query, insertOptions);
      },
      update: (query, updateQuery, updateOptions = {}) => {
        return collection.update(query, updateQuery, updateOptions);
      },
      findOneAndUpdate: (query, updateQuery, updateOptions = {}) => {
        return collection.findOneAndUpdate(query, updateQuery, updateOptions);
      },
      remove: (query, removeOptions = {}) => {
        return collection.remove(query, removeOptions);
      },
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

  /**
   * Deep compare data & initialData. When
   * something changed - executes callback
   *
   * @param  {Array|Object} properties
   * 1) Array of properties to compare. For example: ['user.firstName', 'companyId']
   * 2) Object of properties {'user.firstName': 'John'} - will check if property changed and equal
   * to 'John' in updated document.
   * Note: . (dot) is used to compare deeply nested properties
   * @return {Boolean} - indicates if something has changed
   */
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

  _validateSchema(entity) {
    if (this._options.validateSchema) {
      const { value, error } = this._options.validateSchema(entity);

      if (error) {
        logger.error('Schema invalid', JSON.stringify(error.details, 0, 4));

        throw new MongoServiceError(
          MongoServiceError.INVALID_SCHEMA,
          `Document schema is invalid: ${JSON.stringify(error.details)}`,
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

  /**
  * Subscribe to database change events only once. The first time evenName
  * is triggered listener handler is removed and then invoked
  */
  once(eventName, handler) {
    return this._bus.once(eventName, handler);
  }

  /**
  * Subscribe to database change events.
  */
  on(eventName, handler) {
    return this._bus.on(eventName, handler);
  }

  /**
   * Deep compare doc & prevDoc from 'updated' event. When
   * something changed - executes handler
   *
   * @param  {Array|Object} properties - see deepCompare
   * @param  {Function} handler - executes handler if something changed
   */
  onPropertiesUpdated(properties, handler) {
    return this.on('updated', (event) => {
      const isChanged = MongoService._deepCompare(event.doc, event.prevDoc, properties);
      if (isChanged) handler(event);
    });
  }

  /**
  * Insert one object or array of the objects to the database
  * Sets createdOn to the current date
  *
  * @param {array | object} Object or array of objects to create
  * @param {object} Object of options
  * @return {array | object} Object or array of created objects
  */
  async create(objs, options = {}) {
    const entities = _.isArray(objs) ? objs : [objs];

    const created = await Promise.all(entities.map(async (doc) => {
      const entity = _.cloneDeep(doc);

      if (this._options.useStringId && !entity._id) entity._id = idGenerator.generate();
      if (this._options.addCreatedOnField && !entity.createdOn) entity.createdOn = new Date();
      const validated = await this._validateSchema(entity);

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

  /**
  * Modifies entity found by query in the database
  * Sets updatedOn to the current date
  *
  * @param query {Object} - mongo search query
  * @param updateFn {function(doc)} - function, that recieves document to be updated
  * @return {Object} Updated object
  */
  async update(query, updateFn, options = {}) {
    if (!_.isFunction(updateFn)) {
      throw new Error('updateFn must be a function');
    }

    const findOptions = {};
    if (options.session) findOptions.session = options.session;
    const { results: docs } = await this.find(query, findOptions);
    if (!docs.length) {
      throw new MongoServiceError(
        MongoServiceError.NOT_FOUND,
        `Documents not found while updating. Query: ${JSON.stringify(query)}`,
      );
    }

    const updated = await Promise.all(docs.map(async (doc, index) => {
      let entity = _.cloneDeep(doc);

      if (this._options.addUpdatedOnField) entity.updatedOn = new Date();
      entity = await updateFn(entity, index, docs);
      const validated = await this._validateSchema(entity);

      return validated;
    }));

    await Promise.all(updated.map((doc) => {
      return this._collection.update({ ...query, _id: doc._id }, { $set: doc }, options);
    }));

    updated.forEach((doc, index) => {
      this._bus.emit('updated', {
        doc,
        prevDoc: docs[index],
      });
    });

    return updated.length > 1 ? updated : updated[0];
  }

  /**
  * Remove one or many documents found by query
  *
  * @param query {Object} - mongodb search query
  * @param options {Object} - mongodb search query
  */
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
      throw new Error('transactionFn must be a function');
    }

    await this._collection.manager.executeWhenOpened();

    const session = this._collection.manager._client.startSession(options);

    return session.withTransaction(() => transactionFn(session));
  }

  /**
  * Create or check index existence, omits error
  *
  * @param index {Object} - index to be created
  * @param options {Object} - index options
  */
  createIndex(index, options = {}) {
    return this._collection.createIndex(index, options)
      .catch((err) => {
        this.logger.warn(err);
      });
  }
}

module.exports = MongoService;
