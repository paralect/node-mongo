class MongoServiceError extends Error {
  constructor(code, message, error) {
    super(message);
    this.name = 'MongoServiceError';
    this.code = code;
    this.error = error;
  }
}

MongoServiceError.NOT_FOUND = 'NOT_FOUND';
MongoServiceError.MORE_THAN_ONE = 'MORE_THAN_ONE';
MongoServiceError.INVALID_SCHEMA = 'INVALID_SCHEMA';
MongoServiceError.INVALID_ARGUMENT = 'INVALID_ARGUMENT';

module.exports = MongoServiceError;
