[![Build Status](http://product-stack-ci.paralect.com/api/badges/paralect/node-mongo/status.svg)](http://product-stack-ci.paralect.com/paralect/node-mongo) [![npm version](https://badge.fury.io/js/%40paralect%2Fnode-mongo.svg)](https://badge.fury.io/js/%40paralect%2Fnode-mongo) [![Coverage Status](https://coveralls.io/repos/github/paralect/node-mongo/badge.svg?branch=master)](https://coveralls.io/github/paralect/node-mongo?branch=master)

# Handy MongoDB layer for Node.JS 8

Currently based on [monk](https://github.com/Automattic/monk).

Install as npm package: `npm i @paralect/node-mongo`

There are few reasons, why we think this layer could be helpful to many projects:

1. Every update method emits `*.updated`, `*.created`, `*.removed` events, which allow to listen for the database changes and perform business logic based on this updates. That could help keep your entities weakly coupled with each other.
2. Implements more high level api, such as paging.
3. Implements database schema validation based on [joi](https://github.com/hapijs/joi). See examples below for more details.
4. Allows you to add custom methods for services that are needed on a particular project. See examples below for more details.

## API

See the detailed [API Reference](https://github.com/paralect/node-mongo/API.md).

## Usage example

Examples below cover all API methods currently available.

### Full API example Usage

```javascript
const connectionString = `mongodb://localhost:27017/home-db`;
const db = require('./').connect(connectionString);

// Create entity service
const usersService = db.createService('users');

// Updates

// All methods bellow:
// 1. emit updated, created and removed events
// 2. Load and save entire object

await userService.create([{ name: 'Bob' }, { name: 'Alice' }]);
await usersService.update({ _id: '1'}, (doc) => {
  doc.name = 'Alex';
});

await usersService.remove({ _id: 1 });
// if any errors happen, ensureIndex will log it as warning
usersService.ensureIndex({ _id: 1, name: 1});

// update callback is executed only if document exists
await usersService.createOrUpdate({ _id: 1 }, (doc) => {
  doc.name = 'Helen';
})

// Atomic operations. Do not emit change events.
await userService.atomic.update({ name: 'Bob' }, {
  $set: {
    name: 'Alice',
  },
}, { multi: true });

await usersService.findOneAndUpdate({ name: 'Bob'}, {
  $set: {
    name: 'Alice',
  },
});

// Subscribe to service change events:
userService.on('updated', ({ doc, prevDoc }) => {
});
userService.on('created', ({ doc, prevDoc }) => {
});
userService.on('removed', ({ doc, prevDoc }) => {
});

// Listen to the value changes between original and updated document
// Callback executed only if user lastName or firstName are different in current or updated document
const propertiesObject = { 'user.firstName': 'Bob' };
userService.onPropertiesUpdated(['user.firstName', 'user.lastName'], ({ doc, prevDoc }) => {
});

// Listen to the value changes between original and updated document
// Callback executed only if user first name changes from `Bob` to something else
userService.onPropertiesUpdated(propertiesObject, ({ doc, prevDoc }) => {
});

```
