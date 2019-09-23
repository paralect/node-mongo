const _ = require('lodash');
const { EventEmitter } = require('events');

const MongoQueryService = require('./MongoQueryService');
const idGenerator = require('./idGenerator');
const MongoServiceError = require('./MongoServiceError');


const { logger } = global;

const defaultOptions = {
  addCreatedOnField: true,
  addUpdatedOnField: true,
  useStringId: true,
};

class MongoService extends MongoQueryService {
  constructor(collection, options = {}, db, eventBus = new EventEmitter()) {
    super(collection, options);

    _.defaults(this._options, defaultOptions);

    this._bus = eventBus;
    this.logger = logger;

    const setSchemaAndWatch = (_db, startAfter) => {
      _db.createCollection(collection.name, {
        validator: this._options.jsonSchema,
      }, () => {
        _db.command({
          collMod: collection.name,
          validator: this._options.jsonSchema,
        });
      });

      const changeStream = _db.collection(collection.name).watch({
        fullDocument: 'updateLookup',
        startAfter,
      });

      changeStream.on('change', async (event) => {
        switch (event.operationType) {
          case 'insert':
            return this._bus.emit('created', event);
          case 'delete':
            return this._bus.emit('removed', event);
          case 'replace':
            return this._bus.emit('replaced', event);
          case 'update':
            return this._bus.emit('updated', event);
          case 'invalidate': {
            setSchemaAndWatch(_db, event._id);
            return this._bus.emit('error', event);
          }
          default: // drop, rename, dropDatabase
            return this._bus.emit('changed', event);
        }
      });
    };

    // collection doesn't contain _db immediately
    db.on('open', _db => setSchemaAndWatch(_db));
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

  static _getUpdateQuery(query = {}) {
    let updateQuery = _.cloneDeep(query);

    if (this._options.useStringId && !(query.$set || {})._id) {
      updateQuery = {
        ...updateQuery,
        $setOnInsert: { _id: idGenerator.generate(), ...(updateQuery.$setOnInsert || {}) },
      };
    }

    if (this._options.addCreatedOnField && !(query.$set || {}).createdOn) {
      updateQuery = {
        ...updateQuery,
        $setOnInsert: { createdOn: new Date(), ...(updateQuery.$setOnInsert || {}) },
      };
    }

    if (this._options.addUpdatedOnField && !(query.$set || {}).updatedOn) {
      updateQuery = {
        ...updateQuery,
        $setOnInsert: { updatedOn: new Date(), ...(updateQuery.$setOnInsert || {}) },
      };
    }

    return updateQuery;
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
    let entities = objs;
    if (!_.isArray(entities)) {
      entities = [entities];
    }

    entities.forEach((item) => {
      const entity = item;
      if (this._options.useStringId && !entity._id) {
        entity._id = idGenerator.generate();
      }

      if (this._options.addCreatedOnField && !entity.createdOn) {
        entity.createdOn = new Date();
      }
    });

    await this._collection.insert(entities, options);

    return entities.length > 1 ? entities : entities[0];
  }

  /**
  * Modifies entity found by query in the database
  * Sets updatedOn to the current date
  *
  * @param query {Object} - mongo search query
  * @param updateFn {function(doc)} - function, that recieves document to be updated
  * @return {Object} Updated object
  */
  async updateWithFunction(query, updateFn) {
    if (!_.isFunction(updateFn)) {
      throw new Error('updateFn must be a function');
    }

    await this._collection.manager.executeWhenOpened();

    const session = this._collection.manager._client.startSession({});

    let doc;
    await session.withTransaction(async () => {
      doc = await this.findOne(query, { session });
      if (!doc) {
        throw new MongoServiceError(
          MongoServiceError.NOT_FOUND,
          `Document not found while updating. Query: ${JSON.stringify(query)}`,
        );
      }

      updateFn(doc);

      if (this._options.addUpdatedOnField && !doc.updatedOn) {
        doc.updatedOn = new Date();
      }

      await this._collection.update({ _id: doc._id }, { $set: { ...doc } }, { session });
    });

    return doc;
  }

  async performTransaction(transactionFn, options = {}) {
    if (!_.isFunction(transactionFn)) {
      throw new Error('transactionFn must be a function');
    }

    await this._collection.manager.executeWhenOpened();

    const session = this._collection.manager._client.startSession(options);

    return session.withTransaction(() => transactionFn(session));
  }

  update(query, update, options = {}) {
    const updateQuery = MongoService._getUpdateQuery(update);
    return this._collection.update(query, updateQuery, options);
  }

  findOneAndUpdate(query, update, options = {}) {
    const updateQuery = MongoService._getUpdateQuery(update);
    return this._collection.findOneAndUpdate(query, updateQuery, options);
  }

  /**
  * Remove one or many documents found by query
  *
  * @param query {Object} - mongodb search query
  * @param options {Object} - mongodb search query
  */
  remove(query, options = {}) {
    return this._collection.remove(query, options);
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

  /**
   * Check updateDescription from 'updated' event. When
   * something changed - executes callback
   *
   * @param {Array} properties - see deepCompare
   * @param {Function} callback - executes callback if something changed
   */
  onPropertiesUpdated(properties, callback) {
    return this.on('updated', (event) => {
      const updatedProperties = event.updateDescription
        ? event.updateDescription.updatedFields : {};
      const isChanged = Object.keys(updatedProperties).find(prop => properties.includes(prop));

      if (isChanged) {
        callback(event);
      }
    });
  }
}

module.exports = MongoService;
