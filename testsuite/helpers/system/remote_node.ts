// Copyright (c) 2025 SUSE LLC.
// Licensed under the terms of the MIT license.

import {
    createSshOptions,
    scpDownloadCommand,
    scpUploadCommand,
    sshCommand,
    SshResult
} from '../network/network_utils.js';
import {ENV_VAR_BY_HOST, PRIVATE_ADDRESSES} from '../core/constants.js';
import {netPrefix, repeatUntilTimeout} from '../core/commonlib.js';
import * as path from 'path';
import {globalVars, TIMEOUTS} from "../core/env.js";

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
    bufferSize?: number; // Added for parity with Ruby
    verbose?: boolean;
    execOption?: string;
}

/**
 * The RemoteNode class represents a remote node.
 * It is used to interact with the remote node through SSH.
 */
export class RemoteNode {
    // Static registries to hold node instances, mirroring Ruby's global variables.
    private static namedNodes: Record<string, string> = {};
    private static nodeByHost: Record<string, RemoteNode> = {};
    private static hostByNode: Map<RemoteNode, string> = new Map();

    // Public properties of a remote node
    public host: string;
    public port: number;
    public hostname: string = '';
    public target: string = '';
    public fullHostname: string = '';
    public privateIp?: string;
    public publicIp?: string;
    public privateInterface?: string;
    public publicInterface?: string;
    public osFamily?: string;
    public osVersion?: string;
    public localOsFamily?: string;
    public localOsVersion?: string;
    public hasMgrctl: boolean = false;

    /**
     * Initializes a new remote node instance.
     * IMPORTANT: This constructor is lightweight. The async initialize() method must be called to fully set up the node.
     * @param host The hostname of the remote node.
     * @param port The port to use for the SSH connection.
     */
    constructor(host: string, port: number = 22) {
        this.host = host;
        this.port = port;
    }

    // Static methods to access the node registries
    static getNamedNodes(): Record<string, string> {
        return RemoteNode.namedNodes;
    }

    static getNodeByHost(host: string): RemoteNode | undefined {
        return RemoteNode.nodeByHost[host];
    }

    static getHostByNode(node: RemoteNode): string | undefined {
        return RemoteNode.hostByNode.get(node);
    }

    static getAllNodes(): Record<string, RemoteNode> {
        return {...RemoteNode.nodeByHost};
    }

    /**
     * Asynchronously initializes the remote node.
     * This method performs all the setup operations like connecting, fetching details, and registering the node.
     */
    async initialize(): Promise<void> {
        if (!ENV_VAR_BY_HOST[this.host]) {
            throw new Error(`Host ${this.host} is not defined as a valid host in the Test Framework.`);
        }

        const envVar = ENV_VAR_BY_HOST[this.host];
        if (!process.env[envVar]) {
            console.warn(`Host ${this.host} is not defined as environment variable.`);
            return;
        }

        this.target = (process.env[envVar] || '').trim();

        // Remove /etc/motd to prevent it from interfering with command output
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
            this.hasMgrctl = mgrctlResult.returnCode === 0;
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

        // Determine OS version and family for both the remote target and the host machine
        const osInfo = await this.getOsInfo();
        this.osVersion = osInfo.version || undefined;
        this.osFamily = osInfo.family || undefined;

        const localOsInfo = await this.getOsInfo(false);
        this.localOsVersion = localOsInfo.version || undefined;
        this.localOsFamily = localOsInfo.family || undefined;

        // Set up networking (public and private IPs)
        await this.setupNetworking();

        // Register this node instance in the static registries
        RemoteNode.nodeByHost[this.host] = this;
        RemoteNode.hostByNode.set(this, this.host);
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
            timeout = TIMEOUTS.long,
            successCodes = [0],
            verbose = false,
            execOption = '-i'
        } = options;

        const cmdPrefixed = this.hasMgrctl && runsInContainer
            ? `mgrctl exec ${execOption} '${cmd.replace(/'/g, `'"'"'`)}'`
            : cmd;

        return this.runLocal(cmdPrefixed, { ...options, checkErrors, timeout, successCodes, verbose });
    }

    /**
     * Runs a command locally on the target host and returns the output, error, and exit code.
     * @param cmd The command to run
     * @param options Run options
     * @returns Promise with command result
     */
    async runLocal(cmd: string, options: RunOptions = {}): Promise<CommandResult> {
        const {
            separatedResults = false,
            checkErrors = true,
            timeout = TIMEOUTS.long,
            successCodes = [0],
            bufferSize, // Added for parity
            verbose = false
        } = options;

        const sshOptions = createSshOptions(this.target, this.port);
        sshOptions.timeout = timeout * 1000; // Convert to milliseconds
        if (bufferSize) {
            sshOptions.bufferSize = bufferSize;
        }

        const result = await sshCommand(cmd, sshOptions);

        // Remove ANSI color codes
        const outNoColor = result.stdout.replace(/\x1b\[[0-9;]*m/g, '');
        const errNoColor = result.stderr.replace(/\x1b\[[0-9;]*m/g, '');


        if (checkErrors && !successCodes.includes(result.returnCode)) {
            throw new Error(`FAIL: ${cmd} returned status code = ${result.returnCode}.\nOutput:\n${outNoColor}\nStderr:\n${errNoColor}`);
        }

        if (verbose) {
            console.log(`${cmd} returned status code = ${result.returnCode}.\nOutput:\n'${outNoColor}'`);
        }

        if (separatedResults) {
            return { stdout: result.stdout, stderr: result.stderr, returnCode: result.returnCode };
        } else {
            return { stdout: result.stdout + result.stderr, returnCode: result.returnCode };
        }
    }

    /**
     * Runs a local command until it succeeds or times out.
     * @param cmd The command to run
     * @param timeout The timeout to be used, in seconds
     * @returns Promise with result and exit code
     */
    async runLocalUntilOk(cmd: string, timeout: number = TIMEOUTS.long): Promise<CommandResult> {
        return await repeatUntilTimeout(async () => {
            const result = await this.runLocal(cmd, {checkErrors: false});
            if (result.returnCode === 0) {
                return result;
            }
            await new Promise(resolve => setTimeout(resolve, 2000));
            return false;
        }, {timeout: timeout * 1000, reportResult: true}) as unknown as Promise<CommandResult>;
    }

    /**
     * Runs a command until it succeeds or times out.
     * @param cmd The command to run
     * @param timeout The timeout to be used, in seconds
     * @param runsInContainer Whether the command should be run in the container or on the host
     * @returns Promise with result and exit code
     */
    async runUntilOk(cmd: string, timeout: number = TIMEOUTS.long, runsInContainer: boolean = true): Promise<CommandResult> {
        return await repeatUntilTimeout(async () => {
            const result = await this.run(cmd, {checkErrors: false, runsInContainer});
            if (result.returnCode === 0) {
                return result;
            }
            await new Promise(resolve => setTimeout(resolve, 2000));
            return false;
        }, {timeout: timeout * 1000, reportResult: true}) as unknown as Promise<CommandResult>;
    }

    /**
     * Runs a command until it fails or times out.
     * @param cmd The command to run
     * @param timeout The timeout to be used, in seconds
     * @param runsInContainer Whether the command should be run in the container or on the host
     * @returns Promise with result and exit code
     */
    async runUntilFail(cmd: string, timeout: number = TIMEOUTS.long, runsInContainer: boolean = true): Promise<CommandResult> {
        return await repeatUntilTimeout(async () => {
            const result = await this.run(cmd, {checkErrors: false, runsInContainer});
            if (result.returnCode !== 0) {
                return result;
            }
            await new Promise(resolve => setTimeout(resolve, 2000));
            return false;
        }, {timeout: timeout * 1000, reportResult: true}) as unknown as Promise<CommandResult>;
    }

    /**
     * Waits until the process is no longer running.
     * @param process The name of the process to wait for
     * @returns Promise with result and exit code
     */
    async waitWhileProcessRunning(process: string): Promise<CommandResult> {
        return await repeatUntilTimeout(async () => {
            const result = await this.run(`pgrep -x ${process}`, {checkErrors: false});
            if (result.returnCode !== 0) {
                return result;
            }
            await new Promise(resolve => setTimeout(resolve, 2000));
            return false;
        }, {reportResult: true}) as unknown as Promise<CommandResult>;
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
                const result = await this.runLocal(`mgrctl cp server:${remoteNodeFile} ${tmpFile}`, {verbose: false});

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
     * Handles checking in server container if possible.
     * @param file The path of the file to check.
     * @returns True if the file exists, false otherwise.
     */
    async fileExists(file: string): Promise<boolean> {
        let cmd: string;
        if (this.hasMgrctl) {
            cmd = `mgrctl exec -- 'test -f ${file}'`;
        } else {
            cmd = `test -f ${file}`;
        }
        const { returnCode } = await this.runLocal(cmd, { checkErrors: false });
        return returnCode === 0;
    }

    /**
     * Check if a folder exists on a node.
     * Handles checking in server container if possible.
     * @param folder The path of the folder to check.
     * @returns True if the folder exists, false otherwise.
     */
    async folderExists(folder: string): Promise<boolean> {
        let cmd: string;
        if (this.hasMgrctl) {
            cmd = `mgrctl exec -- 'test -d ${folder}'`;
        } else {
            cmd = `test -d ${folder}`;
        }
        const { returnCode } = await this.runLocal(cmd, { checkErrors: false });
        return returnCode === 0;
    }

    /**
     * Delete a file on a node.
     * @param file The path of the file to be deleted.
     * @returns The exit code of the file deletion operation.
     */
    async fileDelete(file: string): Promise<number> {
        let cmd: string;
        if (this.hasMgrctl) {
            cmd = `mgrctl exec -- 'rm ${file}'`;
        } else {
            cmd = `rm ${file}`;
        }
        const { returnCode } = await this.runLocal(cmd, { checkErrors: false });
        return returnCode;
    }

    /**
     * Delete a folder on a node.
     * @param folder The path of the folder to be deleted.
     * @returns The exit code of the operation.
     */
    async folderDelete(folder: string): Promise<number> {
        let cmd: string;
        if (this.hasMgrctl) {
            cmd = `mgrctl exec -- 'rm -rf ${folder}'`;
        } else {
            cmd = `rm -rf ${folder}`;
        }
        const { returnCode } = await this.runLocal(cmd, { checkErrors: false });
        return returnCode;
    }

    /**
     * Checks if the node is offline.
     * @returns Promise with boolean result
     */
    async isNodeOffline(): Promise<boolean> {
        try {
            const result = await this.runLocal('echo test', {timeout: 1, checkErrors: false});
            // An empty result or failure indicates the node is offline.
            return result.returnCode !== 0 || result.stdout.trim() === '';
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
    async waitUntilOnline(timeout: number = TIMEOUTS.long): Promise<void> {
        await repeatUntilTimeout(async () => {
            if (!(await this.isNodeOffline())) {
                return true;
            }
            await new Promise(resolve => setTimeout(resolve, 1000));
            return false;
        }, {
            timeout: timeout * 1000,
            reportResult: true,
            message: `${this.hostname} did not come back online within ${timeout} seconds.`
        });
        console.log(`Node ${this.hostname} is online.`);
    }

    /**
     * Sets up private and public IP addresses for the node.
     */
    private async setupNetworking(): Promise<void> {
        // Setup Public IP
        const { ip: publicIp, interface: publicInterface } = await this.determinePublicIpAndInterface();
        if (publicIp) {
            this.publicIp = publicIp;
            this.publicInterface = publicInterface;
        }

        // Setup Private IP
        if (PRIVATE_ADDRESSES[this.host] && globalVars.privateNet !== null) {
            this.privateIp = `${netPrefix()}.${PRIVATE_ADDRESSES[this.host]}`;
            for (const dev of ['eth1', 'ens4']) {
                const { returnCode } = await this.runLocal(`ip address show dev ${dev}`, { checkErrors: false });
                if (returnCode === 0) {
                    this.privateInterface = dev;
                    break;
                }
            }
            if (!this.privateInterface) {
                throw new Error(`No private interface for '${this.hostname}'.`);
            }
        }
    }

    /**
     * Determines the public IP and network interface of the node.
     * This is a port of the `client_public_ip` logic from Ruby.
     */
    private async determinePublicIpAndInterface(): Promise<{ ip?: string, interface?: string }> {
        if (this.localOsFamily === 'macOS') {
            for (const dev of ['en0', 'en1', 'en2', 'en3', 'en4', 'en5', 'en6', 'en7']) {
                const { stdout, returnCode } = await this.runLocal(`ipconfig getifaddr ${dev}`, { checkErrors: false });
                if (returnCode === 0 && stdout.trim()) {
                    return { ip: stdout.trim(), interface: dev };
                }
            }
        } else {
            for (const dev of ['br0', 'eth0', 'eth1', 'ens0', 'ens1', 'ens2', 'ens3', 'ens4', 'ens5', 'ens6', 'ens7']) {
                const { stdout, returnCode } = await this.runLocal(`ip address show dev ${dev} | grep 'inet '`, { checkErrors: false });
                if (returnCode === 0 && stdout.trim()) {
                    const ip = stdout.trim().split(' ')[1]?.split('/')[0];
                    if (ip) {
                        return { ip, interface: dev };
                    }
                }
            }
        }
        console.warn(`Cannot resolve public IP of ${this.host}`);
        return {};
    }

    /**
     * Extracts the OS version and family from the node.
     * @param runsInContainer Whether to get info from the container or the host.
     * @returns Promise with OS info.
     */
    private async getOsInfo(runsInContainer: boolean = true): Promise<OsInfo> {
        let osFamily: string | undefined;
        let osVersion: string | undefined;

        try {
            // Try Linux /etc/os-release first
            let result = await this.run('grep "^ID=" /etc/os-release', { runsInContainer, checkErrors: false });
            if (result.returnCode !== 0) {
                // If that fails, try macOS command
                result = await this.run('sw_vers --productName', { runsInContainer, checkErrors: false });
                if (result.returnCode === 0) {
                    osFamily = result.stdout.trim();
                }
            } else {
                osFamily = result.stdout.trim().split('=')[1]?.replace(/"/g, '');
            }

            if (!osFamily) return { version: null, family: null };

            // Get OS version
            if (osFamily === 'macOS') {
                const versionResult = await this.run('sw_vers --productVersion', { runsInContainer, checkErrors: false });
                if (versionResult.returnCode === 0) {
                    osVersion = versionResult.stdout.trim();
                }
            } else {
                const versionResult = await this.run('grep "^VERSION_ID=" /etc/os-release', { runsInContainer, checkErrors: false });
                if (versionResult.returnCode === 0) {
                    osVersion = versionResult.stdout.trim().split('=')[1]?.replace(/"/g, '');
                }
            }

            if (!osVersion) return { version: null, family: osFamily };

            // On SLES, replace the dot with '-SP'
            if (osFamily.match(/^sles/)) {
                osVersion = osVersion.replace('.', '-SP');
            }

            console.log(`Node: ${this.hostname}, OS Version: ${osVersion}, Family: ${osFamily}`);
            return { version: osVersion, family: osFamily };

        } catch (error) {
            console.warn(`Failed to get OS info for ${this.hostname}:`, error);
            return { version: null, family: null };
        }
    }
}
