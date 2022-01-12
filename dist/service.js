"use strict";
var __rest = (this && this.__rest) || function (s, e) {
    var t = {};
    for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p) && e.indexOf(p) < 0)
        t[p] = s[p];
    if (s != null && typeof Object.getOwnPropertySymbols === "function")
        for (var i = 0, p = Object.getOwnPropertySymbols(s); i < p.length; i++) {
            if (e.indexOf(p[i]) < 0 && Object.prototype.propertyIsEnumerable.call(s, p[i]))
                t[p[i]] = s[p[i]];
        }
    return t;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const lodash_1 = require("lodash");
const moment_1 = __importDefault(require("moment"));
const luxon_1 = require("luxon");
const deep_diff_1 = require("deep-diff");
const logger_1 = __importDefault(require("./logger"));
const idGenerator_1 = require("./idGenerator");
const defaultOptions = {
    addCreatedOnField: true,
    addUpdatedOnField: true,
    outbox: false,
    requireDeletedOn: true,
};
const transactionOptions = {
    readPreference: 'primary',
    readConcern: { level: 'local' },
    writeConcern: { w: 1 },
};
class Service {
    constructor(collectionName, options = {}, outboxService, waitForConnection, getOrCreateCollection, getClient) {
        this.validateSchema = async (entity) => {
            if (this.options.schema) {
                const schema = this.options.schema.value;
                try {
                    await schema.validateAsync(entity);
                }
                catch (err) {
                    logger_1.default.error(`Schema is not valid for ${this._collectionName} collection: ${err.stack || err}`, entity);
                    throw err;
                }
            }
        };
        this.addQueryDefaults = (query, options) => {
            if (query.deletedOn) {
                return query;
            }
            if (!this.options.requireDeletedOn) {
                return query;
            }
            if (options.doNotAddDeletedOn) {
                return query;
            }
            query.deletedOn = { $exists: false };
            return query;
        };
        this.validateQuery = (query, options) => {
            // A hook to add query validation
            // Often used to check if some required keys are always in the query
            // e.x. companyId or workspaceId
        };
        this.getCollection = async () => {
            await this.waitForConnection();
            await this.collectionPromise;
            if (!this.collection) {
                throw new Error(`Mongo collection ${this._collectionName} is not initialized.`);
            }
            return this.collection;
        };
        this.findOne = async (query, opt = {}) => {
            const collection = await this.getCollection();
            query = this.addQueryDefaults(query, opt);
            this.validateQuery(query, opt);
            const doc = await collection.findOne(query);
            return doc;
        };
        this.find = async (query, opt = { perPage: 100, page: 0 }) => {
            const collection = await this.getCollection();
            query = this.addQueryDefaults(query, opt);
            this.validateQuery(query, opt);
            const { page, perPage } = opt, options = __rest(opt, ["page", "perPage"]);
            const findOptions = Object.assign({ page,
                perPage }, options);
            const hasPaging = page > 0;
            if (hasPaging) {
                findOptions.skip = (page - 1) * perPage;
                findOptions.limit = perPage;
            }
            const results = await collection
                .find(query, findOptions)
                .toArray();
            const count = await collection.countDocuments(query);
            const pagesCount = Math.ceil(count / perPage) || 1;
            return {
                pagesCount,
                results,
                count,
            };
        };
        this.findAll = async (query, opt) => {
            const collection = await this.getCollection();
            const results = await collection.find(query, opt).toArray();
            return results;
        };
        this.cursor = async (query, opt = {}) => {
            const collection = await this.getCollection();
            const cursor = collection.find(query, opt);
            return cursor;
        };
        this.exists = async (query, options = {}) => {
            const doc = await this.findOne(query, options);
            query = this.addQueryDefaults(query, options);
            this.validateQuery(query, options);
            return !!doc;
        };
        this.countDocuments = async (query, options = {}) => {
            const collection = await this.getCollection();
            query = this.addQueryDefaults(query, options);
            this.validateQuery(query, options);
            const count = await collection.countDocuments(query);
            return count;
        };
        this.update = async (query, updateFn, updateOptions) => {
            const collection = await this.getCollection();
            if (!this.client) {
                return null;
            }
            const doc = await this.findOne(query);
            if (!doc) {
                logger_1.default.warn(`Document not found when updating ${this._collectionName} collection. Request query — ${JSON.stringify(query)}`);
                return null;
            }
            const prevDoc = lodash_1.cloneDeep(doc);
            if (this.options.addUpdatedOnField) {
                doc.updatedOn = moment_1.default().unix();
            }
            await updateFn(doc);
            await this.validateSchema(doc);
            let isUpdated = false;
            const transactionUpdate = async (session) => {
                const updateResult = await collection.updateOne({
                    _id: doc._id,
                }, { $set: doc }, { session });
                isUpdated = updateResult.result.nModified === 1;
                if (isUpdated && this.options.outbox) {
                    await this.outboxService.createEvent(this._collectionName, {
                        type: 'update',
                        data: Object.assign({}, doc),
                        diff: deep_diff_1.diff(prevDoc, doc),
                    }, { session });
                }
            };
            if (updateOptions && updateOptions.session) {
                await transactionUpdate(updateOptions.session);
            }
            else {
                await this.withTransaction(async (session) => {
                    await transactionUpdate(session);
                });
            }
            return isUpdated ? doc : null;
        };
        /**
         * Set deleteOn field and send removed event
         */
        this.removeSoft = async (query, options = {}) => {
            const collection = await this.getCollection();
            query = this.addQueryDefaults(query, options);
            this.validateQuery(query, options);
            if (!this.client) {
                return [];
            }
            const docs = await collection.find(query).toArray();
            const session = this.client.startSession();
            if (docs.length === 0) {
                return [];
            }
            try {
                await session.withTransaction(async () => {
                    if (this.options.outbox) {
                        await this.outboxService.createManyEvents(this._collectionName, docs.map((doc) => ({
                            type: 'remove',
                            entity: this._collectionName,
                            data: doc,
                        })), { session });
                    }
                    const uq = {
                        $set: {
                            deletedOn: luxon_1.DateTime.utc().toJSDate(),
                        },
                    };
                    await this.atomic.updateMany(query, uq, { session });
                }, transactionOptions);
            }
            finally {
                session.endSession();
            }
            return docs;
        };
        this.remove = async (query, options = { ackRemove: false }) => {
            if (!options.ackRemove) {
                throw new Error(`
      All documents stay in the database after they've been removed.
      In most cases you should use removeSoft method that just set deletedOn date.
      If you sure you want to remove completely, please set ackRemove option to true`);
            }
            const collection = await this.getCollection();
            this.validateQuery(query, options);
            if (!this.client) {
                return [];
            }
            const docs = await collection.find(query).toArray();
            const session = this.client.startSession();
            if (docs.length === 0) {
                return [];
            }
            try {
                await session.withTransaction(async () => {
                    if (this.options.outbox) {
                        await this.outboxService.createManyEvents(this._collectionName, docs.map((doc) => ({
                            type: 'remove',
                            entity: this._collectionName,
                            data: doc,
                        })), { session });
                    }
                    await collection.deleteMany(query, { session });
                }, transactionOptions);
            }
            finally {
                session.endSession();
            }
            return docs;
        };
        this.ensureIndex = async (index, options = {}) => {
            const collection = await this.getCollection();
            return collection.createIndex(index, options)
                .catch((err) => {
                logger_1.default.info(err, { collection: this.collectionName });
            });
        };
        this.dropIndexes = async (options) => {
            const collection = await this.getCollection();
            return collection.dropIndexes(options)
                .catch((err) => {
                logger_1.default.info(err);
            });
        };
        this.dropIndex = async (indexName, options) => {
            const collection = await this.getCollection();
            return collection.dropIndex(indexName, options)
                .catch((err) => {
                logger_1.default.info(err);
            });
        };
        this.watch = async (pipeline, options) => {
            const collection = await this.getCollection();
            return collection.watch(pipeline, options);
        };
        this.distinct = async (key, query, options = {}) => {
            const collection = await this.getCollection();
            query = this.addQueryDefaults(query, options);
            this.validateQuery(query, options);
            return collection.distinct(key, query);
        };
        this.aggregate = async (query) => {
            const collection = await this.getCollection();
            return collection.aggregate(query);
        };
        this.atomic = {
            deleteMany: async (query, options = {}) => {
                const collection = await this.getCollection();
                this.validateQuery(query, options);
                const result = await collection.deleteMany(query, options);
                return result;
            },
            insertMany: async (doc, options) => {
                const collection = await this.getCollection();
                const result = await collection.insertMany(doc, options);
                return result;
            },
            updateMany: async (query, update, options = {}) => {
                const collection = await this.getCollection();
                query = this.addQueryDefaults(query, options);
                this.validateQuery(query, options);
                const result = await collection.updateMany(query, update, options);
                return result;
            },
            findOneAndUpdate: async (query, update, options = {}) => {
                const collection = await this.getCollection();
                query = this.addQueryDefaults(query, options);
                this.validateQuery(query, options);
                const result = await collection.findOneAndUpdate(query, update, options);
                return result;
            },
        };
        this.generateId = () => idGenerator_1.generateId();
        this._collectionName = collectionName;
        this.options = Object.assign(Object.assign({}, defaultOptions), options);
        this.waitForConnection = waitForConnection;
        this.outboxService = outboxService;
        this.collectionPromise = new Promise((res) => { this.collectionPromiseResolve = res; });
        getClient()
            .then((client) => {
            this.client = client;
            return getOrCreateCollection(collectionName, {
                collectionCreateOptions: options.collectionCreateOptions || {},
                collectionOptions: options.collectionOptions || {},
            });
        }).then((collection) => {
            if (collection) {
                this.collection = collection;
                if (this.collectionPromiseResolve) {
                    this.collectionPromiseResolve();
                }
            }
        });
    }
    get collectionName() {
        return this._collectionName;
    }
    async create(objects, updateOptions = {}) {
        const collection = await this.getCollection();
        if (!this.client) {
            return null;
        }
        let entities = objects;
        if (!lodash_1.isArray(entities)) {
            entities = [entities];
        }
        await Promise.all(entities.map(async (item) => {
            const entity = item;
            if (!entity._id) {
                entity._id = idGenerator_1.generateId();
            }
            if (!entity.createdOn && this.options.addCreatedOnField) {
                entity.createdOn = moment_1.default().unix();
            }
            if (!entity.updatedOn && this.options.addUpdatedOnField) {
                entity.updatedOn = moment_1.default().unix();
            }
            await this.validateSchema(entity);
        }));
        const createDocuments = async (session) => {
            if (!lodash_1.isArray(entities)) { // ts bug
                return;
            }
            if (this.options.outbox) {
                await this.outboxService.createManyEvents(this._collectionName, entities.map((e) => ({
                    type: 'create',
                    data: e,
                })), { session });
            }
            await collection.insertMany(entities, Object.assign(Object.assign({}, updateOptions), { session }));
        };
        if (updateOptions && updateOptions.session) {
            await createDocuments(updateOptions.session);
        }
        else {
            await this.withTransaction(async (session) => {
                await createDocuments(session);
            });
        }
        return entities.length > 1 ? entities : entities[0];
    }
    async withTransaction(transactionFn) {
        if (!this.client) {
            return;
        }
        const session = this.client.startSession();
        try {
            await session.withTransaction(async () => {
                await transactionFn(session);
            }, transactionOptions);
        }
        catch (error) {
            logger_1.default.error(error.stack || error);
            await session.endSession();
            throw error;
        }
        finally {
            await session.endSession();
        }
    }
}
exports.default = Service;
