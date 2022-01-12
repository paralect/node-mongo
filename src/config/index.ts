/* eslint-disable import/extensions */
/* eslint-disable global-require */
import * as _ from 'lodash';

export interface Config {
  env: string,
  mongo: {
    connection: string;
    dbName?: string;
  };
}

const env = 'test';
// eslint-disable-next-line import/no-mutable-exports
let base: Config = {
  env,
  mongo: {
    connection: process.env.TEST_MONGO_URL || 'mongodb://localhost:27017/node-mongo-tests?replicaSet=rs0',
    dbName: 'node-mongo-tests',
  },
};

export const load = (): Config => {
  let resultConfig = base;

  let localConfig = { default: {} };
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    localConfig = require('./local');
    resultConfig = _.merge(resultConfig, localConfig.default);
  // eslint-disable-next-line no-empty
  } catch {}

  return resultConfig;
};

base = load();

export default base;
