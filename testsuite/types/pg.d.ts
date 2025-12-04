declare module 'pg' {
    interface QueryResult<Row = any> {
        rowCount: number;
        rows: Row[];
    }

    interface ClientConfig {
        host?: string;
        port?: number;
        database?: string;
        user?: string;
        password?: string;

        [key: string]: any;
    }

    export class Client {
        constructor(config?: ClientConfig);

        connect(): Promise<void>;

        query<Row = any>(queryText: string, values?: any[]): Promise<QueryResult<Row>>;

        end(): Promise<void>;
    }

    // Error type used in permission checks
    export class InsufficientPrivilege extends Error {
    }
}
