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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const chai = __importStar(require("chai"));
const luxon_1 = require("luxon");
const index_1 = require("./index");
require("mocha");
const config_1 = __importDefault(require("./config"));
chai.should();
const { assert } = chai;
const database = new index_1.Database(config_1.default.mongo.connection, config_1.default.mongo.dbName);
const usersService = database.createService('users', {
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
        u === null || u === void 0 ? void 0 : u.fullName.should.be.equal('John');
    });
    it('should throw and error if workspaceId is missing from the query', async () => {
        try {
            await usersService.find({ fullName: 'A' });
            assert.fail('workspaceId is missing, error is not thrown');
            // eslint-disable-next-line no-empty
        }
        catch (err) { }
    });
    it('should set deletedOn date to current JS date on remove', async () => {
        const u = await usersService.create({
            fullName: 'User to remove',
        });
        await usersService.removeSoft({
            _id: u === null || u === void 0 ? void 0 : u._id,
        });
        const updatedUser = await usersService.findOne({
            _id: u === null || u === void 0 ? void 0 : u._id,
        }, { doNotAddDeletedOn: true });
        const nowPlus2Seconds = luxon_1.DateTime
            .utc()
            .plus({ seconds: 1 })
            .toJSDate();
        assert.exists(updatedUser === null || updatedUser === void 0 ? void 0 : updatedUser.deletedOn);
        assert.isTrue((updatedUser === null || updatedUser === void 0 ? void 0 : updatedUser.deletedOn) <= nowPlus2Seconds);
    });
});
