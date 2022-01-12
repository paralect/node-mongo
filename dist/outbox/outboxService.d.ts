import { Collection, CollectionCreateOptions, CollectionInsertManyOptions, CollectionInsertOneOptions, DbCollectionOptions } from 'mongodb';
import OutboxEvent from './outboxEvent';
interface CreateOutboxEventData {
    type: 'create' | 'update' | 'remove';
    data: any;
    diff?: any[];
}
declare class OutboxService {
    private getOrCreateCollection;
    private connectionPromise;
    private connectionPromiseResolve?;
    private collectionsMap;
    constructor(getOrCreateCollection: <T>(name: string, opt: {
        collectionCreateOptions: CollectionCreateOptions;
        collectionOptions: DbCollectionOptions;
    }) => Promise<Collection<T> | null>, waitForConnection: () => Promise<void>);
    private waitForConnection;
    private getCollection;
    createEvent(collectionName: string, data: CreateOutboxEventData, option?: CollectionInsertOneOptions): Promise<OutboxEvent | null>;
    createManyEvents(collectionName: string, data: CreateOutboxEventData[], option?: CollectionInsertManyOptions): Promise<OutboxEvent[] | null>;
}
export default OutboxService;
//# sourceMappingURL=outboxService.d.ts.map