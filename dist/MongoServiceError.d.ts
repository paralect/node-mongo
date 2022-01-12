declare class MongoServiceError extends Error {
    static NOT_FOUND: string;
    static INVALID_SCHEMA: string;
    static MORE_THAN_ONE: string;
    name: string;
    code: string;
    error: any;
    constructor(code: string, message: string, error?: any);
}
export default MongoServiceError;
//# sourceMappingURL=MongoServiceError.d.ts.map