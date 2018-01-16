
# Node Mongo

[![Stack](https://raw.githubusercontent.com/paralect/stack/master/stack-component-template/stack.png)](https://github.com/paralect/stack)

[![All Contributors](https://img.shields.io/badge/all_contributors-1-orange.svg?style=flat-square)](#contributors)
[![npm version](https://badge.fury.io/js/%40paralect%2Fnode-mongo.svg)](https://badge.fury.io/js/%40paralect%2Fnode-mongo) 
[![license](https://img.shields.io/github/license/mashape/apistatus.svg?style=flat-square)](LICENSE)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg?style=flat-square)](http://makeapullrequest.com)
[![Build Status](http://product-stack-ci.paralect.com/api/badges/paralect/node-mongo/status.svg)](http://product-stack-ci.paralect.com/paralect/node-mongo)
[![David Dependancy Status](https://david-dm.org/paralect/stack.svg)](https://david-dm.org/paralect/stack)
[![Coverage Status](https://coveralls.io/repos/github/paralect/node-mongo/badge.svg?branch=master)](https://coveralls.io/github/paralect/node-mongo?branch=master)


[![Watch on GitHub](https://img.shields.io/github/watchers/paralect/stack.svg?style=social&label=Watch)](https://github.com/paralect/node-mongo/watchers)
[![Star on GitHub](https://img.shields.io/github/stars/paralect/stack.svg?style=social&label=Stars)](https://github.com/paralect/node-mongo/stargazers)
[![Follow](https://img.shields.io/twitter/follow/paralect.svg?style=social&label=Follow)](https://twitter.com/paralect)
[![Tweet](https://img.shields.io/twitter/url/https/github.com/paralect/stack.svg?style=social)](https://twitter.com/intent/tweet?text=I%27m%20using%20Stack%20components%20to%20build%20my%20next%20product%20🚀.%20Check%20it%20out:%20https://github.com/paralect/stack)

Node Mongo — is reactive extention to MongoDB API. It provides few usability improvements to the [monk](https://github.com/Automattic/monk). 

## Features

* ️️🚀 **Reactive** fires events as document stored, updated or deleted from database. That helps to keep your database updates for different entities weakly coupled with each other.
* 🔥 **Paging** implements high level paging api
* ⚡️ **Schema validation** based on [joi](https://github.com/hapijs/joi) 

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
//create a service to work with specific database collection
const usersService = db.createService('users');

// find a single document
const user = await usersService.findById('123');

// sample paging
const result = await usersService.find({ name: 'Bob' }, { page: 1, perPage: 30 });
// returns object like this:
// {
//   results: [], // array of user entities
//   pagesCount, // total number of pages
//   count, // total count of documents found by query
// }

//update document
const updatedUser = await usersService.update({ _id: '1'}, (doc) => {
  doc.name = 'Alex';
});

// subscribe to document updates
userService.on('updated', ({ doc, prevDoc }) => {
});
```

Schema declaration (`user.schema.js`):
```javascript
const Joi = require('Joi');

const companySchema = {
  _id: Joi.string(),
  createdOn: Joi.date(),
  name: Joi.string(),
  status: Joi.string().valid('active', 'inactive'),
};

const joiOptions = {};

module.exports = (obj) => Joi.validate(obj, companySchema, joiOptions);
```

Schema validation: 
```javascript
const schema = require('./user.schema')
const usersService = db.createService('users', schema);
```

## Full API Reference

[API Reference](API.md).

## Change Log

This project adheres to [Semantic Versioning](http://semver.org/).
Every release is documented on the Github [Releases](https://github.com/paralect/node-mongo/releases) page.

## License

Node-mongo is released under the [MIT License](LICENSE).

## Contributing

Please read [CONTRIBUTING.md](CONTRIBUTING.md) for details on our code of conduct, and the process for submitting pull requests to us.

## Contributors

Thanks goes to these wonderful people ([emoji key](https://github.com/kentcdodds/all-contributors#emoji-key)):

<!-- ALL-CONTRIBUTORS-LIST:START - Do not remove or modify this section -->
<!-- prettier-ignore -->
| [<img src="https://avatars2.githubusercontent.com/u/6461311?v=4" width="100px;"/><br /><sub><b>Evgeny Zhivitsa</b></sub>](https://github.com/ezhivitsa)<br />[💬](#question-ezhivitsa "Answering Questions") [💻](https://github.com/paralect/ship/commits?author=ezhivitsa "Code") [🎨](#design-ezhivitsa "Design") [📖](https://github.com/paralect/ship/commits?author=ezhivitsa "Documentation") [💡](#example-ezhivitsa "Examples") [🤔](#ideas-ezhivitsa "Ideas, Planning, & Feedback") [👀](#review-ezhivitsa "Reviewed Pull Requests") [⚠️](https://github.com/paralect/ship/commits?author=ezhivitsa "Tests") |
| :---: |
<!-- ALL-CONTRIBUTORS-LIST:END -->

This project follows the [all-contributors](https://github.com/kentcdodds/all-contributors) specification. Contributions of any kind welcome!
