// Copyright (c) 2025 SUSE LLC.
// Licensed under the terms of the MIT license.

import { sshCommand, scpUploadCommand, scpDownloadCommand, createSshOptions, SshResult, SshOptions } from '../network/network_utils';
import { ENV_VAR_BY_HOST } from '../core/constants';
import { repeatUntilTimeout, TimeoutOptions } from '../core/commonlib';
import { TIMEOUTS } from '../core/env';
import * as path from 'path';

export interface CommandResult {
  stdout: string;
  stderr?: string;
  returnCode: number;
}

export interface OsInfo {
  version: string | null;
  family: string | null;
}

export interface RunOptions {
  runsInContainer?: boolean;
  separatedResults?: boolean;
  checkErrors?: boolean;
  timeout?: number;
  successCodes?: number[];
  bufferSize?: number;
  verbose?: boolean;
  execOption?: string;
}

/**
 * The RemoteNode class represents a remote node.
 * It is used to interact with the remote node through SSH.
 */
export class RemoteNode {
  public host: string;
  public hostname: string;
  public port: number;
  public target: string;
  public fullHostname: string;
  public privateIp?: string;
  public publicIp?: string;
  public privateInterface?: string;
  public publicInterface?: string;
  public osFamily?: string;
  public osVersion?: string;
  public localOsFamily?: string;
  public localOsVersion?: string;
  public hasMgrctl: boolean = false;

  // Static registries similar to Ruby's global variables
  private static namedNodes: Record<string, string> = {};
  private static nodeByHost: Record<string, RemoteNode> = {};
  private static hostByNode: Map<RemoteNode, string> = new Map();

  /**
   * Initializes a new remote node.
   * @param host The hostname of the remote node
   * @param port The port to use for the SSH connection
   */
  constructor(host: string, port: number = 22) {
    this.host = host;
    this.port = port;
    this.hostname = '';
    this.target = '';
    this.fullHostname = '';

    console.log(`Initializing a remote node for '${this.host}'.`);

    if (!ENV_VAR_BY_HOST[this.host]) {
      throw new Error(`Host ${this.host} is not defined as a valid host in the Test Framework.`);
    }

    const envVar = ENV_VAR_BY_HOST[this.host];
    if (!process.env[envVar]) {
      console.warn(`Host ${this.host} is not defined as environment variable.`);
      return;
    }

    this.target = (process.env[envVar] || '').trim();
    
    // Initialize the node asynchronously
    this.initialize().catch(error => {
      console.error(`Failed to initialize node ${this.host}:`, error);
      throw error;
    });
  }

  /**
   * Async initialization method
   */
  private async initialize(): Promise<void> {
    try {
      // Remove /etc/motd, or any output from run will contain the content of /etc/motd
      if (this.host !== 'localhost') {
        await this.ssh('rm -f /etc/motd && touch /etc/motd', this.target);
      }

      const hostnameResult = await this.ssh('echo $HOSTNAME', this.target);
      this.hostname = hostnameResult.stdout.trim();
      
      if (!this.hostname) {
        throw new Error(`We can't connect to ${this.host} through SSH.`);
      }

      RemoteNode.namedNodes[this.host] = this.hostname;

      if (this.host === 'server') {
        const mgrctlResult = await this.ssh('which mgrctl', this.target);
        this.hasMgrctl = mgrctlResult.exitCode === 0;
        
        // Remove /etc/motd inside the container
        await this.run('rm -f /etc/motd && touch /etc/motd');
        
        const fqdnResult = await this.run(`sed -n 's/^java.hostname *= *\\(.\\+\\)$/\\1/p' /etc/rhn/rhn.conf`);
        this.fullHostname = fqdnResult.stdout.trim();
      } else {
        const fqdnResult = await this.ssh('hostname -f', this.target);
        this.fullHostname = fqdnResult.stdout.trim();
      }

      if (!this.fullHostname) {
        throw new Error(`No FQDN for '${this.hostname}'.`);
      }

      console.log(`Host '${this.host}' is alive with determined hostname ${this.hostname} and FQDN ${this.fullHostname}`);

      // Determine OS version and OS family
      const osInfo = await this.getOsVersion();
      this.osVersion = osInfo.version || undefined;
      this.osFamily = osInfo.family || undefined;

      const localOsInfo = await this.getOsVersion(false);
      this.localOsVersion = localOsInfo.version || undefined;
      this.localOsFamily = localOsInfo.family || undefined;

      // Set up networking if applicable
      await this.setupNetworking();

      // Register this node
      RemoteNode.nodeByHost[this.host] = this;
      RemoteNode.hostByNode.set(this, this.host);

    } catch (error) {
      console.error(`Failed to initialize node ${this.host}:`, error);
      throw error;
    }
  }

  /**
   * Runs a command on the remote node using SSH.
   * @param command The command to run
   * @param host The hostname of the remote node
   * @returns Promise with command result
   */
  async ssh(command: string, host: string = this.fullHostname): Promise<SshResult> {
    const options = createSshOptions(host, this.port);
    return sshCommand(command, options);
  }

  /**
   * Copies a file from the local machine to the remote node.
   * @param localPath The path to the file to be uploaded
   * @param remotePath The path in the destination
   * @param host The hostname of the remote node
   */
  async scpUpload(localPath: string, remotePath: string, host: string = this.fullHostname): Promise<void> {
    const options = createSshOptions(host, this.port);
    return scpUploadCommand(localPath, remotePath, options);
  }

  /**
   * Copies a file from the remote node to the local machine.
   * @param remotePath The path of the file to be downloaded
   * @param localPath The path to the destination file
   * @param host The hostname of the remote node
   */
  async scpDownload(remotePath: string, localPath: string, host: string = this.fullHostname): Promise<void> {
    const options = createSshOptions(host, this.port);
    return scpDownloadCommand(remotePath, localPath, options);
  }

  /**
   * Runs a command and returns the output, error, and exit code.
   * @param cmd The command to run
   * @param options Run options
   * @returns Promise with command result
   */
  async run(cmd: string, options: RunOptions = {}): Promise<CommandResult> {
    const {
      runsInContainer = true,
      checkErrors = true,
      timeout = TIMEOUTS.default,
      successCodes = [0],
      verbose = false,
      execOption = '-i'
    } = options;

    const cmdPrefixed = this.hasMgrctl && runsInContainer 
      ? `mgrctl exec ${execOption} '${cmd.replace(/'/g, `'"'"'`)}'`
      : cmd;

    return this.runLocal(cmdPrefixed, {
      ...options,
      checkErrors,
      timeout,
      successCodes,
      verbose
    });
  }

  /**
   * Runs a command locally and returns the output, error, and exit code.
   * @param cmd The command to run
   * @param options Run options
   * @returns Promise with command result
   */
  async runLocal(cmd: string, options: RunOptions = {}): Promise<CommandResult> {
    const {
      separatedResults = false,
      checkErrors = true,
      timeout = TIMEOUTS.default,
      successCodes = [0],
      verbose = false
    } = options;

    const sshOptions = createSshOptions(this.target, this.port);
    sshOptions.timeout = timeout * 1000; // Convert to milliseconds

    const result = await sshCommand(cmd, sshOptions);
    
    // Remove ANSI color codes
    const outNoColor = result.stdout.replace(/\x1b\[[0-9;]*m/g, '');
    
    if (checkErrors && !successCodes.includes(result.exitCode)) {
      throw new Error(`FAIL: ${cmd} returned status code = ${result.exitCode}.\nOutput:\n${outNoColor}`);
    }

    if (verbose) {
      console.log(`${cmd} returned status code = ${result.exitCode}.\nOutput:\n'${outNoColor}'`);
    }

    if (separatedResults) {
      return {
        stdout: result.stdout,
        stderr: result.stderr,
        returnCode: result.exitCode
      };
    } else {
      return {
        stdout: result.stdout + result.stderr,
        returnCode: result.exitCode
      };
    }
  }

  /**
   * Runs a local command until it succeeds or times out.
   * @param cmd The command to run
   * @param timeout The timeout to be used, in seconds
   * @param runsInContainer Whether the command should be run in the container or on the host
   * @returns Promise with result and exit code
   */
  async runLocalUntilOk(cmd: string, timeout: number = TIMEOUTS.default, runsInContainer: boolean = true): Promise<CommandResult> {
    return repeatUntilTimeout(async () => {
      const result = await this.runLocal(cmd, { 
        checkErrors: false, 
        // Note: runsInContainer not directly used in runLocal, would need to be handled differently
      });
      
      if (result.returnCode === 0) {
        return result;
      }

      await new Promise(resolve => setTimeout(resolve, 2000));
      return false;
    }, { timeout: timeout * 1000, reportResult: true }) as Promise<CommandResult>;
  }

  /**
   * Runs a command until it succeeds or times out.
   * @param cmd The command to run
   * @param timeout The timeout to be used, in seconds
   * @param runsInContainer Whether the command should be run in the container or on the host
   * @returns Promise with result and exit code
   */
  async runUntilOk(cmd: string, timeout: number = TIMEOUTS.default, runsInContainer: boolean = true): Promise<CommandResult> {
    return repeatUntilTimeout(async () => {
      const result = await this.run(cmd, {
        checkErrors: false,
        runsInContainer
      });

      if (result.returnCode === 0) {
        return result;
      }

      await new Promise(resolve => setTimeout(resolve, 2000));
      return false;
    }, { timeout: timeout * 1000, reportResult: true }) as Promise<CommandResult>;
  }

  /**
   * Runs a command until it fails or times out.
   * @param cmd The command to run
   * @param timeout The timeout to be used, in seconds
   * @param runsInContainer Whether the command should be run in the container or on the host
   * @returns Promise with result and exit code
   */
  async runUntilFail(cmd: string, timeout: number = TIMEOUTS.default, runsInContainer: boolean = true): Promise<CommandResult> {
    return repeatUntilTimeout(async () => {
      const result = await this.run(cmd, { 
        checkErrors: false, 
        runsInContainer
      });
      
      if (result.returnCode !== 0) {
        return result;
      }

      await new Promise(resolve => setTimeout(resolve, 2000));
      return false;
    }, { timeout: timeout * 1000, reportResult: true }) as Promise<CommandResult>;
  }

  /**
   * Waits until the process is no longer running.
   * @param process The name of the process to wait for
   * @returns Promise with result and exit code
   */
  async waitWhileProcessRunning(process: string): Promise<CommandResult> {
    return repeatUntilTimeout(async () => {
      const result = await this.run(`pgrep -x ${process} >/dev/null`, { checkErrors: false });
      
      if (result.returnCode !== 0) {
        return result;
      }

      await new Promise(resolve => setTimeout(resolve, 2000));
      return false;
    }, { reportResult: true }) as Promise<CommandResult>;
  }

  /**
   * Copies a file from the test runner (aka controller) into the remote node.
   * @param testRunnerFile The path to the file to copy
   * @param remoteNodeFile The path in the destination
   * @returns Promise with success status
   */
  async inject(testRunnerFile: string, remoteNodeFile: string): Promise<boolean> {
    try {
      if (this.hasMgrctl) {
        const tmpFile = path.join('/tmp/', path.basename(testRunnerFile));
        await this.scpUpload(testRunnerFile, tmpFile);
        
        const result = await this.runLocal(`mgrctl cp ${tmpFile} server:${remoteNodeFile}`);
        if (result.returnCode !== 0) {
          throw new Error(`Failed to copy ${tmpFile} to container`);
        }
      } else {
        await this.scpUpload(testRunnerFile, remoteNodeFile);
      }
      return true;
    } catch (error) {
      console.error('Injection failed:', error);
      return false;
    }
  }

  /**
   * Copies a file from the remote node into the test runner (aka controller).
   * @param remoteNodeFile The path in the source
   * @param testRunnerFile The path to the destination file
   * @returns Promise with success status
   */
  async extract(remoteNodeFile: string, testRunnerFile: string): Promise<boolean> {
    try {
      if (this.hasMgrctl) {
        const tmpFile = path.join('/tmp/', path.basename(remoteNodeFile));
        const result = await this.runLocal(`mgrctl cp server:${remoteNodeFile} ${tmpFile}`, { verbose: false });
        
        if (result.returnCode !== 0) {
          throw new Error(`Failed to extract ${remoteNodeFile} from container`);
        }

        await this.scpDownload(tmpFile, testRunnerFile);
      } else {
        await this.scpDownload(remoteNodeFile, testRunnerFile);
      }
      return true;
    } catch (error) {
      console.error('Extraction failed:', error);
      return false;
    }
  }

  /**
   * Check if a file exists on a node.
   * @param file The path of the file to check
   * @returns Promise with boolean result
   */
  async fileExists(file: string): Promise<boolean> {
    try {
      let result: CommandResult;
      
      if (this.hasMgrctl) {
        result = await this.runLocal(`mgrctl exec -- 'test -f ${file}'`, { checkErrors: false });
      } else {
        const sshResult = await this.ssh(`test -f ${file}`);
        result = { stdout: sshResult.stdout, returnCode: sshResult.exitCode };
      }
      
      return result.returnCode === 0;
    } catch {
      return false;
    }
  }

  /**
   * Check if a folder exists on a node.
   * @param folder The path of the folder to check
   * @returns Promise with boolean result
   */
  async folderExists(folder: string): Promise<boolean> {
    try {
      let result: CommandResult;
      
      if (this.hasMgrctl) {
        result = await this.runLocal(`mgrctl exec -- 'test -d ${folder}'`, { checkErrors: false });
      } else {
        const sshResult = await this.ssh(`test -d ${folder}`);
        result = { stdout: sshResult.stdout, returnCode: sshResult.exitCode };
      }
      
      return result.returnCode === 0;
    } catch {
      return false;
    }
  }

  /**
   * Delete a file on a node.
   * @param file The path of the file to be deleted
   * @returns Promise with exit code
   */
  async fileDelete(file: string): Promise<number> {
    try {
      let result: CommandResult;
      
      if (this.hasMgrctl) {
        result = await this.runLocal(`mgrctl exec -- 'rm ${file}'`, { checkErrors: false });
      } else {
        const sshResult = await this.ssh(`rm ${file}`);
        result = { stdout: sshResult.stdout, returnCode: sshResult.exitCode };
      }
      
      return result.returnCode;
    } catch {
      return -1;
    }
  }

  /**
   * Delete a folder on a node.
   * @param folder The path of the folder to be deleted
   * @returns Promise with exit code
   */
  async folderDelete(folder: string): Promise<number> {
    try {
      let result: CommandResult;
      
      if (this.hasMgrctl) {
        result = await this.runLocal(`mgrctl exec -- 'rm -rf ${folder}'`, { checkErrors: false });
      } else {
        const sshResult = await this.ssh(`rm -rf ${folder}`);
        result = { stdout: sshResult.stdout, returnCode: sshResult.exitCode };
      }
      
      return result.returnCode;
    } catch {
      return -1;
    }
  }

  /**
   * Checks if the node is offline.
   * @returns Promise with boolean result
   */
  async isNodeOffline(): Promise<boolean> {
    try {
      const result = await this.runLocal('echo test', { timeout: 1, checkErrors: false });
      return result.stdout.trim() === '';
    } catch {
      return true;
    }
  }

  /**
   * Wait until the node goes offline
   */
  async waitUntilOffline(): Promise<void> {
    while (!(await this.isNodeOffline())) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    console.log(`Node ${this.hostname} is offline.`);
  }

  /**
   * Wait until the node comes back online
   * @param timeout The maximum time to wait for the node to come online, in seconds
   */
  async waitUntilOnline(timeout: number = TIMEOUTS.default): Promise<void> {
    await repeatUntilTimeout(async () => {
      if (!(await this.isNodeOffline())) {
        console.log(`Node ${this.hostname} is online.`);
        return true;
      }
      await new Promise(resolve => setTimeout(resolve, 1000));
      return false;
    }, {
      timeout: timeout * 1000,
      reportResult: true,
      message: `${this.hostname} did not come back online within ${timeout} seconds.`
    });
  }

  /**
   * Get OS family
   * @returns Promise with OS family string
   */
  async getOsFamily(): Promise<string> {
    if (this.osFamily) {
      return this.osFamily;
    }
    
    const osInfo = await this.getOsVersion();
    this.osFamily = osInfo.family || '';
    return this.osFamily;
  }

  /**
   * Private method to setup networking
   */
  private async setupNetworking(): Promise<void> {
    // Implementation for setting up private and public IPs would go here
    // This is a simplified version - the full implementation would need 
    // access to PRIVATE_ADDRESSES and network configuration
  }

  /**
   * Extract the OS version and OS family
   * @param runsInContainer Whether to get info from container or host
   * @returns Promise with OS info
   */
  private async getOsVersion(runsInContainer: boolean = true): Promise<OsInfo> {
    try {
      // Try to get OS family from /etc/os-release
      let result = await this.run('grep "^ID=" /etc/os-release', { 
        runsInContainer, 
        checkErrors: false 
      });
      
      // If that fails, try macOS command
      if (result.returnCode !== 0) {
        result = await this.run('sw_vers --productName', { 
          runsInContainer, 
          checkErrors: false 
        });
        
        if (result.returnCode !== 0) {
          return { version: null, family: null };
        }
      }

      let osFamily = result.stdout.trim();
      if (osFamily !== 'macOS') {
        const parts = osFamily.split('=');
        if (parts.length > 1) {
          osFamily = parts[1];
        }
      }

      if (!osFamily) {
        return { version: null, family: null };
      }

      osFamily = osFamily.replace(/"/g, '');

      // Get OS version
      let osVersion: string;
      if (osFamily === 'macOS') {
        const versionResult = await this.run('sw_vers --productVersion', { 
          runsInContainer, 
          checkErrors: false 
        });
        
        if (versionResult.returnCode !== 0) {
          return { version: null, family: null };
        }
        
        osVersion = versionResult.stdout.trim();
      } else {
        const versionResult = await this.run('grep "^VERSION_ID=" /etc/os-release', { 
          runsInContainer, 
          checkErrors: false 
        });
        
        if (versionResult.returnCode !== 0) {
          return { version: null, family: null };
        }

        const versionLine = versionResult.stdout.trim();
        const versionParts = versionLine.split('=');
        if (versionParts.length < 2) {
          return { version: null, family: null };
        }
        
        osVersion = versionParts[1];
      }

      osVersion = osVersion.replace(/"/g, '');
      
      // On SLES, replace the dot with '-SP'
      if (osFamily.match(/^sles/)) {
        osVersion = osVersion.replace('.', '-SP');
      }

      console.log(`Node: ${this.hostname}, OS Version: ${osVersion}, Family: ${osFamily}`);
      return { version: osVersion, family: osFamily };

    } catch (error) {
      console.warn(`Failed to get OS version for ${this.hostname}:`, error);
      return { version: null, family: null };
    }
  }

  // Static methods to access registries
  static getNamedNodes(): Record<string, string> {
    return RemoteNode.namedNodes;
  }

  static getNodeByHost(host: string): RemoteNode | undefined {
    return RemoteNode.nodeByHost[host];
  }

  static getHostByNode(node: RemoteNode): string | undefined {
    return RemoteNode.hostByNode.get(node);
  }
}