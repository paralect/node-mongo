const chai = require('chai');

const config = require('./config');

chai.should();

const db = require('./').connect(config.mongo.connection);

db.setQueryServiceMethod('findById', (service, id) => {
  return service.findOne({ _id: id });
});

module.exports = () => {
  describe('MongoQueryService', () => {
    const collectionName = `users-${Date.now()}`;
    const collectionName2 = `users2-${Date.now()}`;

    const userService = db.createService(collectionName);
    const userService2 = db.createService(collectionName2);

    const userQueryService = db.createQueryService(collectionName);
    const userQueryService2 = db.createQueryService(collectionName2);

    after(async () => {
      await userService._collection.drop();
    });

    it('should successfully get name of the collection', () => {
      userQueryService.name.should.be.equal(collectionName);
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

    it('should return 0 results', async () => {
      const res = await userQueryService.find(
        { _id: 'nonexistent id' },
        { page: 1 },
      );
      res.pagesCount.should.be.equal(1);
    });

    it('should return one user', async () => {
      await userService.create([{ name: 'Evgeny' }]);

      const res = await userQueryService.findOne({ name: 'Evgeny' });
      res.name.should.be.equal('Evgeny');
    });

    it('should return an error that there exist more than one document in the collection', async () => {
      await userService.create([{ name: 'Amy' }, { name: 'Amy' }]);

      try {
        await userQueryService.findOne({ name: 'Amy' });
      } catch (err) {
        err.message.should.be.equal('findOne: More than one document return for query {"name":"Amy"}');
      }
    });

    it('should return number of documents in the collection', async () => {
      await userService.create([{ name: 'Jake' }, { name: 'Jake' }]);

      const res = await userQueryService.count({ name: 'Jake' });
      res.should.be.equal(2);
    });

    it('should return distinct valuest', async () => {
      await userService2.create([{ name: 'User1' }, { name: 'User2' }]);

      const res = await userQueryService2.distinct('name');
      res[0].should.be.equal('User1');
      res[1].should.be.equal('User2');
    });

    it("should return that user Professor X doesn't exist in the list of user", async () => {
      const res = await userQueryService.exists({ name: 'Professor X' });
      res.should.be.equal(false);
    });

    it('should successfully return result of aggregation', async () => {
      await userService.create([
        {
          name: 'Magneto',
          allies: [
            { name: 'Mystique' },
            { name: 'Juggernaut' },
          ],
        },
        {
          name: 'Professor X',
          allies: [
            { name: 'Cyclops' },
            { name: 'Storm' },
          ],
        },
      ]);

      const res = await userQueryService.aggregate([
        { $unwind: '$allies' },
        {
          $match: {
            'allies.name': 'Juggernaut',
          },
        },
      ]);
      res[0].name.should.be.equal('Magneto');
    });

    it('should generate id for document', () => {
      const id = userQueryService.generateId();
      id.length.should.be.equal(24);
    });

    it('should return user by id using custom method findById', async () => {
      const user = await userService.create({ name: 'Jean Grey' });

      const res = await userQueryService.findById(user._id);
      res.name.should.be.equal('Jean Grey');
    });

    it('should successfully wait creation of the document', async () => {
      const wolverine = { name: 'James Howlett' };
      setTimeout(() => {
        userService.create(wolverine);
      }, 100);
      await userQueryService.expectDocument(wolverine);
      const expectedDoc = await userQueryService.findOne(wolverine);
      expectedDoc.name.should.be.equal(wolverine.name);
    });

    it('should not wait creation of the document', async () => {
      const deadpool = { name: 'Wade Winston Wilson' };
      setTimeout(() => {
        userService.create(deadpool);
      }, 200);

      try {
        await userQueryService.expectDocument(deadpool, {
          timeout: 50,
          tick: 15,
          expectNoDocs: true,
        });
      } catch (error) {
        error.message.should.have.string('Timeout while waiting for query');
      }
    });

    it('should wait deletion of the document', async () => {
      const domino = { name: 'Neena Thurman' };
      userService.create(domino);
      setTimeout(() => {
        userService.remove(domino);
      }, 200);

      try {
        await userQueryService.expectDocument(domino, { timeout: 50, tick: 15 });
      } catch (error) {
        error.message.should.have.string('Timeout while waiting for query');
      }
    });
  });
};
