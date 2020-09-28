const _ = require('lodash');

const generateId = require('./generate-id');
const MongoServiceError = require('./mongo-service-error');

class MongoQueryService {
  constructor(collection, options = {}) {
    this._collection = collection;
    this._options = options;

    this.name = collection.name;

    this.generateId = generateId;

    this.aggregate = collection.aggregate;
    this.count = collection.count;
    this.distinct = collection.distinct;
    this.geoHaystackSearch = collection.geoHaystackSearch;
    this.indexes = collection.indexes;
    this.mapReduce = collection.mapReduce;
    this.stats = collection.stats;
  }

  /**
  * Works as find, but also return paged results if page > 0
  * More documentation: https://automattic.github.io/monk/docs/collection/find.html
  *
  * @param query {string} mongo search query
  * @param opt.perPage {Number} number of items to return per page
  * @param opt.page {Number} a page number to return
  *
  * @return {pagesCount, results, count} {Object} - number of pages,
  * list of items and total count of all matched items
  */
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

  /**
  * Finds one document, if multiple returned - throws an error
  *
  * @param query {Object} - search query
  * @param options {Object} - search options, such fields and others
  *
  * @return {Object} - returns a document from the database
  */
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

  /**
  * Checks if document exists by specified query
  *
  * @param query {string} - search query
  * @param options {Object} - options
  * @return {Boolean}
  */
  async exists(query, options = {}) {
    const count = await this.count(query, { limit: 1, ...options });
    return count > 0;
  }
}

module.exports = MongoQueryService;
