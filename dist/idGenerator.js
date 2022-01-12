"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateId = void 0;
const mongodb_1 = require("mongodb");
const generateId = () => {
    const objectId = new mongodb_1.ObjectID();
    return objectId.toHexString();
};
exports.generateId = generateId;
