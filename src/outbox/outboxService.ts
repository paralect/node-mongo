import { DateTime } from 'luxon';
import {
  Collection,
  CreateCollectionOptions,
  InsertOneOptions,
  BulkWriteOptions,
  CollectionOptions,
} from 'mongodb';
import { generateId } from '../idGenerator';
import OutboxEvent from './outboxEvent';

export type EventType = 'create' | 'update' | 'remove';

export interface CreateOutboxEventData {
  type: EventType;
  data: any;
  diff?: any[];
}

class OutboxService {
  private getOrCreateCollection: <T>(
    name: string,
    opt: {
      collectionCreateOptions: CreateCollectionOptions; collectionOptions: CollectionOptions,
    },
  ) => Promise<Collection<T> | null>;

  private connectionPromise: Promise<void>;

  private connectionPromiseResolve?: (value: void) => void;

  private collectionsMap: { [key: string]: Collection<OutboxEvent> | null } = {};

  constructor(
    getOrCreateCollection: <T>(
      name: string,
      opt: {
        collectionCreateOptions: CreateCollectionOptions;
        collectionOptions: CollectionOptions,
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
    option: InsertOneOptions = {},
  ): Promise<OutboxEvent | null> {
    await this.waitForConnection();
    const collection = await this.getCollection(collectionName);
    if (!collection) {
      return null;
    }

    const event: OutboxEvent = {
      _id: generateId(),
      createdOn: DateTime.utc().toJSDate(),
      ...data,
    };

    await collection.insertOne(event, option);

    return event;
  }

  async createManyEvents(
    collectionName: string,
    data: CreateOutboxEventData[],
    option: BulkWriteOptions = {},
  ): Promise<OutboxEvent[] | null> {
    await this.waitForConnection();
    const collection = await this.getCollection(collectionName);
    if (!collection) {
      return null;
    }

    const events: OutboxEvent[] = data.map((e) => ({
      _id: generateId(),
      createdOn: DateTime.utc().toJSDate(),
      ...e,
    }));

    await collection.insertMany(events, option);

    return events;
  }
}

export default OutboxService;
