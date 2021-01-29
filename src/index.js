const monk = require('monk');
const _ = require('lodash');

const MongoService = require('./mongo-service');
const MongoQueryService = require('./mongo-query-service');

const logger = global.logger || console;

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

  db.createService = (collectionName, options = {}) => {
    const collection = db.get(collectionName, { castIds: false });

    return new MongoService(collection, options);
  };

  db.setServiceMethod = (name, method) => {
    MongoService.prototype[name] = function customMethod(...args) {
      return method.apply(this, [this, ...args]);
    };
  };

  db.createQueryService = (collectionName, options = {}) => {
    const collection = db.get(collectionName, { castIds: false });

    return new MongoQueryService(collection, options);
  };

  db.setQueryServiceMethod = (name, method) => {
    MongoQueryService.prototype[name] = function customMethod(...args) {
      return method.apply(this, [this, ...args]);
    };
  };

  return db;
};

module.exports.connect = connect;
