// Copyright (c) 2025 SUSE LLC.
// Licensed under the terms of the MIT license.

import * as fs from 'fs';
import * as path from 'path';
import { RemoteNode } from './remote_node';
import { ENV_VAR_BY_HOST } from '../core/constants';

// Types for node registries
export interface NodeRegistries {
  nodeByHost: Record<string, RemoteNode>;
  hostByNode: Map<RemoteNode, string>;
  namedNodes: Record<string, string>;
}

// Global registries
const nodeRegistries: NodeRegistries = {
  nodeByHost: {},
  hostByNode: new Map(),
  namedNodes: {}
};

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

// Global variables
let sccCredentials: SccCredentials | undefined;
let customRepositories: CustomRepositories | undefined;

/**
 * Initialize the remote nodes environment
 */
export function initializeRemoteNodesEnv(): void {
  // Check for required environment variables
  if (!process.env.SERVER) {
    throw new Error('Server IP address or domain name variable empty');
  }

  // Warn about missing optional environment variables
  const requiredVars = [
    'PROXY',
    'MINION',
    'BUILD_HOST',
    'RHLIKE_MINION',
    'DEBLIKE_MINION',
    'SSH_MINION',
    'PXEBOOT_MAC'
  ];

  // Check for custom repositories file first
  const customReposPath = path.join(__dirname, '../upload_files/custom_repositories.json');
  const hasCustomRepos = fs.existsSync(customReposPath);

  if (!hasCustomRepos) {
    requiredVars.forEach(varName => {
      if (!process.env[varName]) {
        const friendlyName = varName.toLowerCase().replace(/_/g, ' ');
        console.warn(`${friendlyName} IP address or domain name variable empty`);
      }
    });
  }

  // Load custom repositories if available
  if (hasCustomRepos) {
    try {
      const customReposContent = fs.readFileSync(customReposPath, 'utf8');
      customRepositories = JSON.parse(customReposContent);
      console.log('Custom repositories loaded successfully');
    } catch (error) {
      console.warn('Failed to load custom repositories:', error);
    }
  }

  // Initialize SCC credentials
  initializeSccCredentials();

  console.log('Remote nodes environment initialized');
}

/**
 * Initialize SCC credentials from environment
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
 * Get the RemoteNode instance for a host (includes lazy initialization)
 * @param host The host identifier
 * @param refresh Whether to refresh the connection
 * @returns Promise with RemoteNode instance
 */
export async function getTarget(host: string, refresh: boolean = false): Promise<RemoteNode> {
  let node = nodeRegistries.nodeByHost[host];
  
  if (!node || refresh) {
    console.log(`Creating new RemoteNode for host: ${host}`);
    node = new RemoteNode(host);
    
    // Wait for the node to be properly initialized
    // Since RemoteNode constructor calls initialize() asynchronously,
    // we need to wait for it to complete
    await new Promise((resolve, reject) => {
      const checkInitialized = () => {
        if (node.hostname && node.fullHostname) {
          resolve(void 0);
        } else {
          setTimeout(checkInitialized, 100);
        }
      };
      checkInitialized();
      
      // Set a timeout to avoid infinite waiting
      setTimeout(() => {
        reject(new Error(`Timeout waiting for ${host} to initialize`));
      }, 30000); // 30 second timeout
    });
    
    // Register the node
    nodeRegistries.nodeByHost[host] = node;
    nodeRegistries.hostByNode.set(node, host);
    nodeRegistries.namedNodes[host] = node.hostname;
  }
  
  return node;
}

/**
 * Get all registered nodes
 * @returns Record of host to RemoteNode mappings
 */
export function getAllNodes(): Record<string, RemoteNode> {
  return { ...nodeRegistries.nodeByHost };
}

/**
 * Get node by hostname
 * @param hostname The hostname to search for
 * @returns RemoteNode if found, undefined otherwise
 */
export function getNodeByHostname(hostname: string): RemoteNode | undefined {
  return Object.values(nodeRegistries.nodeByHost).find(node => node.hostname === hostname);
}

/**
 * Get host identifier for a node
 * @param node The RemoteNode instance
 * @returns Host identifier if found
 */
export function getHostByNode(node: RemoteNode): string | undefined {
  return nodeRegistries.hostByNode.get(node);
}

/**
 * Get all named nodes (host -> hostname mapping)
 * @returns Record of host to hostname mappings
 */
export function getNamedNodes(): Record<string, string> {
  return { ...nodeRegistries.namedNodes };
}

/**
 * Check if a host is defined in the environment
 * @param host The host identifier
 * @returns True if the host is defined
 */
export function isHostDefined(host: string): boolean {
  const envVar = ENV_VAR_BY_HOST[host];
  return !!(envVar && process.env[envVar]);
}

/**
 * Get SCC credentials
 * @returns SCC credentials if available
 */
export function getSccCredentials(): SccCredentials | undefined {
  return sccCredentials ? { ...sccCredentials } : undefined;
}

/**
 * Get custom repositories from remote nodes environment
 * @returns Custom repositories if loaded
 */
export function getCustomRepositoriesFromEnv(): CustomRepositories | undefined {
  return customRepositories ? { ...customRepositories } : undefined;
}

/**
 * Check if custom repositories are available
 * @returns True if custom repositories are loaded
 */
export function hasCustomRepositories(): boolean {
  return customRepositories !== undefined;
}

/**
 * Cleanup all node connections
 */
export async function cleanupNodes(): Promise<void> {
  console.log('Cleaning up remote node connections...');
  
  const promises = Object.values(nodeRegistries.nodeByHost).map(async (node) => {
    try {
      // Any cleanup needed for RemoteNode instances could go here
      console.log(`Cleaned up connection to ${node.hostname}`);
    } catch (error) {
      console.warn(`Failed to cleanup node ${node.hostname}:`, error);
    }
  });
  
  await Promise.all(promises);
  
  // Clear registries
  nodeRegistries.nodeByHost = {};
  nodeRegistries.hostByNode.clear();
  nodeRegistries.namedNodes = {};
  
  console.log('Remote node cleanup completed');
}

/**
 * Get environment variable for host
 * @param host The host identifier
 * @returns Environment variable value if set
 */
export function getEnvironmentVariable(host: string): string | undefined {
  const envVar = ENV_VAR_BY_HOST[host];
  return envVar ? process.env[envVar] : undefined;
}

/**
 * List all available hosts from environment
 * @returns Array of host identifiers that have environment variables set
 */
export function getAvailableHosts(): string[] {
  return Object.keys(ENV_VAR_BY_HOST).filter(host => isHostDefined(host));
}

/**
 * Initialize a specific node by host name
 * @param host The host identifier
 * @returns Promise with initialized RemoteNode
 */
export async function initializeNode(host: string): Promise<RemoteNode> {
  if (!isHostDefined(host)) {
    throw new Error(`Host ${host} is not defined in environment variables`);
  }
  
  return getTarget(host, true); // Force refresh
}

// Auto-initialize on import (best-effort; skip if required env is missing)
try {
  if (process.env.SERVER) {
    initializeRemoteNodesEnv();
  } else {
    console.warn('Remote nodes env not initialized: SERVER is not set');
  }
} catch (error) {
  console.warn('Failed to initialize remote nodes environment:', error);
  // Do not rethrow during tooling/dry-run; initialization can be done explicitly later
}
