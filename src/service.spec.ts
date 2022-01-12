import * as chai from 'chai';
import { DateTime } from 'luxon';
import { Database } from './index';
import 'mocha';

import config from './config';

chai.should();
const { assert } = chai;

const database = new Database(config.mongo.connection, config.mongo.dbName);

type UserType = {
  _id: string;
  fullName: string;
  deletedOn: Date;
};

const usersService = database.createService<UserType>('users', {
  outbox: false,
});

describe('@copysmith/mongo/service.ts', () => {
  before(async () => {
    await database.connect();
  });
  after(async () => {
    await usersService.remove({}, {
      ackRemove: true,
    });
    await database.close();
  });
  it('should create document', async () => {
    const u = await usersService.create({
      fullName: 'John',
    });

    u?.fullName.should.be.equal('John');
  });

  it('should throw and error if workspaceId is missing from the query', async () => {
    try {
      await usersService.find({ fullName: 'A' });
      assert.fail('workspaceId is missing, error is not thrown');
    // eslint-disable-next-line no-empty
    } catch (err) {}
  });

  it('should set deletedOn date to current JS date on remove', async () => {
    const u = await usersService.create({
      fullName: 'User to remove',
    });

    await usersService.removeSoft({
      _id: u?._id,
    });
    const updatedUser = await usersService.findOne({
      _id: u?._id,
    }, { doNotAddDeletedOn: true });

    const nowPlus2Seconds = DateTime
      .utc()
      .plus({ seconds: 1 })
      .toJSDate();
    assert.exists(updatedUser?.deletedOn);
    assert.isTrue((updatedUser?.deletedOn as Date) <= nowPlus2Seconds);
  });
});
