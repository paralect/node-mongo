const monk = require('monk');
const { EventEmitter } = require('events');

const MongoService = require('./MongoService');
const MongoQueryService = require('./MongoQueryService');
const idGenerator = require('./idGenerator');


const logger = global.logger || console;

/**
* Inits connection with mongodb, manage reconnects, create factory methods
*
* @return {Object} with a factory method {createService}, that creates a
* mongodb service
*/
const connect = (connectionString) => {
  // options docs: http://mongodb.github.io/node-mongodb-native/2.1/reference/connecting/connection-settings/
  const db = monk(connectionString, {
    connectTimeoutMS: 20000,
  });

  db.on('error-opening', (err) => {
    logger.error(err, 'Failed to connect to the mongodb on start');
    throw err;
  });

  db.on('open', () => {
    logger.info(`Connected to mongodb: ${connectionString}`);
  });

  db.on('close', (err) => {
    if (err) {
      logger.error(err, `Lost connection with mongodb: ${connectionString}`);
    } else {
      logger.warn(`Closed connection with mongodb: ${connectionString}`);
    }
  });

  db.on('connected', (err) => {
    if (err) {
      logger.error(err);
    } else {
      logger.info(`Connected to mongodb: ${connectionString}`);
    }
  });

  // Add factory methods to the database object
  db.createService = (collectionName, jsonSchema, options = {}) => {
    const opt = options;
    if (jsonSchema) {
      opt.jsonSchema = jsonSchema;
    }

    const collection = db.get(collectionName, { castIds: false });

    return new MongoService(collection, opt);
  };

  /**
   * @desc Add additional methods for mongo service
   * @param {string} name
   * @param {Function} method
   */
  db.setServiceMethod = (name, method) => {
    MongoService.prototype[name] = function customMethod(...args) {
      return method.apply(this, [this, ...args]);
    };
  };

  db.createQueryService = (collectionName, options = {}) => {
    const collection = db.get(collectionName, { castIds: false });

    return new MongoQueryService(collection, options);
  };

  /**
   * @desc Add additional methods for mongo query service
   * @param {string} name
   * @param {Function} method
   */
  db.setQueryServiceMethod = (name, method) => {
    MongoQueryService.prototype[name] = function customMethod(...args) {
      return method.apply(this, [this, ...args]);
    };
  };

  return db;
};

/* eslint-disable no-param-reassign */
const streamable = (collection, eventBus = new EventEmitter()) => {
  collection._bus = eventBus;

  collection.once = (eventName, handler) => {
    return collection._bus.once(eventName, handler);
  };

  collection.on = (eventName, handler) => {
    return collection._bus.on(eventName, handler);
  };

  collection.onPropertiesUpdated = (properties, callback) => {
    return collection.on('updated', (event) => {
      const updatedProperties = event.updateDescription
        ? event.updateDescription.updatedFields : {};
      const isChanged = Object.keys(updatedProperties).find(prop => properties.includes(prop));

      if (isChanged) {
        callback(event);
      }
    });
  };

  const watch = async (startAfter) => {
    await collection._collection.manager.executeWhenOpened();

    const changeStream = collection._collection.manager._db
      .collection(collection._collection.name)
      .watch({ fullDocument: 'updateLookup', startAfter });

    changeStream.on('change', async (event) => {
      switch (event.operationType) {
        case 'insert':
          return collection._bus.emit('created', event);
        case 'delete':
          return collection._bus.emit('removed', event);
        case 'replace':
          return collection._bus.emit('replaced', event);
        case 'update':
          return collection._bus.emit('updated', event);
        case 'invalidate': {
          watch(event._id);
          return collection._bus.emit('error', event);
        }
        default: // drop, rename, dropDatabase
          return collection._bus.emit('changed', event);
      }
    });
  };

  watch();

  return collection;
};
/* eslint-enable no-param-reassign */

module.exports.connect = connect;
module.exports.idGenerator = idGenerator;
module.exports.streamable = streamable;
