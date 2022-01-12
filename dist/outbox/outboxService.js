"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const moment_1 = __importDefault(require("moment"));
const idGenerator_1 = require("../idGenerator");
class OutboxService {
    constructor(getOrCreateCollection, waitForConnection) {
        this.collectionsMap = {};
        this.getCollection = async (collectionName) => {
            if (this.collectionsMap[collectionName]) {
                return this.collectionsMap[collectionName];
            }
            const name = `${collectionName}_outbox`;
            const collection = await this.getOrCreateCollection(name, { collectionCreateOptions: {}, collectionOptions: {} });
            this.collectionsMap[collectionName] = collection;
            return collection;
        };
        this.connectionPromise = new Promise((res) => { this.connectionPromiseResolve = res; });
        waitForConnection().then(() => {
            if (this.connectionPromiseResolve) {
                this.connectionPromiseResolve();
            }
        });
        this.getOrCreateCollection = getOrCreateCollection;
    }
    async waitForConnection() {
        await this.connectionPromise;
    }
    async createEvent(collectionName, data, option) {
        await this.waitForConnection();
        const collection = await this.getCollection(collectionName);
        if (!collection) {
            return null;
        }
        const event = Object.assign({ _id: idGenerator_1.generateId(), createdOn: moment_1.default().valueOf() }, data);
        await collection.insertOne(event, option);
        return event;
    }
    async createManyEvents(collectionName, data, option) {
        await this.waitForConnection();
        const collection = await this.getCollection(collectionName);
        if (!collection) {
            return null;
        }
        const events = data.map((e) => (Object.assign({ _id: idGenerator_1.generateId(), createdOn: moment_1.default().valueOf() }, e)));
        await collection.insertMany(events, option);
        return events;
    }
}
exports.default = OutboxService;
