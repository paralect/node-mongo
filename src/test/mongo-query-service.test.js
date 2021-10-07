const chai = require('chai');

const { connect } = require('../index');
const config = require('./config.json');
const MongoServiceError = require('../mongo-service-error');

const should = chai.should();

let db;
let queryService;

module.exports = () => {
  describe('MongoQueryService', () => {
    before(async () => {
      db = await connect(config.mongo.connection);
      db.setQueryServiceMethod('findOneByName', (service, name) => service.findOne({ name }));
      queryService = db.createQueryService('mongo-query-service-test');

      await queryService._collection.insert([
        { name: 'Bob' },
        { name: 'Alice' },
        { name: 'Nick' },
        { name: 'Nick' },
      ]);
    });
    after(() => queryService._collection.drop());

    describe('name', () => {
      it('should exists', async () => {
        queryService.name.should.be.equal('mongo-query-service-test');
      });
    });

    describe('find', () => {
      it('should return plain response if page property is not specified', async () => {
        const response = await queryService.find({});
        response.should.have.all.keys('results');
        response.results.length.should.be.equal(4);
      });
      it('should return paginated response if page property is specified', async () => {
        const response = await queryService.find({}, { page: 1, perPage: 2 });
        response.should.have.all.keys('results', 'pagesCount', 'count');
        response.results.length.should.be.equal(2);
        response.pagesCount.should.be.equal(2);
        response.count.should.be.equal(4);
      });
    });

    describe('findOne', () => {
      it('should return document if it exists', async () => {
        const response = await queryService.findOne({ name: 'Bob' });
        response.name.should.be.equal('Bob');
      });
      it('should return null if document does not exist', async () => {
        const response = await queryService.findOne({ name: 'Jim' });
        should.equal(response, null);
      });
      it('should throw out error if more than one document is found', async () => {
        try {
          await queryService.findOne({ name: 'Nick' });
        } catch (error) {
          error.code.should.be.equal(MongoServiceError.MORE_THAN_ONE);
        }
      });
    });

    describe('exists', () => {
      it('should return true if document exists', async () => {
        const response = await queryService.exists({ name: 'Bob' });
        response.should.be.equal(true);
      });
      it('should return false if document does not exist', async () => {
        const response = await queryService.exists({ name: 'Jim' });
        response.should.be.equal(false);
      });
    });

    describe('custom query service method', () => {
      it('should work', async () => {
        const response = await queryService.findOneByName('Bob');
        response.name.should.be.equal('Bob');
      });
    });
  });
};
