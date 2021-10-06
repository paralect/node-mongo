/* eslint-disable no-unused-expressions */
const chai = require('chai');
const spies = require('chai-spies');

const MongoServiceError = require('../mongo-service-error');

chai.should();
chai.use(spies);

const { connect } = require('../index');

module.exports = () => {
  let db;
  let service;

  describe('MongoService with default options', async () => {
    before(async () => {
      console.log('start connect');
      db = await connect('mongodb://root:root@mongo/node-mongo-tests?authSource=admin');
      console.log('connected', db);
      db.setServiceMethod('createByName', (s, name) => s.create({ name }));
      service = db.createService('mongo-service-test');
      service.atomic.drop();
    });

    after(() => service.atomic.drop());

    describe('handlers', () => {
      it('should call `on` handler at least twice', async () => {
        const spy = chai.spy();
        service.on('created', spy);
        await service.create({});
        await service.create({});
        spy.should.have.been.called.at.least(2);
      });
      it('should call `once` handler once', async () => {
        const spy = chai.spy();
        service.once('created', spy);
        await service.create({});
        await service.create({});
        spy.should.have.been.called.once;
      });
      it('should call `onPropertiesUpdated` handler when propeties updated', async () => {
        const spy = chai.spy();
        service.onPropertiesUpdated(['name'], spy);
        const createdDoc = await service.create({});
        await service.updateOne(
          { _id: createdDoc._id },
          (doc) => ({ ...doc, name: service.generateId() }),
        );
        spy.should.have.been.called();
      });
      it('should not call `onPropertiesUpdated` handler when propeties not updated', async () => {
        const spy = chai.spy();
        service.onPropertiesUpdated(['name'], spy);
        const createdDoc = await service.create({ name: service.generateId() });
        await service.updateOne(
          { _id: createdDoc._id },
          (doc) => ({ ...doc, age: 1 }),
        );
        spy.should.not.have.been.called();
      });
    });

    describe('create', () => {
      it('should give you an object with the auto `_id` and `createdOn` fields', async () => {
        const createdDoc = await service.create({});
        createdDoc.should.have.all.keys('_id', 'createdOn');
        createdDoc._id.should.be.a('string');
        createdDoc.createdOn.should.be.a('string');
      });
      it('should give you an object with the specified `_id` and `createdOn` fields', async () => {
        const _id = service.generateId();
        const createdOn = new Date().toISOString();
        const doc = await service.create({ _id, createdOn });
        doc.should.have.all.keys('_id', 'createdOn');
        doc._id.should.be.equal(_id);
        doc.createdOn.should.be.equal(createdOn);
      });
      it('should give you an array of objects with the auto `_id` and `createdOn` fields', async () => {
        const createdDocs = await service.create([{}, {}]);
        createdDocs.should.be.a('array');
        createdDocs.length.should.be.equal(2);
        createdDocs.forEach((createdDoc) => {
          createdDoc.should.have.all.keys('_id', 'createdOn');
          createdDoc._id.should.be.a('string');
          createdDoc.createdOn.should.be.a('string');
        });
      });
      it('should emit `created` event', async () => {
        const _id = service.generateId();
        const handler = chai.spy(({ doc }) => {
          doc._id.should.be.equal(_id);
        });
        service.once('created', handler);
        await service.create({ _id });
        handler.should.be.called();
      });
    });

    describe('updateOne', () => {
      it('should give you an updated object with the auto `updatedOn` field', async () => {
        const createdDoc = await service.create({});
        const updatedDoc = await service.updateOne(
          { _id: createdDoc._id },
          (doc) => ({ ...doc, name: '' }),
        );
        updatedDoc.updatedOn.should.be.a('string');
        updatedDoc.name.should.be.equal('');
      });
      it('should throw error if update function is not provided', async () => {
        try {
          await service.updateOne({}, null);
        } catch (error) {
          error.code.should.be.equal(MongoServiceError.INVALID_ARGUMENT);
        }
      });
      it('should throw error if document not found', async () => {
        try {
          await service.updateOne(
            { _id: service.generateId() },
            (doc) => ({ ...doc, name: '' }),
          );
        } catch (error) {
          error.code.should.be.equal(MongoServiceError.NOT_FOUND);
        }
      });
      it('should emit `updated` event', async () => {
        const createdDoc = await service.create({});
        const handler = chai.spy(({ doc }) => {
          doc._id.should.be.equal(createdDoc._id);
        });
        service.once('updated', handler);
        await service.updateOne(
          { _id: createdDoc._id },
          (doc) => ({ ...doc, name: '' }),
        );
        handler.should.be.called();
      });
    });

    describe('updateMany', () => {
      it('should give you an array of updated objects with the auto `updatedOn` field', async () => {
        const name = service.generateId();
        const createdDocs = await service.create([{ name }, { name }]);
        const updatedDocs = await service.updateMany(
          { name },
          (doc) => ({ ...doc, name: '' }),
        );
        updatedDocs.should.be.a('array');
        updatedDocs.length.should.be.equal(createdDocs.length);
        updatedDocs.forEach((updatedDoc, index) => {
          updatedDoc._id.should.be.equal(createdDocs[index]._id);
          updatedDoc.updatedOn.should.be.a('string');
          updatedDoc.name.should.be.equal('');
        });
      });
      it('should return empty array if no documents found', async () => {
        const updatedDocs = await service.updateMany(
          { _id: service.generateId() },
          (doc) => ({ ...doc, name: '' }),
        );
        updatedDocs.should.be.a('array');
        updatedDocs.length.should.be.equal(0);
      });
      it('should throw error if update function is not provided', async () => {
        try {
          await service.updateMany({}, null);
        } catch (error) {
          error.code.should.be.equal(MongoServiceError.INVALID_ARGUMENT);
        }
      });
      it('should emit `updated` event', async () => {
        const createdDoc = await service.create({});
        const handler = chai.spy(({ doc }) => {
          doc._id.should.be.equal(createdDoc._id);
        });
        service.once('updated', handler);
        await service.updateMany(
          { _id: createdDoc._id },
          (doc) => ({ ...doc, name: '' }),
        );
        handler.should.be.called();
      });
    });

    describe('remove', () => {
      it('should emit `removed` event', async () => {
        const createdDoc = await service.create({});
        const handler = chai.spy(({ doc }) => {
          doc._id.should.be.equal(createdDoc._id);
        });
        service.once('removed', handler);
        await service.remove({ _id: createdDoc._id });
        handler.should.be.called();
      });
    });

    describe('performTransaction', () => {
      it('should work', async () => {
        const _id = service.generateId();
        const name = service.generateId();
        await service.performTransaction(async (session) => {
          const createdUser = await service.create({ _id }, { session });
          return service.updateOne(
            { _id: createdUser._id },
            (doc) => ({ ...doc, name }),
            { session },
          );
        });
        const doc = await service.findOne({ _id });
        doc.name.should.be.equal(name);
      });
    });

    describe('custom service method', () => {
      it('should work', async () => {
        const name = service.generateId();
        const response = await service.createByName(name);
        response.name.should.be.equal(name);
      });
    });
  });

  describe('MongoService with disabled auto fields', () => {
    service = db.createService('mongo-service-test', {
      addCreatedOnField: false,
      addUpdatedOnField: false,
      useStringId: false,
    });

    before(() => service.atomic.drop());
    after(() => service.atomic.drop());

    describe('create', () => {
      it('should give you an object with the object `_id` and without `createdOn` field', async () => {
        const name = service.generateId();
        const doc = await service.create({ name });
        doc.should.have.all.keys('_id', 'name');
        doc._id.should.be.a('object');
        doc.name.should.be.equal(name);
      });
    });

    describe('updateOne', () => {
      it('should give you an updated object without the `updatedOn` field', async () => {
        const createdDoc = await service.create({});
        const updatedDoc = await service.updateOne(
          { _id: createdDoc._id },
          (doc) => ({ ...doc, name: '' }),
        );
        updatedDoc.should.have.all.keys('_id', 'name');
        updatedDoc.name.should.be.equal('');
      });
    });

    describe('updateMany', () => {
      it('should give you an array of updated objects without the `updatedOn` field', async () => {
        const name = service.generateId();
        const createdDocs = await service.create([{ name }, { name }]);
        const updatedDocs = await service.updateMany(
          { name },
          (doc) => ({ ...doc, name: '' }),
        );
        updatedDocs.should.be.a('array');
        updatedDocs.forEach((updatedDoc, index) => {
          updatedDoc.should.have.all.keys('_id', 'name');
          updatedDoc._id.should.be.deep.equal(createdDocs[index]._id);
          updatedDoc.name.should.be.equal('');
        });
      });
    });
  });

  describe('MongoService with `validate` option', () => {
    service = db.createService('mongo-service-test', {
      validate: (object) => {
        if (!object.name) {
          return {
            value: object,
            error: {
              details: [{ message: 'Name is required' }],
            },
          };
        }

        return { value: object };
      },
    });

    before(() => service.atomic.drop());
    after(() => service.atomic.drop());

    describe('create', () => {
      it('should throw an error if input is invalid', async () => {
        try {
          await service.create({ name: '' });
        } catch (error) {
          error.code.should.be.equal(MongoServiceError.INVALID_SCHEMA);
        }
      });
    });

    describe('updateOne', () => {
      it('should throw an error if input is invalid', async () => {
        try {
          const createdDoc = await service.create({ _id: service.generateId() });
          await service.updateOne(
            { _id: createdDoc._id },
            (doc) => ({ ...doc, name: '' }),
          );
        } catch (error) {
          error.code.should.be.equal(MongoServiceError.INVALID_SCHEMA);
        }
      });
    });

    describe('updateMany', () => {
      it('should throw an error if input is invalid', async () => {
        try {
          const createdDoc = await service.create({ _id: service.generateId() });
          await service.updateMany(
            { _id: createdDoc._id },
            (doc) => ({ ...doc, name: '' }),
          );
        } catch (error) {
          error.code.should.be.equal(MongoServiceError.INVALID_SCHEMA);
        }
      });
    });
  });
};
