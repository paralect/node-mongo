import { EventEmitter } from 'events';
import {
  MongoClient, MongoClientOptions, Db, DbCollectionOptions, CollectionCreateOptions, MongoError,
} from 'mongodb';
import ServiceOptions from './types/ServiceOptions';
import Service from './service';
import logger from './logger';
import OutboxService from './outbox/outboxService';

const defaultOptions = {
  useNewUrlParser: true,
  useUnifiedTopology: true,
};

class Database extends EventEmitter {
  url: string;

  dbName?: string;

  options: MongoClientOptions;

  private db?: Db;

  connectPromise: Promise<void>;

  connectPromiseResolve?: (value: void) => void;

  private outboxService: OutboxService;

  private client?: MongoClient;

  constructor(url: string, dbName?: string, options?: MongoClientOptions) {
    super();

    this.url = url;
    this.dbName = dbName;
    this.options = {
      ...defaultOptions,
      ...options,
    };

    this.connectPromise = new Promise((res) => { this.connectPromiseResolve = res; });
    this.outboxService = new OutboxService(this.getOrCreateCollection, this.waitForConnection);

    this.db = undefined;
  }

  waitForConnection = async (): Promise<void> => {
    await this.connectPromise;
  };

  connect = async (): Promise<void> => {
    try {
      this.client = await MongoClient.connect(this.url, this.options);
      this.db = this.client.db(this.dbName);

      this.emit('connected');
      logger.info('Connected to mongodb.');
      this.client.on('close', this.onClose);

      if (this.connectPromiseResolve) {
        this.connectPromiseResolve();
      }
    } catch (e) {
      this.emit('error', e);
    }
  };

  close = async (): Promise<void> => {
    if (!this.client) {
      return;
    }
    logger.info('Disconnecting from mongodb.');
    await this.client.close();
  };

  createService<T>(collectionName: string, options?: ServiceOptions | undefined): Service<T> {
    return new Service<T>(
      collectionName,
      options,
      this.outboxService,
      this.waitForConnection,
      this.getOrCreateCollection,
      this.getClient,
    );
  }

  async ping(): Promise<any> {
    await this.waitForConnection();

    if (!this.db) {
      return null;
    }

    return this.db.command({ ping: 1 });
  }

  private onClose(error: any) {
    this.emit('disconnected', error);
  }

  private getOrCreateCollection = async <T>(
    name: string,
    opt: {
      collectionCreateOptions?: CollectionCreateOptions;
      collectionOptions?: DbCollectionOptions;
    },
  ) => {
    await this.waitForConnection();

    if (!this.db) {
      return null;
    }

    try {
      await this.db.createCollection<T>(name, opt.collectionCreateOptions || {});
    } catch (error) {
      if (error instanceof MongoError && error.code === 48) {
        return this.db.collection<T>(name, opt.collectionOptions || {});
      }
      throw error;
    }

    return this.db.collection<T>(name, opt.collectionOptions || {});
  };

  private getClient = async () => {
    await this.connectPromise;
    return this.client;
  };
}

export default Database;
