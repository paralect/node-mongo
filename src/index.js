const monk = require('monk');
const { EventEmitter } = require('events');
const _ = require('lodash');

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
const connect = (connectionString, settings) => {
  const connectionSettings = _.defaults({}, settings, { connectTimeoutMS: 20000 });
  const db = monk(connectionString, connectionSettings);

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
  db.createService = (collectionName, options = {}, eventBus = new EventEmitter()) => {
    const collection = db.get(collectionName, { castIds: false });

    return new MongoService(collection, options, eventBus);
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

  db.createQueryService = (collectionName, options = {}, eventBus = new EventEmitter()) => {
    const collection = db.get(collectionName, { castIds: false });

    return new MongoQueryService(collection, options, eventBus);
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

module.exports.connect = connect;
module.exports.idGenerator = idGenerator;
