"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const events_1 = require("events");
const mongodb_1 = require("mongodb");
const service_1 = __importDefault(require("./service"));
const logger_1 = __importDefault(require("./logger"));
const outboxService_1 = __importDefault(require("./outbox/outboxService"));
const defaultOptions = {
    useNewUrlParser: true,
    useUnifiedTopology: true,
};
class Database extends events_1.EventEmitter {
    constructor(url, dbName, options) {
        super();
        this.waitForConnection = async () => {
            await this.connectPromise;
        };
        this.connect = async () => {
            try {
                this.client = await mongodb_1.MongoClient.connect(this.url, this.options);
                this.db = this.client.db(this.dbName);
                this.emit('connected');
                logger_1.default.info('Connected to mongodb.');
                this.client.on('close', this.onClose);
                if (this.connectPromiseResolve) {
                    this.connectPromiseResolve();
                }
            }
            catch (e) {
                this.emit('error', e);
            }
        };
        this.close = async () => {
            if (!this.client) {
                return;
            }
            logger_1.default.info('Disconnecting from mongodb.');
            await this.client.close();
        };
        this.getOrCreateCollection = async (name, opt) => {
            await this.waitForConnection();
            if (!this.db) {
                return null;
            }
            try {
                await this.db.createCollection(name, opt.collectionCreateOptions || {});
            }
            catch (error) {
                if (error instanceof mongodb_1.MongoError && error.code === 48) {
                    return this.db.collection(name, opt.collectionOptions || {});
                }
                throw error;
            }
            return this.db.collection(name, opt.collectionOptions || {});
        };
        this.getClient = async () => {
            await this.connectPromise;
            return this.client;
        };
        this.url = url;
        this.dbName = dbName;
        this.options = Object.assign(Object.assign({}, defaultOptions), options);
        this.connectPromise = new Promise((res) => { this.connectPromiseResolve = res; });
        this.outboxService = new outboxService_1.default(this.getOrCreateCollection, this.waitForConnection);
        this.db = undefined;
    }
    createService(collectionName, options) {
        return new service_1.default(collectionName, options, this.outboxService, this.waitForConnection, this.getOrCreateCollection, this.getClient);
    }
    async ping() {
        await this.waitForConnection();
        if (!this.db) {
            return null;
        }
        return this.db.command({ ping: 1 });
    }
    onClose(error) {
        this.emit('disconnected', error);
    }
}
exports.default = Database;
