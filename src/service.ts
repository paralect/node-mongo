import { isArray, cloneDeep } from 'lodash';
import moment from 'moment';
import { DateTime } from 'luxon';
import { diff } from 'deep-diff';
import {
  Collection,
  DbCollectionOptions,
  FilterQuery,
  FindOneOptions,
  FindOneAndUpdateOption,
  CollectionInsertManyOptions,
  OptionalId,
  CollectionCreateOptions,
  MongoClient,
  TransactionOptions,
  ChangeStreamOptions,
  ClientSession,
  UpdateQuery,
  UpdateManyOptions,
  CommonOptions,
  IndexOptions,
} from 'mongodb';
import logger from './logger';
import ServiceOptions from './types/ServiceOptions';
import { generateId } from './idGenerator';
import OutboxService from './outbox/outboxService';

const defaultOptions: ServiceOptions = {
  addCreatedOnField: true,
  addUpdatedOnField: true,
  outbox: false,
  requireDeletedOn: true,
};

const transactionOptions: TransactionOptions = {
  readPreference: 'primary',
  readConcern: { level: 'local' },
  writeConcern: { w: 1 },
};

export type Document = {
  _id?: string;
  updatedOn?: number;
  deletedOn?: Date | null;
  createdOn?: number;
};

export type FindResult<T> = {
  /**
   * Array of documents returned by query
   */
  results: T[];
  pagesCount: number;
  count: number;
};

type UpdateOptions = {
  session?: ClientSession;
};

type GeneralRequestOptions = {
  skipQueryValidation?: boolean;
  doNotAddDeletedOn?: boolean;
};

interface FindRequestOptions<T> extends FindOneOptions<T> {
  skipQueryValidation?: boolean;
  page: number;
  perPage: number;
}

class Service<T extends Document> {
  private client?: MongoClient;

  private collection?: Collection<T>;

  private _collectionName: string;

  private options: ServiceOptions;

  private waitForConnection: () => Promise<void>;

  private outboxService: OutboxService;

  private collectionPromise: Promise<void>;

  private collectionPromiseResolve?: (value: void) => void;

  constructor(
    collectionName: string,
    options: ServiceOptions = { },
    outboxService: OutboxService,
    waitForConnection: () => Promise<void>,
    getOrCreateCollection: <T1>(
      name: string,
      opt: {
        collectionCreateOptions: CollectionCreateOptions;
        collectionOptions: DbCollectionOptions;
      },
    ) => Promise<Collection<T1> | null>,
    getClient: () => Promise<MongoClient | undefined>,
  ) {
    this._collectionName = collectionName;
    this.options = {
      ...defaultOptions,
      ...options,
    };
    this.waitForConnection = waitForConnection;
    this.outboxService = outboxService;

    this.collectionPromise = new Promise((res) => { this.collectionPromiseResolve = res; });

    getClient()
      .then((client) => {
        this.client = client;

        return getOrCreateCollection<T>(collectionName, {
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

  public get collectionName() : string {
    return this._collectionName;
  }

  private validateSchema = async (entity: T | Partial<T>) => {
    if (this.options.schema) {
      const schema = this.options.schema.value;
      try {
        await schema.validateAsync(entity);
      } catch (err: any) {
        logger.error(`Schema is not valid for ${this._collectionName} collection: ${err.stack || err}`, entity);
        throw err;
      }
    }
  };

  private addQueryDefaults = (
    query: FilterQuery<T>, options: GeneralRequestOptions,
  ): FilterQuery<T> => {
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

  private validateQuery = (query: any, options: GeneralRequestOptions) => {
    // A hook to add query validation
    // Often used to check if some required keys are always in the query
    // e.x. companyId or workspaceId
  };

  private getCollection = async (): Promise<Collection<T>> => {
    await this.waitForConnection();
    await this.collectionPromise;
    if (!this.collection) {
      throw new Error(`Mongo collection ${this._collectionName} is not initialized.`);
    }

    return this.collection;
  };

  findOne = async (query: FilterQuery<T>, opt: GeneralRequestOptions = { }): Promise<T | null> => {
    const collection = await this.getCollection();

    query = this.addQueryDefaults(query, opt);
    this.validateQuery(query, opt);

    const doc = await collection.findOne(query);
    return doc;
  };

  find = async (
    query: FilterQuery<T>,
    opt: FindRequestOptions<T extends T ? T: T> = { perPage: 100, page: 0 },
  ): Promise<FindResult<T>> => {
    const collection = await this.getCollection();

    query = this.addQueryDefaults(query, opt);
    this.validateQuery(query, opt);

    const {
      page,
      perPage,
      ...options
    } = opt;

    const findOptions: Record<string, unknown> = {
      page,
      perPage,
      ...options,
    };
    const hasPaging = page > 0;
    if (hasPaging) {
      findOptions.skip = (page - 1) * perPage;
      findOptions.limit = perPage;
    }

    const results = await collection
      .find<T>(query, findOptions)
      .toArray();
    const count = await collection.countDocuments(query);
    const pagesCount = Math.ceil(count / perPage) || 1;

    return {
      pagesCount,
      results,
      count,
    };
  };

  findAll = async (
    query: FilterQuery<T>,
    opt: FindOneOptions<T extends T ? T : T>,
  ): Promise<T[]> => {
    const collection = await this.getCollection();
    const results = await collection.find<T>(query, opt).toArray();
    return results;
  };

  cursor = async (
    query: FilterQuery<T>, opt: FindOneOptions<T extends T ? T : T> = {},
  ): Promise<any> => {
    const collection = await this.getCollection();
    const cursor = collection.find<T>(query, opt);

    return cursor;
  };

  exists = async (query: FilterQuery<T>, options: GeneralRequestOptions = {}): Promise<boolean> => {
    const doc = await this.findOne(query, options);
    query = this.addQueryDefaults(query, options);
    this.validateQuery(query, options);

    return !!doc;
  };

  countDocuments = async (
    query: FilterQuery<T>, options: GeneralRequestOptions = {},
  ): Promise<number> => {
    const collection = await this.getCollection();
    query = this.addQueryDefaults(query, options);
    this.validateQuery(query, options);

    const count = await collection.countDocuments(query);
    return count;
  };

  async create(object: Partial<T>, updateOptions?: UpdateOptions): Promise<T | null>;
  async create(objects: Partial<T>[], updateOptions?: UpdateOptions): Promise<T[] | null>;
  async create(
    objects: Partial<T>[] | Partial<T>,
    updateOptions: CollectionInsertManyOptions & UpdateOptions = {},
  ): Promise<T[] | T | null> {
    const collection = await this.getCollection();
    if (!this.client) {
      return null;
    }

    let entities = objects;
    if (!isArray(entities)) {
      entities = [entities];
    }

    await Promise.all(entities.map(async (item: Partial<T>) => {
      const entity = item;
      if (!entity._id) {
        entity._id = generateId();
      }

      if (!entity.createdOn && this.options.addCreatedOnField) {
        entity.createdOn = moment().unix();
      }
      if (!entity.updatedOn && this.options.addUpdatedOnField) {
        entity.updatedOn = moment().unix();
      }

      await this.validateSchema(entity);
    }));

    const createDocuments = async (session: ClientSession): Promise<void> => {
      if (!isArray(entities)) { // ts bug
        return;
      }

      if (this.options.outbox) {
        await this.outboxService.createManyEvents(this._collectionName, entities.map((e) => ({
          type: 'create',
          data: e,
        })), { session });
      }

      await collection.insertMany(entities as OptionalId<T>[], { ...updateOptions, session });
    };

    if (updateOptions && updateOptions.session) {
      await createDocuments(updateOptions.session);
    } else {
      await this.withTransaction(async (session) => {
        await createDocuments(session);
      });
    }

    return entities.length > 1 ? entities as T[] : entities[0] as T;
  }

  update = async (
    query: FilterQuery<T>,
    updateFn: (doc: T) => void, updateOptions?: UpdateOptions,
  ): Promise<T | null> => {
    const collection = await this.getCollection();
    if (!this.client) {
      return null;
    }

    const doc = await this.findOne(query);
    if (!doc) {
      logger.warn(`Document not found when updating ${this._collectionName} collection. Request query — ${JSON.stringify(query)}`);
      return null;
    }

    const prevDoc = cloneDeep(doc);
    if (this.options.addUpdatedOnField) {
      doc.updatedOn = moment().unix();
    }

    await updateFn(doc);
    await this.validateSchema(doc);

    let isUpdated = false;

    const transactionUpdate = async (session: ClientSession) => {
      const updateResult = await collection.updateOne({
        _id: doc._id,
      } as FilterQuery<T>, { $set: doc }, { session });
      isUpdated = updateResult.result.nModified === 1;

      if (isUpdated && this.options.outbox) {
        await this.outboxService.createEvent(this._collectionName, {
          type: 'update',
          data: {
            ...doc,
          },
          diff: diff(prevDoc, doc),
        }, { session });
      }
    };

    if (updateOptions && updateOptions.session) {
      await transactionUpdate(updateOptions.session);
    } else {
      await this.withTransaction(async (session) => {
        await transactionUpdate(session);
      });
    }

    return isUpdated ? doc : null;
  };

  /**
   * Set deleteOn field and send removed event
   */
  removeSoft = async (query: FilterQuery<T>, options: GeneralRequestOptions = {}): Promise<T[]> => {
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
          await this.outboxService.createManyEvents(this._collectionName, docs.map((doc: any) => ({
            type: 'remove',
            entity: this._collectionName,
            data: doc,
          })), { session });
        }

        const uq: UpdateQuery<any> = {
          $set: {
            deletedOn: DateTime.utc().toJSDate(),
          },
        };

        await this.atomic.updateMany(query, uq, { session });
      }, transactionOptions);
    } finally {
      session.endSession();
    }

    return docs;
  };

  remove = async (
    query: FilterQuery<T>,
    options: GeneralRequestOptions & { ackRemove: boolean } = { ackRemove: false },
  ): Promise<T[]> => {
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
          await this.outboxService.createManyEvents(this._collectionName, docs.map((doc: any) => ({
            type: 'remove',
            entity: this._collectionName,
            data: doc,
          })), { session });
        }

        await collection.deleteMany(query, { session });
      }, transactionOptions);
    } finally {
      session.endSession();
    }

    return docs;
  };

  ensureIndex = async (
    index: Record<string, number | string>,
    options: IndexOptions = {},
  ): Promise<string | void> => {
    const collection = await this.getCollection();

    return collection.createIndex(index, options)
      .catch((err: any) => {
        logger.info(err, { collection: this.collectionName });
      });
  };

  dropIndexes = async (
    options?: {
      session?: ClientSession | undefined;
      maxTimeMS?: number | undefined; } | undefined,
  ): Promise<void | string> => {
    const collection = await this.getCollection();

    return collection.dropIndexes(options)
      .catch((err: any) => {
        logger.info(err);
      });
  };

  dropIndex = async (
    indexName: string,
    options?: { session?: ClientSession | undefined; maxTimeMS?: number | undefined; } | undefined,
  ): Promise<void | string> => {
    const collection = await this.getCollection();

    return collection.dropIndex(indexName, options)
      .catch((err: any) => {
        logger.info(err);
      });
  };

  watch = async (
    pipeline: any[] | undefined,
    options?: ChangeStreamOptions & { session: ClientSession },
  ): Promise<any> => {
    const collection = await this.getCollection();

    return collection.watch(pipeline, options);
  };

  distinct = async (
    key: string, query: FilterQuery<T>,
    options: GeneralRequestOptions = {},
  ): Promise<any> => {
    const collection = await this.getCollection();
    query = this.addQueryDefaults(query, options);
    this.validateQuery(query, options);

    return collection.distinct(key, query);
  };

  aggregate = async (query: any[]): Promise<any> => {
    const collection = await this.getCollection();
    return collection.aggregate(query);
  };

  atomic = {
    deleteMany: async (
      query: FilterQuery<T>,
      options: CommonOptions & GeneralRequestOptions = {},
    ): Promise<any> => {
      const collection = await this.getCollection();
      this.validateQuery(query, options);

      const result = await collection.deleteMany(query, options);
      return result;
    },
    insertMany: async (
      doc: OptionalId<T>[], options?: CollectionInsertManyOptions,
    ): Promise<any> => {
      const collection = await this.getCollection();

      const result = await collection.insertMany(doc, options);
      return result;
    },
    updateMany: async (
      query: FilterQuery<T>,
      update: Partial<T> | UpdateQuery<T>,
      options: UpdateManyOptions & GeneralRequestOptions = {},
    ): Promise<any> => {
      const collection = await this.getCollection();
      query = this.addQueryDefaults(query, options);
      this.validateQuery(query, options);

      const result = await collection.updateMany(query, update, options);
      return result;
    },
    findOneAndUpdate: async (
      query: FilterQuery<T>,
      update: T | UpdateQuery<T>,
      options: FindOneAndUpdateOption<T> & GeneralRequestOptions = {},
    ): Promise<any> => {
      const collection = await this.getCollection();
      query = this.addQueryDefaults(query, options);
      this.validateQuery(query, options);

      const result = await collection.findOneAndUpdate(query, update, options);
      return result;
    },
  };

  generateId = () => generateId();

  async withTransaction(transactionFn: (session: ClientSession) => void): Promise<any> {
    if (!this.client) {
      return;
    }

    const session = this.client.startSession();

    try {
      await session.withTransaction(async () => {
        await transactionFn(session);
      }, transactionOptions);
    } catch (error: any) {
      logger.error(error.stack || error);
      await session.endSession();
      throw error;
    } finally {
      await session.endSession();
    }
  }
}

export default Service;
