/// <reference types="node" />
import { EventEmitter } from 'events';
import { MongoClientOptions } from 'mongodb';
import ServiceOptions from './types/ServiceOptions';
import Service from './service';
declare class Database extends EventEmitter {
    url: string;
    dbName?: string;
    options: MongoClientOptions;
    private db?;
    connectPromise: Promise<void>;
    connectPromiseResolve?: (value: void) => void;
    private outboxService;
    private client?;
    constructor(url: string, dbName?: string, options?: MongoClientOptions);
    waitForConnection: () => Promise<void>;
    connect: () => Promise<void>;
    close: () => Promise<void>;
    createService<T>(collectionName: string, options?: ServiceOptions | undefined): Service<T>;
    ping(): Promise<any>;
    private onClose;
    private getOrCreateCollection;
    private getClient;
}
export default Database;
//# sourceMappingURL=database.d.ts.map