const _ = require('lodash');

const MongoServiceError = require('./mongo-service-error');

class MongoQueryService {
  constructor(collection, options = {}) {
    this._collection = collection;
    this._options = options;

    this.name = collection.name;

    this.aggregate = collection.aggregate;
    this.count = collection.count;
    this.distinct = collection.distinct;
    this.geoHaystackSearch = collection.geoHaystackSearch;
    this.indexes = collection.indexes;
    this.mapReduce = collection.mapReduce;
    this.stats = collection.stats;
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

    const results = await this._collection.find(query, options);
    if (!hasPaging) {
      return {
        results,
      };
    }

    const countOptions = {};
    if (options.session) countOptions.session = options.session;
    const count = await this._collection.count(query, countOptions);
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
    const count = await this.count(query, { limit: 1, ...options });
    return count > 0;
  }
}

module.exports = MongoQueryService;
