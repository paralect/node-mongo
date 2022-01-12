"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    Object.defineProperty(o, k2, { enumerable: true, get: function() { return m[k]; } });
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.load = void 0;
/* eslint-disable import/extensions */
/* eslint-disable global-require */
const _ = __importStar(require("lodash"));
const env = 'test';
// eslint-disable-next-line import/no-mutable-exports
let base = {
    env,
    mongo: {
        connection: process.env.TEST_MONGO_URL || 'mongodb://localhost:27017/node-mongo-tests?replicaSet=rs0',
        dbName: 'node-mongo-tests',
    },
};
const load = () => {
    let resultConfig = base;
    let localConfig = { default: {} };
    try {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        localConfig = require('./local');
        resultConfig = _.merge(resultConfig, localConfig.default);
        // eslint-disable-next-line no-empty
    }
    catch (_a) { }
    return resultConfig;
};
exports.load = load;
base = exports.load();
exports.default = base;
