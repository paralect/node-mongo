const { MongoClient } = require('mongodb');
const _ = require('lodash');

const MongoService = require('./mongo-service');
const MongoQueryService = require('./mongo-query-service');

const logger = global.logger || console;

const connect = async (connectionString, settings) => {
  const connectionSettings = _.defaults({}, settings, { connectTimeoutMS: 20000 });
  const client = new MongoClient(connectionString, connectionSettings);
  await client.connect();
  const db = client.db();

  client.on('error', (err) => {
    logger.error(err, 'Failed to connect to the mongodb on start');
    throw err;
  });

  client.on('close', (err) => {
    if (err) {
      logger.error(err, `Lost connection with mongodb: ${connectionString}`);
    } else {
      logger.warn(`Closed connection with mongodb: ${connectionString}`);
    }
  });

  client.on('connectionReady', (err) => {
    if (err) {
      logger.error(err);
    } else {
      logger.info(`Connected to mongodb: ${connectionString}`);
    }
  });

  db.createService = (collectionName, options = {}) => {
    const collection = db.collection(collectionName);

    return new MongoService(collection, options, client);
  };

  db.setServiceMethod = (name, method) => {
    MongoService.prototype[name] = function customMethod(...args) {
      return method.apply(this.collection, [this.collection, ...args]);
    };
  };

  db.createQueryService = (collectionName, options = {}) => {
    const collection = db.collection(collectionName);

    return new MongoQueryService(collection, options);
  };

  db.setQueryServiceMethod = (name, method) => {
    MongoQueryService.prototype[name] = function customMethod(...args) {
      return method.apply(this.collection, [this.collection, ...args]);
    };
  };

  return db;
};

module.exports.connect = connect;
