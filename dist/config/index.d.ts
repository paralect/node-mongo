export interface Config {
    env: string;
    mongo: {
        connection: string;
        dbName?: string;
    };
}
declare let base: Config;
export declare const load: () => Config;
export default base;
//# sourceMappingURL=index.d.ts.map