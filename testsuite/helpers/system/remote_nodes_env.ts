// Copyright (c) 2025 SUSE LLC.
// Licensed under the terms of the MIT license.

import * as fs from 'fs';
import {fileURLToPath} from 'url';
import * as path from 'path';
import {dirname} from 'path';
import {RemoteNode} from './remote_node.js';
import {ENV_VAR_BY_HOST} from '../core/constants.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

// SCC credentials interface
export interface SccCredentials {
    username: string;
    password: string;
    isValid: boolean;
}

// Custom repositories interface
export interface CustomRepositories {
    [key: string]: any;
}

// Global variables for caching credentials and repos
let sccCredentials: SccCredentials | undefined;
let customRepositories: CustomRepositories | undefined;

/**
 * Initialize the remote nodes environment by checking environment variables and loading configs.
 */
export function initializeRemoteNodesEnv(): void {
    // Check for required SERVER environment variable
    if (!process.env.SERVER) {
        throw new Error('Server IP address or domain name variable empty');
    }

    const customReposPath = path.join(__dirname, '../upload_files/custom_repositories.json');
    const hasCustomRepos = fs.existsSync(customReposPath);

    // Warn about missing optional environment variables only if the custom repos file is missing
    if (!hasCustomRepos) {
        const optionalVars = [
            'PROXY', 'MINION', 'BUILD_HOST', 'RHLIKE_MINION',
            'DEBLIKE_MINION', 'SSH_MINION', 'PXEBOOT_MAC'
        ];
        optionalVars.forEach(varName => {
            if (!process.env[varName]) {
                const friendlyName = ENV_VAR_BY_HOST[varName] || varName;
                console.warn(`${friendlyName} IP address, domain name, or MAC variable empty`);
            }
        });
    }

    // Load custom repositories if the file exists
    if (hasCustomRepos) {
        try {
            const customReposContent = fs.readFileSync(customReposPath, 'utf8');
            customRepositories = JSON.parse(customReposContent);
            console.log('Custom repositories loaded successfully');
        } catch (error) {
            console.warn('Failed to load custom repositories:', error);
        }
    }

    // Initialize SCC credentials from environment
    initializeSccCredentials();
}

/**
 * Initialize SCC credentials from the SCC_CREDENTIALS environment variable.
 */
function initializeSccCredentials(): void {
    const sccCredentialsEnv = process.env.SCC_CREDENTIALS;
    if (sccCredentialsEnv) {
        const [username, password] = sccCredentialsEnv.split('|');
        sccCredentials = {
            username: username || '',
            password: password || '',
            isValid: !!(username?.trim() && password?.trim())
        };
        if (sccCredentials.isValid) {
            console.log('SCC credentials loaded successfully');
        } else {
            console.warn('SCC credentials provided but invalid');
        }
    }
}

/**
 * Get the RemoteNode instance for a host, initializing it if it's the first time.
 * @param host The host identifier (e.g., "server", "minion").
 * @param refresh If true, forces re-initialization of the node.
 * @returns A promise that resolves to the fully initialized RemoteNode instance.
 */
export async function getTarget(host: string, refresh: boolean = false): Promise<RemoteNode> {
    let node = RemoteNode.getNodeByHost(host);
    if (!node || refresh) {
        node = new RemoteNode(host);
        await node.initialize(); // Explicitly await the full async initialization.
    }
    return node;
}

/**
 * Get all registered nodes.
 * @returns A record of host to RemoteNode mappings.
 */
export function getAllNodes(): Record<string, RemoteNode> {
    return RemoteNode.getAllNodes();
}

/**
 * Get a node by its resolved hostname.
 * @param hostname The hostname to search for.
 * @returns The RemoteNode instance if found, otherwise undefined.
 */
export function getNodeByHostname(hostname: string): RemoteNode | undefined {
    return Object.values(getAllNodes()).find(node => node.hostname === hostname);
}

/**
 * Get the host identifier (e.g., "server") for a given node instance.
 * @param node The RemoteNode instance.
 * @returns The host identifier if found.
 */
export function getHostByNode(node: RemoteNode): string | undefined {
    return RemoteNode.getHostByNode(node);
}

/**
 * Get all named nodes (host -> hostname mapping).
 * @returns A record of host to hostname mappings.
 */
export function getNamedNodes(): Record<string, string> {
    return RemoteNode.getNamedNodes();
}

/**
 * Check if a host is defined in the environment.
 * @param host The host identifier.
 * @returns True if the host is defined.
 */
export function isHostDefined(host: string): boolean {
    const envVar = ENV_VAR_BY_HOST[host];
    return !!(envVar && process.env[envVar]);
}

/**
 * Get SCC credentials.
 * @returns SCC credentials if available.
 */
export function getSccCredentials(): SccCredentials | undefined {
    return sccCredentials ? {...sccCredentials} : undefined;
}

/**
 * Get custom repositories from the remote nodes environment.
 * @returns Custom repositories if loaded.
 */
export function getCustomRepositoriesFromEnv(): CustomRepositories | undefined {
    return customRepositories ? {...customRepositories} : undefined;
}

/**
 * Check if custom repositories are available.
 * @returns True if custom repositories are loaded.
 */
export function hasCustomRepositories(): boolean {
    return customRepositories !== undefined;
}

/**
 * Cleanup all node connections.
 */
export async function cleanupNodes(): Promise<void> {
    console.log('Cleaning up remote node connections...');

    const nodes = getAllNodes();
    const promises = Object.values(nodes).map(async (node) => {
        try {
            // Any specific cleanup for RemoteNode instances could go here in the future.
            console.log(`Cleaned up connection to ${node.hostname}`);
        } catch (error) {
            console.warn(`Failed to cleanup node ${node.hostname}:`, error);
        }
    });

    await Promise.all(promises);

    // Clear registries by re-initializing the static properties on RemoteNode.
    // This part depends on how you want to handle state between runs.
    // For a full reset, you might need a static `reset()` method on RemoteNode.
    console.log('Remote node cleanup completed. Registries would be cleared here if needed.');
}


/**
 * Get the environment variable value for a host.
 * @param host The host identifier.
 * @returns The environment variable value if set.
 */
export function getEnvironmentVariable(host: string): string | undefined {
    const envVar = ENV_VAR_BY_HOST[host];
    return envVar ? process.env[envVar] : undefined;
}

/**
 * List all available hosts from the environment.
 * @returns An array of host identifiers that have environment variables set.
 */
export function getAvailableHosts(): string[] {
    return Object.keys(ENV_VAR_BY_HOST).filter(host => isHostDefined(host));
}

/**
 * Initialize a specific node by its host name.
 * @param host The host identifier.
 * @returns A promise with the initialized RemoteNode.
 */
export async function initializeNode(host: string): Promise<RemoteNode> {
    if (!isHostDefined(host)) {
        throw new Error(`Host ${host} is not defined in environment variables`);
    }
    return getTarget(host, true); // Force refresh to ensure re-initialization.
}

// Auto-initialize the environment when this module is imported.
// This mimics the behavior of the Ruby script running code at the top level.
try {
    if (process.env.SERVER) {
        initializeRemoteNodesEnv();
    } else {
        console.warn('Remote nodes env not initialized: SERVER environment variable is not set.');
    }
} catch (error) {
    console.error('Failed to auto-initialize remote nodes environment:', error);
}
