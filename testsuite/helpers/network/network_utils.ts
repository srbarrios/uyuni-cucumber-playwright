// Copyright (c) 2024 SUSE LLC.
// Licensed under the terms of the MIT license.

import { Client } from 'ssh2';
import * as fs from 'fs';
import { TIMEOUTS } from '../core/env';

export interface SshResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

export interface SshOptions {
  host: string;
  port?: number;
  timeout?: number;
  bufferSize?: number;
  username?: string;
  privateKey?: Buffer | string;
  password?: string;
}

/**
 * Executes a command on a remote host using SSH and returns the output.
 * @param command The command to execute on the remote host
 * @param options SSH connection options
 * @returns An object containing stdout, stderr, and exit code
 */
export async function sshCommand(command: string, options: SshOptions): Promise<SshResult> {
  const {
    host,
    port = 22,
    timeout = TIMEOUTS.default * 1000, // Convert to milliseconds
    bufferSize = 65536,
    username,
    privateKey,
    password
  } = options;

  return new Promise((resolve, reject) => {
    const conn = new Client();
    let stdout = '';
    let stderr = '';
    let exitCode = -1;

    // Set up connection timeout
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
          exitCode = code;
          conn.end();
          resolve({ stdout, stderr, exitCode });
        }).on('data', (data: Buffer) => {
          stdout += data.toString();
        }).stderr.on('data', (data: Buffer) => {
          stderr += data.toString();
        });
      });
    });

    conn.on('error', (err) => {
      clearTimeout(connectionTimer);
      
      if (err.message.includes('ECONNREFUSED') || err.message.includes('EHOSTUNREACH')) {
        console.error(`Unable to reach the SSH server at ${host}:${port}`);
      } else if (err.message.includes('Authentication failed')) {
        console.error(`Authentication failed for user ${username} on ${host}`);
      } else {
        console.error(`SSH connection error: ${err.message}`);
      }
      
      reject(err);
    });

    // Connection configuration
    const connectionConfig: any = {
      host,
      port,
      username: username || process.env.USER || 'root',
      readyTimeout: timeout,
      algorithms: {
        // Exclude ECDSA/ECDH algorithms similar to Ruby version
        kex: [
          'diffie-hellman-group-exchange-sha256',
          'diffie-hellman-group14-sha256',
          'diffie-hellman-group15-sha512',
          'diffie-hellman-group16-sha512'
        ],
        serverHostKey: ['rsa-sha2-512', 'rsa-sha2-256', 'ssh-rsa'],
        cipher: [
          'aes128-ctr', 'aes192-ctr', 'aes256-ctr',
          'aes128-gcm', 'aes256-gcm'
        ]
      }
    };

    if (privateKey) {
      connectionConfig.privateKey = privateKey;
    } else if (password) {
      connectionConfig.password = password;
    } else {
      // Try to use SSH agent or default key locations
      const defaultKeyPaths = [
        `${process.env.HOME}/.ssh/id_rsa`,
        `${process.env.HOME}/.ssh/id_ed25519`
      ];

      for (const keyPath of defaultKeyPaths) {
        if (fs.existsSync(keyPath)) {
          try {
            connectionConfig.privateKey = fs.readFileSync(keyPath);
            break;
          } catch (error) {
            console.warn(`Failed to read SSH key from ${keyPath}: ${error}`);
          }
        }
      }
    }

    conn.connect(connectionConfig);
  });
}

/**
 * Uploads a file to a remote host using SCP.
 * @param localPath The path to the file to be uploaded
 * @param remotePath The path to the destination file
 * @param options SSH connection options
 */
export async function scpUploadCommand(
  localPath: string, 
  remotePath: string, 
  options: SshOptions
): Promise<void> {
  const {
    host,
    port = 22,
    timeout = TIMEOUTS.default * 1000,
    username,
    privateKey,
    password
  } = options;

  return new Promise((resolve, reject) => {
    const conn = new Client();

    const connectionTimer = setTimeout(() => {
      conn.end();
      reject(new Error(`SCP upload timed out after ${timeout}ms`));
    }, timeout);

    conn.on('ready', () => {
      clearTimeout(connectionTimer);

      // Read local file
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
      
      if (err.message.includes('ECONNREFUSED')) {
        console.error(`Connection refused to ${host}:${port}`);
      }
      
      reject(err);
    });

    // Use same connection config as sshCommand
    const connectionConfig: any = {
      host,
      port,
      username: username || process.env.USER || 'root',
      readyTimeout: timeout
    };

    if (privateKey) {
      connectionConfig.privateKey = privateKey;
    } else if (password) {
      connectionConfig.password = password;
    } else {
      const defaultKeyPaths = [
        `${process.env.HOME}/.ssh/id_rsa`,
        `${process.env.HOME}/.ssh/id_ed25519`
      ];

      for (const keyPath of defaultKeyPaths) {
        if (fs.existsSync(keyPath)) {
          try {
            connectionConfig.privateKey = fs.readFileSync(keyPath);
            break;
          } catch (error) {
            console.warn(`Failed to read SSH key from ${keyPath}: ${error}`);
          }
        }
      }
    }

    conn.connect(connectionConfig);
  });
}

/**
 * Downloads a file from a remote host using SCP.
 * @param remotePath The path of the file to be downloaded
 * @param localPath The path to the destination file
 * @param options SSH connection options
 */
export async function scpDownloadCommand(
  remotePath: string,
  localPath: string,
  options: SshOptions
): Promise<void> {
  const {
    host,
    port = 22,
    timeout = TIMEOUTS.default * 1000,
    username,
    privateKey,
    password
  } = options;

  return new Promise((resolve, reject) => {
    const conn = new Client();

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
      
      if (err.message.includes('ECONNREFUSED')) {
        console.error(`Connection refused to ${host}:${port}`);
      }
      
      reject(err);
    });

    // Use same connection config as sshCommand
    const connectionConfig: any = {
      host,
      port,
      username: username || process.env.USER || 'root',
      readyTimeout: timeout
    };

    if (privateKey) {
      connectionConfig.privateKey = privateKey;
    } else if (password) {
      connectionConfig.password = password;
    } else {
      const defaultKeyPaths = [
        `${process.env.HOME}/.ssh/id_rsa`,
        `${process.env.HOME}/.ssh/id_ed25519`
      ];

      for (const keyPath of defaultKeyPaths) {
        if (fs.existsSync(keyPath)) {
          try {
            connectionConfig.privateKey = fs.readFileSync(keyPath);
            break;
          } catch (error) {
            console.warn(`Failed to read SSH key from ${keyPath}: ${error}`);
          }
        }
      }
    }

    conn.connect(connectionConfig);
  });
}

/**
 * Creates SSH options from environment variables or defaults
 * @param host The target host
 * @param port The SSH port (default: 22)
 * @returns SSH options object
 */
export function createSshOptions(host: string, port: number = 22): SshOptions {
  return {
    host,
    port,
    timeout: TIMEOUTS.default * 1000,
    bufferSize: 65536,
    username: process.env.SSH_USER || process.env.USER || 'root'
  };
}