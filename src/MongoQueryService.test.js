const chai = require('chai');

const MongoService = require('./MongoService');
const MongoQueryService = require('./MongoQueryService');
const config = require('./config');

chai.should();

const db = require('./').connect(config.mongo.connection);

module.exports = () => {
  describe('MongoQueryService', () => {
    const collectionName = `users-${Date.now()}`;

    const userService = db.createService(collectionName);
    const userQueryService = db.createQueryService(collectionName);

    after(async () => {
      await userService._collection.drop();
    });

    it('should return paged result if page > 0', async () => {
      // create separate service to stricly check count
      // and do not mix with other tests
      await userService.create([{ name: 'Bob' }, { name: 'Alice' }, { name: 'Nick' }]);

      const options = { page: 1, perPage: 2, sort: { name: 1 } };
      const res = await userQueryService.find({}, options);
      res.results.length.should.be.equal(2);
      res.pagesCount.should.be.equal(2);
      res.count.should.be.equal(3);
    });

    it('should return one user', async () => {
      await userService.create([{ name: 'Evgeny' }]);

      const res = await userQueryService.findOne({ name: 'Evgeny' });
    });
  });
};
