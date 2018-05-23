## v1.0.0 (2018-05-23)

* Update dependencies.
* Add tests.
* Fix required version of the Node.js.

### Breaking Changes

* Now, by default, we do not add the fields `createdOn` and` updatedOn` automatically to the model. If you want to save the current behavior, add the appropriate `addCreatedOnField` and` addUpdatedOnField` options to the service definitions.

## v0.3.1 (2017-12-16)

* Stop using deprecated method `ensureIndex` of the `monk`.

## v0.3.0 (2017-10-24)

* Add ability to create custom methods for service and query service.
* Add tests.

## v0.2.0 (2017-10-12)

* Add support of the [joi](https://github.com/hapijs/joi) for validating data schema.
* Add tests for validating of the schema.
