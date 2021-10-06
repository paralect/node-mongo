const _ = require('lodash');

const MongoServiceError = require('./mongo-service-error');

class MongoQueryService {
  constructor(collection, options = {}, client) {
    this._collection = collection;
    this._options = options;
    this._client = client;

    this.name = collection.name;

    this.aggregate = collection.aggregate.bind(collection);
    this.count = collection.countDocuments.bind(collection);
    this.distinct = collection.distinct.bind(collection);
    this.indexes = collection.indexes.bind(collection);
    this.mapReduce = collection.mapReduce.bind(collection);
    this.stats = collection.stats.bind(collection);
  }

  async find(query = {}, opt = { perPage: 100, page: 0 }) {
    const options = _.cloneDeep(opt);
    const { page, perPage } = options;

    const hasPaging = page > 0;
    if (hasPaging) {
      options.skip = (page - 1) * perPage;
      options.limit = perPage;
    }

    delete options.perPage;
    delete options.page;

    const results = await this._collection.find(query, options).toArray();
    if (!hasPaging) return { results };

    const countOptions = {};
    if (options.session) countOptions.session = options.session;
    const count = await this._collection.countDocuments(query, countOptions);
    const pagesCount = Math.ceil(count / perPage) || 1;

    return {
      pagesCount,
      results,
      count,
    };
  }

  async findOne(query = {}, options = {}) {
    const { results } = await this.find(query, { limit: 2, ...options });

    if (results.length > 1) {
      throw new MongoServiceError(
        MongoServiceError.MORE_THAN_ONE,
        `findOne: More than one document return for query ${JSON.stringify(query)}`,
      );
    }

    return results[0] || null;
  }

  async exists(query, options = {}) {
    const count = await this._collection.countDocuments(query, options);
    return count > 0;
  }
}

module.exports = MongoQueryService;
