
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

## Quick example

Connect to the database:
```javascript
const connectionString = `mongodb://localhost:27017/home-db`;
const db = require('node-mongo').connect(connectionString);
```

Short API overview, for more details see [Full API reference](API.md)
```javascript
// create a service to work with specific database collection
const userService = db.createService('users');

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

// subscribe to document updates
userService.on('updated', ({ doc, prevDoc }) => {
});
```

Schema declaration (`user.schema.js`):
```javascript
const Joi = require('Joi');

const companySchema = Joi.object({
  _id: Joi.string(),
  createdOn: Joi.date(),
  name: Joi.string(),
  status: Joi.string().valid('active', 'inactive'),
});

exports.schema = companySchema;

exports.validate = (obj) => companySchema.validate(obj);
```

Schema validation:
```javascript
const { validate } = require('./user.schema');

const userService = db.createService('users', { validate });
```

## Full API Reference

[API Reference](API.md).

## Change Log

This project adheres to [Semantic Versioning](http://semver.org/).

Every release is documented on the Github [Releases](https://github.com/paralect/node-mongo/releases) page.
