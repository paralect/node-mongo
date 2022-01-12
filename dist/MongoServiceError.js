"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
class MongoServiceError extends Error {
    constructor(code, message, error) {
        super(message);
        Error.captureStackTrace(this, this.constructor);
        this.name = this.constructor.name;
        this.code = code;
        this.error = error;
    }
}
MongoServiceError.NOT_FOUND = 'NOT_FOUND';
MongoServiceError.INVALID_SCHEMA = 'INVALID_SCHEMA';
MongoServiceError.MORE_THAN_ONE = 'MORE_THAN_ONE';
exports.default = MongoServiceError;
