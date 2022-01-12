import { ObjectSchema } from 'joi';
import { DbCollectionOptions, CollectionCreateOptions } from 'mongodb';
interface EntitySchema {
    value: ObjectSchema;
}
export default interface ServiceOptions {
    addCreatedOnField?: boolean;
    addUpdatedOnField?: boolean;
    outbox?: boolean;
    schema?: EntitySchema;
    collectionOptions?: DbCollectionOptions;
    collectionCreateOptions?: CollectionCreateOptions;
    requireDeletedOn?: boolean;
}
export {};
//# sourceMappingURL=ServiceOptions.d.ts.map