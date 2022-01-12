import { Collection, DbCollectionOptions, FilterQuery, FindOneOptions, FindOneAndUpdateOption, CollectionInsertManyOptions, OptionalId, CollectionCreateOptions, MongoClient, ChangeStreamOptions, ClientSession, UpdateQuery, UpdateManyOptions, CommonOptions, IndexOptions } from 'mongodb';
import ServiceOptions from './types/ServiceOptions';
import OutboxService from './outbox/outboxService';
export declare type Document = {
    _id?: string;
    updatedOn?: number;
    deletedOn?: Date | null;
    createdOn?: number;
};
export declare type FindResult<T> = {
    /**
     * Array of documents returned by query
     */
    results: T[];
    pagesCount: number;
    count: number;
};
declare type UpdateOptions = {
    session?: ClientSession;
};
declare type GeneralRequestOptions = {
    skipQueryValidation?: boolean;
    doNotAddDeletedOn?: boolean;
};
interface FindRequestOptions<T> extends FindOneOptions<T> {
    skipQueryValidation?: boolean;
    page: number;
    perPage: number;
}
declare class Service<T extends Document> {
    private client?;
    private collection?;
    private _collectionName;
    private options;
    private waitForConnection;
    private outboxService;
    private collectionPromise;
    private collectionPromiseResolve?;
    constructor(collectionName: string, options: ServiceOptions | undefined, outboxService: OutboxService, waitForConnection: () => Promise<void>, getOrCreateCollection: <T1>(name: string, opt: {
        collectionCreateOptions: CollectionCreateOptions;
        collectionOptions: DbCollectionOptions;
    }) => Promise<Collection<T1> | null>, getClient: () => Promise<MongoClient | undefined>);
    get collectionName(): string;
    private validateSchema;
    private addQueryDefaults;
    private validateQuery;
    private getCollection;
    findOne: (query: FilterQuery<T>, opt?: GeneralRequestOptions) => Promise<T | null>;
    find: (query: FilterQuery<T>, opt?: FindRequestOptions<T extends T ? T : T>) => Promise<FindResult<T>>;
    findAll: (query: FilterQuery<T>, opt: FindOneOptions<T extends T ? T : T>) => Promise<T[]>;
    cursor: (query: FilterQuery<T>, opt?: FindOneOptions<T extends T ? T : T>) => Promise<any>;
    exists: (query: FilterQuery<T>, options?: GeneralRequestOptions) => Promise<boolean>;
    countDocuments: (query: FilterQuery<T>, options?: GeneralRequestOptions) => Promise<number>;
    create(object: Partial<T>, updateOptions?: UpdateOptions): Promise<T | null>;
    create(objects: Partial<T>[], updateOptions?: UpdateOptions): Promise<T[] | null>;
    update: (query: FilterQuery<T>, updateFn: (doc: T) => void, updateOptions?: UpdateOptions | undefined) => Promise<T | null>;
    /**
     * Set deleteOn field and send removed event
     */
    removeSoft: (query: FilterQuery<T>, options?: GeneralRequestOptions) => Promise<T[]>;
    remove: (query: FilterQuery<T>, options?: GeneralRequestOptions & {
        ackRemove: boolean;
    }) => Promise<T[]>;
    ensureIndex: (index: Record<string, number | string>, options?: IndexOptions) => Promise<string | void>;
    dropIndexes: (options?: {
        session?: ClientSession | undefined;
        maxTimeMS?: number | undefined;
    } | undefined) => Promise<void | string>;
    dropIndex: (indexName: string, options?: {
        session?: ClientSession | undefined;
        maxTimeMS?: number | undefined;
    } | undefined) => Promise<void | string>;
    watch: (pipeline: any[] | undefined, options?: (ChangeStreamOptions & {
        session: ClientSession;
    }) | undefined) => Promise<any>;
    distinct: (key: string, query: FilterQuery<T>, options?: GeneralRequestOptions) => Promise<any>;
    aggregate: (query: any[]) => Promise<any>;
    atomic: {
        deleteMany: (query: FilterQuery<T>, options?: CommonOptions & GeneralRequestOptions) => Promise<any>;
        insertMany: (doc: OptionalId<T>[], options?: CollectionInsertManyOptions | undefined) => Promise<any>;
        updateMany: (query: FilterQuery<T>, update: Partial<T> | UpdateQuery<T>, options?: UpdateManyOptions & GeneralRequestOptions) => Promise<any>;
        findOneAndUpdate: (query: FilterQuery<T>, update: T | UpdateQuery<T>, options?: FindOneAndUpdateOption<T> & GeneralRequestOptions) => Promise<any>;
    };
    generateId: () => string;
    withTransaction(transactionFn: (session: ClientSession) => void): Promise<any>;
}
export default Service;
//# sourceMappingURL=service.d.ts.map