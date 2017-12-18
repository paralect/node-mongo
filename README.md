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

See the detailed [API Reference](https://github.com/paralect/node-mongo/blob/master/API.md).

## LICENCE

MIT
