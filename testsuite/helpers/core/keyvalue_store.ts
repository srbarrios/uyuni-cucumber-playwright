// Copyright (c) 2025 SUSE LLC.
// Licensed under the terms of the MIT license.

import {createClient, RedisClientType} from 'redis';

export interface KeyValueStoreConfig {
    host: string;
    port: number;
    username: string;
    password: string;
    database?: number;
}

/**
 * Key-Value Store to interact with a NoSQL database (Redis)
 */
export class KeyValueStore {
    private client: RedisClientType;
    private isConnected: boolean = false;

    /**
     * Initialize a connection with a NoSQL database
     * @param host The hostname of the NoSQL database
     * @param port The port of the NoSQL database
     * @param username The username to authenticate with the NoSQL database
     * @param password The password to authenticate with the NoSQL database
     */
    constructor(host: string, port: number, username: string, password: string) {
        this.validateConnectionParams(host, port, username, password);

        try {
            this.client = createClient({
                socket: {
                    host,
                    port
                },
                username,
                password,
                // Disable offline queue to handle commands before connection is established
                disableOfflineQueue: true
            });

            // Set up error handling
            this.client.on('error', (error) => {
                console.error('Redis Client Error:', error);
            });

            this.client.on('connect', () => {
                console.log('Connected to Redis');
                this.isConnected = true;
            });

            this.client.on('disconnect', () => {
                console.log('Disconnected from Redis');
                this.isConnected = false;
            });

        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            console.warn(`Error initializing KeyValueStore:\n ${errorMessage}`);
            throw error;
        }
    }

    /**
     * Connect to the Redis database
     */
    async connect(): Promise<void> {
        try {
            if (!this.isConnected) {
                await this.client.connect();
                this.isConnected = true;
            }
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            console.warn(`Error connecting to KeyValueStore:\n ${errorMessage}`);
            throw error;
        }
    }

    /**
     * Close the connection with the NoSQL database
     */
    async close(): Promise<void> {
        try {
            if (this.isConnected) {
                await this.client.quit();
                this.isConnected = false;
            }
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            console.warn(`Error closing KeyValueStore:\n ${errorMessage}`);
            throw error;
        }
    }

    /**
     * Add a key-value pair to a Set
     * @param key The key to add the value to
     * @param value The value to add to the key
     * @param database Optional: The database number to select (default: 0)
     * @returns Promise with the number of elements added to the set
     */
    async add(key: string, value: string, database: number = 0): Promise<number> {
        await this.ensureConnection();

        try {
            await this.client.select(database);
            return await this.client.sAdd(key, value);
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            console.warn(`Error adding a key-value:\n ${errorMessage}`);
            throw error;
        }
    }

    /**
     * Get the value of a key
     * @param key The key to get the value from
     * @param database Optional: The database number to select (default: 0)
     * @returns Promise with an array of values in the set
     */
    async get(key: string, database: number = 0): Promise<string[]> {
        await this.ensureConnection();

        try {
            await this.client.select(database);
            return await this.client.sMembers(key);
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            console.warn(`Error getting a key-value:\n ${errorMessage}`);
            throw error;
        }
    }

    /**
     * Remove a key-value pair from a Set
     * @param key The key to remove the value from
     * @param value The value to remove from the key
     * @param database Optional: The database number to select (default: 0)
     * @returns Promise with the number of members that were successfully removed
     */
    async remove(key: string, value: string, database: number = 0): Promise<number> {
        await this.ensureConnection();

        try {
            await this.client.select(database);
            return await this.client.sRem(key, value);
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            console.warn(`Error removing a key-value:\n ${errorMessage}`);
            throw error;
        }
    }

    /**
     * Check if a value exists in a set
     * @param key The key to check
     * @param value The value to check for
     * @param database Optional: The database number to select (default: 0)
     * @returns Promise with boolean indicating if value exists in set
     */
    async exists(key: string, value: string, database: number = 0): Promise<boolean> {
        await this.ensureConnection();

        try {
            await this.client.select(database);
            const result = await this.client.sIsMember(key, value);
            return Boolean(result);
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            console.warn(`Error checking key-value existence:\n ${errorMessage}`);
            throw error;
        }
    }

    /**
     * Get the number of elements in a set
     * @param key The key to check
     * @param database Optional: The database number to select (default: 0)
     * @returns Promise with the number of elements in the set
     */
    async count(key: string, database: number = 0): Promise<number> {
        await this.ensureConnection();

        try {
            await this.client.select(database);
            return await this.client.sCard(key);
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            console.warn(`Error counting key-values:\n ${errorMessage}`);
            throw error;
        }
    }

    /**
     * Delete a key entirely
     * @param key The key to delete
     * @param database Optional: The database number to select (default: 0)
     * @returns Promise with the number of keys deleted
     */
    async deleteKey(key: string, database: number = 0): Promise<number> {
        await this.ensureConnection();

        try {
            await this.client.select(database);
            return await this.client.del(key);
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            console.warn(`Error deleting key:\n ${errorMessage}`);
            throw error;
        }
    }

    /**
     * Get all keys matching a pattern
     * @param pattern The pattern to match (e.g., "user:*")
     * @param database Optional: The database number to select (default: 0)
     * @returns Promise with array of matching keys
     */
    async getKeys(pattern: string = '*', database: number = 0): Promise<string[]> {
        await this.ensureConnection();

        try {
            await this.client.select(database);
            return await this.client.keys(pattern);
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            console.warn(`Error getting keys:\n ${errorMessage}`);
            throw error;
        }
    }

    /**
     * Check if the client is connected
     * @returns Boolean indicating connection status
     */
    isClientConnected(): boolean {
        return this.isConnected;
    }

    /**
     * Ping the Redis server
     * @returns Promise with pong response
     */
    async ping(): Promise<string> {
        await this.ensureConnection();

        try {
            return await this.client.ping();
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            console.warn(`Error pinging Redis:\n ${errorMessage}`);
            throw error;
        }
    }

    /**
     * Validate connection parameters
     */
    private validateConnectionParams(host: string, port: number, username: string, password: string): void {
        if (!host || host.trim() === '') {
            throw new Error('Database host is required');
        }

        if (!port || port <= 0) {
            throw new Error('Database port is required');
        }

        if (!username || username.trim() === '') {
            throw new Error('Database username is required');
        }

        if (!password || password.trim() === '') {
            throw new Error('Database password is required');
        }
    }

    /**
     * Ensure connection is established
     */
    private async ensureConnection(): Promise<void> {
        if (!this.isConnected) {
            await this.connect();
        }
    }
}

/**
 * Factory function to create a KeyValueStore instance
 * @param config Configuration object
 * @returns KeyValueStore instance
 */
export function createKeyValueStore(config: KeyValueStoreConfig): KeyValueStore {
    return new KeyValueStore(config.host, config.port, config.username, config.password);
}
