// Copyright (c) 2025 SUSE LLC.
// Licensed under the terms of the MIT license.

import {Client, ConnectConfig} from 'ssh2';
import {TIMEOUTS} from '../core/env.js';
import sshConfig from 'ssh-config';
import * as fs from 'fs';
import * as path from 'path';

export interface SshResult {
    stdout: string;
    stderr: string;
    returnCode: number;
}

export interface SshOptions {
    host: string;
    port?: number;
    timeout?: number;
    bufferSize?: number;
    username?: string;
    privateKey?: Buffer | string;
    password?: string;
    agent?: string; // SSH agent socket path
}

function buildConnectionConfig(options: SshOptions): ConnectConfig {
    const {
        host,
        port = 22,
        timeout = TIMEOUTS.long * 1000,
        username,
        password,
        privateKey,
        agent
    } = options;

    // 1. Read the user's default SSH config file
    const configPath = path.join(process.env.HOME || '~', '.ssh', 'config');
    const config = sshConfig.parse(fs.readFileSync(configPath, 'utf-8'));

    // 2. Compute the final configuration for the target host
    const hostConfig = config.compute(host);

    let finalHostName: string;
    if (Array.isArray(hostConfig.HostName)) {
        finalHostName = hostConfig.HostName[0]; // Take the first hostname if it's an array
    } else {
        finalHostName = hostConfig.HostName; // Use it as is if it's a string
    }

    const finalPort = hostConfig.Port ? parseInt(String(hostConfig.Port), 10) : port;

    let finalUsername: string | undefined;
    if (Array.isArray(hostConfig.User)) {
        finalUsername = hostConfig.User[0]; // Take the first user if it's an array
    } else {
        finalUsername = hostConfig.User; // Use it as is if it's a string
    }

    // 3. Build the connection object for the ssh2 library
    const connectionConfig: ConnectConfig = {
        host: finalHostName || host,
        port: finalPort,
        username: finalUsername || username,
        readyTimeout: timeout,
        agent: agent || process.env.SSH_AUTH_SOCK
    };

    // 4. Prioritize the IdentityFile from the config
    let identityFile: string | undefined;
    if (Array.isArray(hostConfig.IdentityFile)) {
        identityFile = hostConfig.IdentityFile[0]; // Take the first key file
    } else {
        identityFile = hostConfig.IdentityFile; // Use it as is if it's a string
    }

    const identityFilePath = identityFile?.replace(/^~/, process.env.HOME || '~');

    if (identityFilePath && fs.existsSync(identityFilePath)) {
        connectionConfig.privateKey = fs.readFileSync(identityFilePath);
    } else if (privateKey) {
        connectionConfig.privateKey = privateKey;
    }

    if (password) {
        connectionConfig.password = password;
    }

    return connectionConfig;
}

/**
 * Executes a command on a remote host using SSH and returns the output.
 */
export async function sshCommand(command: string, options: SshOptions): Promise<SshResult> {
    return new Promise((resolve, reject) => {
        const conn = new Client();
        let stdout = '';
        let stderr = '';
        let returnCode = -1;

        const timeout = options.timeout ?? TIMEOUTS.long * 1000;
        const connectionTimer = setTimeout(() => {
            conn.end();
            reject(new Error(`SSH operation timed out after ${timeout}ms`));
        }, timeout);

        conn.on('ready', () => {
            clearTimeout(connectionTimer);

            conn.exec(command, (err, stream) => {
                if (err) {
                    conn.end();
                    reject(new Error(`Failed to execute command: ${err.message}`));
                    return;
                }

                stream.on('close', (code: number) => {
                    returnCode = code;
                    conn.end();
                    resolve({stdout, stderr, returnCode});
                }).on('data', (data: Buffer) => {
                    stdout += data.toString();
                }).stderr.on('data', (data: Buffer) => {
                    stderr += data.toString();
                });
            });
        });

        conn.on('error', (err) => {
            clearTimeout(connectionTimer);
            conn.end();
            reject(err);
        });

        conn.connect(buildConnectionConfig(options));
    });
}

/**
 * Uploads a file to a remote host using SFTP.
 */
export async function scpUploadCommand(
    localPath: string,
    remotePath: string,
    options: SshOptions
): Promise<void> {
    return new Promise((resolve, reject) => {
        const conn = new Client();
        const timeout = options.timeout ?? TIMEOUTS.long * 1000;

        const connectionTimer = setTimeout(() => {
            conn.end();
            reject(new Error(`SCP upload timed out after ${timeout}ms`));
        }, timeout);

        conn.on('ready', () => {
            clearTimeout(connectionTimer);
            const fileContent = fs.readFileSync(localPath);

            conn.sftp((err, sftp) => {
                if (err) {
                    conn.end();
                    reject(new Error(`SFTP error: ${err.message}`));
                    return;
                }

                const writeStream = sftp.createWriteStream(remotePath);
                writeStream.on('error', (error: Error) => {
                    conn.end();
                    reject(new Error(`Failed to upload file: ${error.message}`));
                });
                writeStream.on('close', () => {
                    conn.end();
                    resolve();
                });

                writeStream.write(fileContent);
                writeStream.end();
            });
        });

        conn.on('error', (err) => {
            clearTimeout(connectionTimer);
            conn.end();
            reject(err);
        });

        conn.connect(buildConnectionConfig(options));
    });
}

/**
 * Downloads a file from a remote host using SFTP.
 */
export async function scpDownloadCommand(
    remotePath: string,
    localPath: string,
    options: SshOptions
): Promise<void> {
    return new Promise((resolve, reject) => {
        const conn = new Client();
        const timeout = options.timeout ?? TIMEOUTS.long * 1000;

        const connectionTimer = setTimeout(() => {
            conn.end();
            reject(new Error(`SCP download timed out after ${timeout}ms`));
        }, timeout);

        conn.on('ready', () => {
            clearTimeout(connectionTimer);

            conn.sftp((err, sftp) => {
                if (err) {
                    conn.end();
                    reject(new Error(`SFTP error: ${err.message}`));
                    return;
                }

                const readStream = sftp.createReadStream(remotePath);
                const writeStream = fs.createWriteStream(localPath);

                readStream.on('error', (error: Error) => {
                    conn.end();
                    reject(new Error(`Failed to read remote file: ${error.message}`));
                });
                writeStream.on('error', (error) => {
                    conn.end();
                    reject(new Error(`Failed to write local file: ${error.message}`));
                });
                writeStream.on('close', () => {
                    conn.end();
                    resolve();
                });

                readStream.pipe(writeStream);
            });
        });

        conn.on('error', (err) => {
            clearTimeout(connectionTimer);
            conn.end();
            reject(err);
        });

        conn.connect(buildConnectionConfig(options));
    });
}

/**
 * Creates SSH options from environment variables or defaults.
 */
export function createSshOptions(host: string, port: number = 22): SshOptions {
    return {
        host,
        port,
        timeout: TIMEOUTS.long * 1000,
        bufferSize: 65536,
        username: process.env.SSH_USER || process.env.USER,
        agent: process.env.SSH_AUTH_SOCK
    };
}

export function getNetPrefix(): string {
    return process.env.NET_PREFIX || '192.168.124.';
}

export function getPrivateNet(): string {
    return `${getNetPrefix()}0/24`;
}

export function getReverseNet(net: string): string {
    const parts = net.split('.');
    return `${parts[2]}.${parts[1]}.${parts[0]}.in-addr.arpa`;
}
