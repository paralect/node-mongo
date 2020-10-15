
# Node Mongo

[![npm version](https://badge.fury.io/js/%40paralect%2Fnode-mongo.svg)](https://badge.fury.io/js/%40paralect%2Fnode-mongo)

Node Mongo is reactive extension to MongoDB API. It provides few usability improvements to the [monk](https://github.com/Automattic/monk) API.

## Features

* ️️**Reactive**. Fires events as document stored, updated or deleted from database
* **Paging**. Implements high level paging API
* **Schema validation**. Validates your data before save

## Installation

```
npm i @paralect/node-mongo
```

## Documentation

[API Reference](API.md).

## Usage

### Connect to MongoDB
```javascript
const connectionString = 'mongodb://localhost:27017/home-db';
const db = require('@paralect/node-mongo').connect(connectionString);
```

### CRUD Operations
```javascript
// create a service to work with specific database collection
const userService = db.createService('users');

// create documents
const users = await userService.create([
  { name: 'Alex' },
  { name: 'Bob' },
]);

// find one document
const user = await userService.findOne({ name: 'Bob' });

// find many documents with pagination
const {results, pagesCount, count } = await userService.find(
  { name: 'Bob' },
  { page: 1, perPage: 30 },
);

// update document
const updatedUser = await userService.updateOne(
  { _id: '1' },
  (doc) => ({ ...doc, name: 'Alex' }),
);

// remove document
const removedUser = await userService.remove({ _id: '1' });
```

### Event handlers
```js
const userService = db.createService('users');

userService.on('created', ({ doc }) => {
});

userService.on('updated', ({ doc, prevDoc }) => {
});

userService.onPropertiesUpdated(['email'], ({ doc, prevDoc }) => {
});

userService.on('removed', ({ doc }) => {
});
```

### Schema validation
```javascript
const Joi = require('Joi');

const userSchema = Joi.object({
  _id: Joi.string(),
  createdOn: Joi.date(),
  name: Joi.string(),
  status: Joi.string().valid('active', 'inactive'),
});

function validate(obj) {
  return userSchema.validate(obj);
}

const userService = db.createService('users', { validate });
```

## Change Log

This project adheres to [Semantic Versioning](http://semver.org/).

Every release is documented on the Github [Releases](https://github.com/paralect/node-mongo/releases) page.
