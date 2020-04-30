# 1.0.0 API Reference

- [Node Mongo](#nodemongo)
  - [`connect(connectionString, [connectionSettings])`](#connectconnectionstring-connectionsettings)
  - [`createService(collectionName, [validateSchema, [options]])`](#createservicecollectionname-validateschema-options)
  - [`setServiceMethod(name, method)`](#setservicemethodname-method)
  - [`createQueryService(collectionName, [options])`](#createqueryservicecollectionname-options)
  - [`setQueryServiceMethod(name, method)`](#setqueryservicemethodname-method)
- [Mongo Query Service](#mongo-query-service)
  - [`name`](#name)
  - [`find([query, [options]])`](#findquery-options)
  - [`findOne([query, [options]])`](#findonequery-options)
  - [`count(query)`](#countquery)
  - [`distinct(field, [query, [options]])`](#distinctfield-query-options)
  - [`exists(query)`](#existsquery)
  - [`aggregate(pipeline)`](#aggregatepipeline)
  - [`generateId()`](#generateid)
  - [`expectDocument(query, [options])`](#expectdocumentquery-options)
- [Mongo Service](#mongo-service)
  - [`once(eventName, handler)`](#onceeventname-handler)
  - [`on(eventName, handler)`](#oneventname-handler)
  - [`create(objects)`](#createobjects)
  - [`update(query, updateFn)`](#updatequery-updatefn)
  - [`atomic.update(query, updateObject, [updateOptions])`](#atomicupdatequery-updateObject-updateoptions)
  - [`remove(query)`](#removequery)
  - [`ensureIndex(index, options)`](#ensureindexindex-options)
  - [`createOrUpdate(query, updateFn)`](#createorupdatequery-updatefn)
  - [`findOneAndUpdate(query, update, [options])`](#findoneandupdatequery-update-options)
  - [`atomic.findOneAndUpdate(query, update, [updateOptions])`](#atomicfindoneandupdatequery-update-updateoptions)
  - [`onPropertiesUpdated(properties, callback)`](#onpropertiesupdatedproperties-callback)

## Node Mongo

### `connect(connectionString, [connectionSettings])`

Connect to the database MongoDB.

#### Arguments:
- `connectionString` - *(String)* string to connect to database, contains host, port and user credentials if it's needed and other parameters ([MongoDB documentation](https://docs.mongodb.com/manual/reference/connection-string/)).
- `connectionSettings` - *(Object)* an object containing node-mongodb-native connection settings ([Reference](http://mongodb.github.io/node-mongodb-native/2.1/reference/connecting/connection-settings/)).

#### Returns:
New database object.

#### Example:
```javascript
const connectionString = `mongodb://localhost:27017/home-db`;
const connectionSettings = { poolSize: 10 };
const db = require('node-mongo').connect(connectionString, connectionSettings);
```

### `createService(collectionName, [validateSchema, [options]])`

Create and return new [MongoDB service](#mongo-service)

#### Arguments:
- `collectionName` - *(String)* the name of the collection with which the service will work.
- `validateSchema` - *(function)* optional function that accepts a collection document as a parameter and returns the result of the validation of this document. We recommend to to use [joi](https://github.com/hapijs/joi) for validation. Or you can use [jsonshema](https://github.com/tdegrunt/jsonschema) for validation.

  On every update service will validate schema before save data to the database. While schema is optional, we highly recommend use it for every service.
  We believe that `joi` is one of the best libraries for validation of the schema, because it allows us to do the following things:
  1) Validate the schemas with a variety of variations in data types
  2) It is easy to redefine the text for validation errors
  3) Write conditional validations for fields when some conditions are met for other fields
  4) Do some transformations of the values (for example for string fields you can do `trim`)

- `options` - *(Object)* optional object with options of the service.
  - `addCreatedOnField` - *(Boolean)* if `true` then we add field `createdOn` when we call method [create](#createobjects), default value is `false`
  - `addUpdatedOnField` - *(Boolean)* if `true` then we add field `updatedOn` when we call method [update](#updatequery-updatefn), default value is `false`

#### Returns:
New [MongoDB service](#mongo-service) object.

#### Example:
```javascript
const Joi = require('Joi');

const subscriptionSchema = {
  appId: Joi.string(),
  plan: Joi.string().valid('free', 'standard'),
  subscribedOn: Joi.date().allow(null),
  cancelledOn: Joi.date().allow(null),
};

const companySchema = {
  _id: Joi.string(),
  createdOn: Joi.date(),
  updatedOn: Joi.date(),
  name: Joi.string(),
  isOnDemand: Joi.boolean().default(false),,
  status: Joi.string().valid('active', 'inactive'),
  subscriptions: Joi.array().items(
    Joi.object().keys(subscriptionSchema)
  ),
};

const joiOptions = {};

module.exports = (obj) => Joi.validate(obj, companySchema, joiOptions);

// Use schema when creating service. user.service.js file:
const schema = require('./user.schema')
const usersService = db.createService('users', schema);
```

### `setServiceMethod(name, method)`

Add custom method for [Mongo service](#mongo-service).

### Arguments:
- `name` - *(String)* name of the method, that will be used to call method.
- `method` - *(function)* custom function in which we can manipulate the collection. The custom function takes the service itself as the first parameter, and the remaining parameters are the parameters that are passed when this custom function is called.

#### Example:
```javascript
const connectionString = `mongodb://localhost:27017/home-db`;
const db = require('node-mongo').connect(connectionString);

db.setServiceMethod('createByName', async (service, name) => {
  const res = await service.create({ name });
  return res;
});

// Create entity service
const usersQueryService = db.createQueryService('users');

// find user by id
const user = await usersQueryService.findById('123')
```

### `createQueryService(collectionName, [options])`

Create and return new [MongoDB Query Service](#mongo-query-service)

#### Arguments:
- `collectionName` - *(String)* name of the MongoDB collection.
- `options` - *(Object)* optional object with options of the service (currently, specified options are not used in the service)

#### Example:

```javascript
const usersService = db.createQueryService('users');
```

### `setQueryServiceMethod(name, method)`

Add custom method for [Mongo Query Service](#mongo-service).

#### Arguments:
- `name` - *(String)* name of the method, that will be used to call method.
- `method` - *(function)* custom function in which we can manipulate the collection. The custom function takes the service itself as the first parameter, and the remaining parameters are the parameters that are passed when this custom function is called.

#### Example:
```javascript
const connectionString = `mongodb://localhost:27017/home-db`;
const db = require('node-mongo').connect(connectionString);

db.setQueryServiceMethod('findById', (service, id) => {
  return service.findOne({ _id: id });
});
```

## Mongo Query Service

Mongo Query Service allows you to make requests to the database to get needed data, but this service not allow to modify data in the database.

### `name`

Get name of the collection for which service was created.

### `find([query, [options]])`

Get documents from the collection that satisfy the condition. 

#### Arguments:
- `query` - *(Object)* optional object, according to which we receive documents.
- `options` - *(Object)* optional object with options for query.
  - `perPage` - *(Number)* optional number of returned documents, default value is `100`.
  - `page` - *(Number)* optional page number with results, default value is `0`.
  - `fields` - *(Object)* optional projection object (fields that must be included or excluded from the result), by default we will return unmodified documents.
  - `rawCursor` - *(Boolean)* optional parameter to get the raw mongo cursor when the promise resolve.

#### Returns:
This async method returns an object with following fields:
  - `pagesCount` - *(Number)* total number of pages.
  - `results` - *(Object[])* array of documents.
  - `count` - *(Number)* total number of documents that satisfy the condition.

#### Example:
```javascript
const connectionString = `mongodb://localhost:27017/home-db`;
const db = require('node-mongo').connect(connectionString);

const usersService = db.createService('users');
const result = await usersService.find({ name: 'Bob' }, { page: 1, perPage: 30 });
// returns object like this:
// {
//   results: [], // array of user entities
//   pagesCount, // total number of pages
//   count, // total count of documents found by query
// }
```

### `findOne([query, [options]])`

Get one document that satisfies the specified condition.

#### Arguments:
- `query` - *(Object)* optional object, according to which we receive document.
- `options` - *(Object)* optional object with options for query.
  - `fields` - *(Object)* optional projection object (fields that must be included or excluded from the result), by default we will return unmodified documents.
  - `rawCursor` - *(Boolean)* optional parameter to get the raw mongo cursor when the promise resolve.

#### Returns:
Async function returns document or `null`. If several documents satisfy the condition, then we throw an error.

#### Example:
```javascript
const usersService = db.createService('users');
try {
  const user = await usersService.findOne({ name: 'Bob' });
} catch (error) {
  console.error('Several users were found.');
}
```

### `count(query)`

Get the number of documents that meet the specified condition.

#### Arguments:
- `query` - *(Object)* object with conditions for selection.

#### Returns:
Promise that resolve number of documents.

#### Example:
```javascript
const usersService = db.createService('users');
const usersNumber = await usersService.count({ name: 'Bob' });
```

### `distinct(field, [query, [options]])`

This method is a simple wrapper of the `distinct` method of the `monk`. You can find documention [here](https://automattic.github.io/monk/docs/collection/distinct.html).

### `exists(query)`

Async method to get existence of the documents that meet the specified condition.

#### Arguments:
- `query` - *(Object)* object with conditions for selection.

#### Returns:
Boolean value.

#### Example:
```javascript
const usersService = db.createService('users');
const usersExist = await usersService.exists({ name: 'Bob' });
```

### `aggregate(pipeline)`

This method is a simple wrapper of the `aggregate` method of the `monk`. You can find documention [here](https://automattic.github.io/monk/docs/collection/aggregate.html).

### `generateId()`

Get id for mongoDB documents.

#### Returns:
Id string.

#### Example:
```javascript
const usersService = db.createService('users');
const id = usersService.generateId();
```

### `expectDocument(query, [options])`

Wait, until certain document added or removed from database, typically used in the integrational tests.

#### Arguments:
  - `query` - *(Object)* object with conditions for selection.
  - `options` - *(Object)* optional object with the following options:
    - `timeout` - *(Number)* maximum waiting time (ms), default value is `10000`.
    - `tick` - *(Number)* gap between requests to the database, default value is `50`.
    - `expectNoDocs` - *(Boolean)* specifies the expected state of the document (added or deleted), default value is `false`.

#### Returns:
Promise which call `resolve` when the expected state is reached. If the expected state is not reached within a given time, then an error is thrown.

#### Example:
```javascript
const usersService = db.createService('users');
try {
  await usersService.expectDocument({ name: 'Bob'}, {
    timeout: 10000,
    tick: 50,
    expectNoDocs: false,
  });
} catch (error) {
  console.error('Document was not added');
}
```

## Mongo Service

Mongo Service extends [Mongo Query Service](#mongo-query-service), therefore instance of this service has all methods of the [Mongo Query Service](#mongo-query-service).

### `once(eventName, handler)`

Subscribe to database change events only once. The first time evenName is triggered listener handler is removed and then invoked.

#### Arguments:
- `eventName` - *(String)* name of the database event
- `handler` - *(function)* function event handler

#### Returns:
Returns a reference to the `EventEmitter`.

#### Example:
```javascript
const usersService = db.createService('users');
userService.once('updated', ({ doc, prevDoc }) => {
});
```

### `on(eventName, handler)`

Subscribe to database change events.

#### Arguments:
- `eventName` - *(String)* name of the database event
- `handler` - *(function)* function event handler

#### Returns:
Returns a reference to the `EventEmitter`.

#### Example:
```javascript
const usersService = db.createService('users');
userService.on('updated', ({ doc, prevDoc }) => {
});
```

### `create(objects)`

Async function that insert one object or array of the objects to the database. Publishes `created` event {doc}. Sets createdOn to the current date. If the schema for validation specified in the moment of creating service, then it is used within this method.

#### Arguments:
- `objects` - *(Object[]|Object)* Object or array of objects to create

#### Returns:
Object or array of created objects

#### Example:
```javascript
const usersService = db.createService('users');
await userService.create([{ name: 'Bob' }, { name: 'Alice' }]);
```

### `update(query, updateFn)`

Async function that modifies entity found by query in the database. Publishes `updated` event {doc, prevDoc}. Sets updatedOn to the current date. If the schema for validation specified in the moment of creating service, then it is used within this method.

#### Arguments:
- `query` - *(Object)* mongo search query
- `updateFn` - *(function)* function, that recieves document to be updated

#### Returns:
Updated document.

#### Example:
```javascript
const usersService = db.createService('users');
const updatedUser = await usersService.update({ _id: '1'}, (doc) => {
  doc.name = 'Alex';
});
```

### `atomic.update(query, updateObject, [updateOptions])`

This method is a simple wrapper of the `update` method of the `monk`. You can find documention [here](https://automattic.github.io/monk/docs/collection/update.html). This method doesn't publish `updated` event.

### `remove(query)`

Async function to remove one or many documents found by query.

#### Arguments:
- `query` - *(Object)* mongo search query

#### Returns:
Removed documents.

#### Example:
```javascript
const usersService = db.createService('users');
const removeUsers = await usersService.remove({ name: 'Alex' });
```

### `ensureIndex(index, options)`

Create or check index existence. This method is a wrapper of the `createIndex` method of the `monk`. You can find documention [here](https://automattic.github.io/monk/docs/collection/createIndex.html). This method omits error.

### `createOrUpdate(query, updateFn)`

Async method, that updates documents or create new document if there are no documents that satisfy the condition.

#### Arguments:
- `query` - *(Object)* mongo search query
- `updateFn` - *(function)* function, that recieves document to be updated

#### Returns:
Updated or created document.

#### Example:
```javascript
const usersService = db.createService('users');
const userHelen = await usersService.createOrUpdate({ _id: 1 }, (doc) => {
  doc.name = 'Helen';
});
```

### `findOneAndUpdate(query, update, [options])`
Update or create new document using `update` object. This method emits `updated` or `created` event.

#### Arguments:
- `query` - *(Object)* mongo search query
- `update` - *(Object)* update operations to be performed on the document
- `options` - *(Object)* optional object with options
  - `returnOriginal` - *(Boolean)* return original or updated document

#### Return:
Promise that resolves document.

#### Example:
```javascript
const usersService = db.createService('users');
const newUser = await usersService.findOneAndUpdate({ name: 'Bob'}, {
  $set: {
    name: 'Alice',
  },
});
```

### `atomic.findOneAndUpdate(query, update, [updateOptions])`

This method is a simple wrapper of the `findOneAndUpdate` method of the `monk`. You can find documention [here](https://automattic.github.io/monk/docs/collection/findOneAndUpdate.html). This method doesn't publish any event.

### `onPropertiesUpdated(properties, callback)`

Deep compare doc & prevDoc from `updated` event. When something changed - executes callback.

#### Arguments:
- `properties` - *(Object[]|Object)* properties to compare
- `callback` - *(function)* executes callback if something changed

#### Returns:
Returns a reference to the `EventEmitter`.

#### Example:
```javascript
// Listen to the value changes between original and updated document
// Callback executed only if user lastName or firstName are different in current or updated document
userService.onPropertiesUpdated(['user.firstName', 'user.lastName'], ({ doc, prevDoc }) => {
});

// Listen to the value changes between original and updated document
// Callback executed only if user first name changes to `Bob`
const propertiesObject = { 'user.firstName': 'Bob' };
userService.onPropertiesUpdated(propertiesObject, ({ doc, prevDoc }) => {
});
```
