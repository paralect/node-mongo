const chai = require('chai');
const Joi = require('joi');
const { Validator } = require('jsonschema');

const validator = new Validator();

const MongoService = require('./MongoService');
const config = require('./config');

chai.should();

const db = require('./').connect(config.mongo.connection);

const joiSchema = {
  _id: Joi.string(),
  firstName: Joi.string().allow(''),
  lastName: Joi.string(),
};

const jsonSchema = {
  id: '/User',
  type: 'object',
  properties: {
    _id: { type: 'String' },
    firstName: { type: 'String' },
    lastName: { type: 'String', minLength: 1 },
  },
  required: ['lastName'],
};

const validateJoiSchema = obj => Joi.validate(obj, joiSchema, { allowUnknown: true });

const validateJsonSchema = obj => validator.validate(obj, jsonSchema);

module.exports = () => {
  describe('MongoService', () => {
    const userServiceJoiSchema = db.createService(
      `users-joi-schema-${Date.now()}`,
      validateJoiSchema,
    );

    const userServiceJsonSchema = db.createService(
      `users-json-schema-${Date.now()}`,
      validateJsonSchema,
    );

    const userService = db.createService(`users-${Date.now()}`);
    const findUserService = db.createService(`users-${Date.now() + 1}`);

    after(async () => {
      await Promise.all([
        userServiceJoiSchema._collection.drop(),
        userService._collection.drop(),
        findUserService._collection.drop(),
      ]);
    });

    it('should create a document', async () => {
      const doc = await userService.create({ name: 'Bob' });
      doc.name.should.be.equal('Bob');
    });

    it('should create multiple documents', async () => {
      const docs = await userService.create([{ name: 'Bob' }, { name: 'Alice' }]);
      docs[0].name.should.be.equal('Bob');
      docs[1].name.should.be.equal('Alice');
    });

    it('should emit `created` event when document saved to the database', (done) => {
      userService.create([{ name: 'Bob' }])
        .catch((err) => {
          throw err;
        });

      userService.once('created', (evt) => {
        evt.doc.name.should.be.equal('Bob');
        done();
      });
    });

    it('should emit `removed` event when document removed from the database', (done) => {
      userService.once('removed', (evt) => {
        evt.doc.name.should.be.equal('Bob');
        done();
      });

      userService.create([{ name: 'Bob' }])
        .then((doc) => {
          return userService.remove({ _id: doc._id });
        })
        .catch((err) => {
          throw err;
        });
    });

    it('should update a document in a database', async () => {
      let doc = await userService.create([{ name: 'Bob' }]);
      doc = await userService.update({ _id: doc._id }, (u) => {
        const user = u;
        user.name = 'Alice';
      });
      doc.name.should.be.equal('Alice');
    });

    it('should emit `updated` event when document updated in the database', async () => {
      const doc = await userService.create([{ name: 'Bob' }]);
      userService.update({ _id: doc._id }, (u) => {
        const user = u;
        user.name = 'Alice';
      })
        .catch((err) => {
          throw err;
        });

      await new Promise((resolve, reject) => {
        userService.once('updated', (evt) => {
          evt.doc.name.should.be.equal('Alice');
          evt.prevDoc.name.should.be.equal('Bob');
          resolve();
        });
      });
    });

    it('should create a document', async () => {
      const user = { name: 'Bob' };
      const doc = await userService.createOrUpdate({ _id: '1' }, (dbUser) => {
        Object.assign(dbUser, user);
      });
      doc._id.should.be.equal('1');
      doc.name.should.be.equal('Bob');
    });

    it('should create two documents', async () => {
      const user1 = { name: 'Bob' };
      let doc = await userService.createOrUpdate({ _id: '1' }, (dbUser) => {
        Object.assign(dbUser, user1);
      });
      doc._id.should.be.equal('1');
      doc.name.should.be.equal('Bob');

      const user2 = { name: 'Alice' };
      doc = await userService.createOrUpdate({ _id: '2' }, (dbUser) => {
        Object.assign(dbUser, user2);
      });

      doc._id.should.be.equal('2');
      doc.name.should.be.equal('Alice');
    });

    it('should update document', async () => {
      const user1 = { name: 'Bob' };
      let doc = await userService.createOrUpdate({ _id: '1' }, (dbUser) => {
        Object.assign(dbUser, user1);
      });
      doc._id.should.be.equal('1');
      doc.name.should.be.equal('Bob');

      const user2 = { name: 'Alice' };
      doc = await userService.createOrUpdate({ _id: '1' }, (dbUser) => {
        Object.assign(dbUser, user2);
      });
      doc._id.should.be.equal('1');
      doc.name.should.be.equal('Alice');
    });

    it('should perform atomic document update', async () => {
      const _id = 'atomic_update';
      await userService.create({ _id, name: 'Bob' });
      await userService.atomic.update({ _id }, {
        $set: {
          name: 'Alice',
        },
      });
      const userDoc = await userService.findOne({ _id });
      userDoc.name.should.be.equal('Alice');
    });

    it('should deepCompare nested properties passed as an Array', () => {
      const data = { user: { firstName: 'Bob' } };
      const initialData = { user: { firstName: 'John' } };

      const changed = MongoService.deepCompare(data, initialData, ['user.firstName']);
      changed.should.be.equal(true);
    });

    it('should _deepCompare nested properties passed as an Object', () => {
      const data = { user: { firstName: 'Bob' } };
      const initialData = { user: { firstName: 'John' } };

      const changed = MongoService.deepCompare(data, initialData, { 'user.firstName': 'Bob' });
      changed.should.be.equal(true);
    });

    it('should update document using atomic modifiers', async () => {
      const _id = 'find_one_and_update';
      await userService.create({ _id, name: 'Bob' });
      await userService.findOneAndUpdate({ _id }, {
        $set: {
          name: 'Alice',
        },
      });
      const userDoc = await userService.findOne({ _id });
      userDoc.name.should.be.equal('Alice');
    });

    it('should return an error that the data does not satisfy the jsonschema schema', async () => {
      let errors;
      try {
        await userServiceJsonSchema.create({
          firstName: 'Evgeny',
          lastName: '',
        });
      } catch (err) {
        errors = err.error.details;
      }

      errors.length.should.be.equal(1);
      errors[0].name.should.be.equal('minLength');
    });

    it('should return an error that the data does not satisfy the joi schema', async () => {
      let errors;
      try {
        await userServiceJoiSchema.create({
          firstName: 'Evgeny',
          lastName: '',
        });
      } catch (err) {
        errors = err.error.details;
      }

      errors.length.should.be.equal(1);
      errors[0].type.should.be.equal('any.empty');
    });

    it('should successfully create new user', async () => {
      const user = await userServiceJoiSchema.create({
        firstName: 'Evgeny',
        lastName: 'Zhivitsa',
      });
      user.firstName.should.be.equal('Evgeny');
    });

    it('should return an error that update function must be specified', async () => {
      try {
        await userService.update({ name: 'Magneto' }, { name: 'Professor X' });
      } catch (err) {
        err.message.should.be.equal('updateFn must be a function');
      }
    });

    it('should return an error that document not found', async () => {
      try {
        await userService.update({ name: 'Magneto' }, (u) => {
          const user = u;
          user.name = 'Professor X';
        });
      } catch (err) {
        err.message.should.be.equal('Document not found while updating. Query: {"name":"Magneto"}');
      }
    });
  });
};
