import moment from 'moment';
import {
  Collection,
  CollectionCreateOptions,
  CollectionInsertManyOptions,
  CollectionInsertOneOptions,
  DbCollectionOptions,
} from 'mongodb';
import { generateId } from '../idGenerator';
import OutboxEvent from './outboxEvent';

interface CreateOutboxEventData {
  type: 'create' | 'update' | 'remove';
  data: any;
  diff?: any[];
}

class OutboxService {
  private getOrCreateCollection: <T>(
    name: string,
    opt: {
      collectionCreateOptions: CollectionCreateOptions; collectionOptions: DbCollectionOptions,
    },
  ) => Promise<Collection<T> | null>;

  private connectionPromise: Promise<void>;

  private connectionPromiseResolve?: (value: void) => void;

  private collectionsMap: { [key: string]: Collection<OutboxEvent> | null } = {};

  constructor(
    getOrCreateCollection: <T>(
      name: string,
      opt: {
        collectionCreateOptions: CollectionCreateOptions;
        collectionOptions: DbCollectionOptions,
      },
    ) => Promise<Collection<T> | null>,
    waitForConnection: () => Promise<void>,
  ) {
    this.connectionPromise = new Promise((res) => { this.connectionPromiseResolve = res; });

    waitForConnection().then(() => {
      if (this.connectionPromiseResolve) {
        this.connectionPromiseResolve();
      }
    });

    this.getOrCreateCollection = getOrCreateCollection;
  }

  private async waitForConnection() {
    await this.connectionPromise;
  }

  private getCollection = async (collectionName: string) => {
    if (this.collectionsMap[collectionName]) {
      return this.collectionsMap[collectionName];
    }

    const name = `${collectionName}_outbox`;

    const collection = await this.getOrCreateCollection<OutboxEvent>(
      name, { collectionCreateOptions: {}, collectionOptions: {} },
    );

    this.collectionsMap[collectionName] = collection;

    return collection;
  };

  async createEvent(
    collectionName: string,
    data: CreateOutboxEventData,
    option?: CollectionInsertOneOptions,
  ): Promise<OutboxEvent | null> {
    await this.waitForConnection();
    const collection = await this.getCollection(collectionName);
    if (!collection) {
      return null;
    }

    const event: OutboxEvent = {
      _id: generateId(),
      createdOn: moment().valueOf(),
      ...data,
    };

    await collection.insertOne(event, option);

    return event;
  }

  async createManyEvents(
    collectionName: string,
    data: CreateOutboxEventData[],
    option?: CollectionInsertManyOptions,
  ): Promise<OutboxEvent[] | null> {
    await this.waitForConnection();
    const collection = await this.getCollection(collectionName);
    if (!collection) {
      return null;
    }

    const events: OutboxEvent[] = data.map((e) => ({
      _id: generateId(),
      createdOn: moment().valueOf(),
      ...e,
    }));

    await collection.insertMany(events, option);

    return events;
  }
}

export default OutboxService;
