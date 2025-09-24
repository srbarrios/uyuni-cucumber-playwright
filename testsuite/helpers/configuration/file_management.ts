// Copyright (c) 2023-2025 SUSE LLC
// Licensed under the terms of the MIT license.

import * as fs from 'fs/promises';
import * as path from 'path';
import { RemoteNode } from '../system/remote_node';
import { getTarget } from '../system/remote_nodes_env';
import { GLOBAL_VARS } from '../core/env';

// Check if a file exists on the given node
export async function fileExists(node: RemoteNode, file: string): Promise<boolean> {
  return node.file_exists ? node.file_exists(file) : (await node.runLocal(`test -f ${file}`, { checkErrors: false })).returnCode === 0;
}

// Delete a file on the specified node
export async function fileDelete(node: RemoteNode, file: string): Promise<void> {
  if (node.file_delete) {
    await node.file_delete(file);
  } else {
    await node.runLocal(`rm -f ${file}`);
  }
}

// Check if a folder exists on the given node
export async function folderExists(node: RemoteNode, folder: string): Promise<boolean> {
  return node.folder_exists ? node.folder_exists(folder) : (await node.runLocal(`test -d ${folder}`, { checkErrors: false })).returnCode === 0;
}

// Delete a folder on the specified node
export async function folderDelete(node: RemoteNode, folder: string): Promise<void> {
  if (node.folder_delete) {
    await node.folder_delete(folder);
  } else {
    await node.runLocal(`rm -rf ${folder}`);
  }
}

// Extract a remote file to a local file on the controller
export async function fileExtract(node: RemoteNode, remoteFile: string, localFile: string): Promise<boolean> {
  return node.extract ? await node.extract(remoteFile, localFile) : (await node.scpDownload(remoteFile, localFile), true);
}

// Inject a local file into a remote node
export async function fileInject(node: RemoteNode, localFile: string, remoteFile: string): Promise<boolean> {
  return node.inject ? await node.inject(localFile, remoteFile) : (await node.scpUpload(localFile, remoteFile), true);
}

// Generate a temporary file with given name and content on the controller; returns the path
export async function generateTempFile(name: string, content: string): Promise<string> {
  const tmpDir = process.env.TMPDIR || '/tmp';
  const filePath = path.join(tmpDir, `${name}-${Date.now()}`);
  await fs.writeFile(filePath, content, 'utf8');
  return filePath;
}

// Create salt pillar file in the default pillar_roots location on server
export async function injectSaltPillarFile(source: string, file: string): Promise<boolean> {
  const server = getTarget('server');
  const pillarsDir = '/srv/pillar/';
  const dest = path.posix.join(pillarsDir, file);
  const success = await fileInject(server, source, dest);
  if (!success) throw new Error('File injection failed');
  await server.run(`chown -R salt:salt ${dest}`);
  return success;
}

// Read the value of a variable from a given file on a given host
export async function getVariableFromConfFile(host: string, filePath: string, variableName: string): Promise<string> {
  const node = getTarget(host);
  const { stdout, exitCode } = await node.run(`sed -n 's/^${variableName} = \\(.\\*\\)/\\1/p' < ${filePath}`);
  if (exitCode !== 0) throw new Error(`Reading ${variableName} from file on ${host} ${filePath} failed`);
  return stdout.trim();
}

// Attempt to retrieve SHA256 checksum path for a file within a directory or download from same base URL
export async function getChecksumPath(dir: string, originalFileName: string, fileUrl: string): Promise<string> {
  const checksumFileNames = [
    'CHECKSUM',
    'SHA256SUMS',
    'sha256sum.txt',
    `${originalFileName}.CHECKSUM`,
    `${originalFileName}.sha256`,
  ];

  const server = getTarget('server');
  if (GLOBAL_VARS.mirror) {
    const { stdout } = await server.run(`ls -1 ${dir}`, { runsInContainer: false });
    const files = stdout.split('\n');
    const found = files.find((f) => checksumFileNames.includes(f));
    if (!found) throw new Error(`SHA256 checksum file not found in ${dir}`);
    return `${dir}/${found}`;
  } else {
    const baseUrl = fileUrl.replace(originalFileName, '');
    for (const name of checksumFileNames) {
      const checksumUrl = `${baseUrl}${name}`;
      const { exitCode } = await server.run(`cd ${dir} && curl --insecure --fail ${checksumUrl} -o ${name}`, { runsInContainer: false, timeout: 10, checkErrors: false });
      if (exitCode === 0) return `${dir}/${name}`;
    }
    throw new Error(`No SHA256 checksum file to download found for file at ${fileUrl}`);
  }
}

// Validate checksum with a given checksum file that references the original file name
export async function validateChecksumWithFile(originalFileName: string, filePath: string, checksumPath: string): Promise<boolean> {
  const server = getTarget('server');
  const { stdout } = await server.runLocal(`grep -v '^#' ${checksumPath} | grep '${originalFileName}'`, { checkErrors: false });
  if (!stdout) throw new Error(`SHA256 checksum entry for ${originalFileName} not found in ${checksumPath}`);
  const match = stdout.match(/\b([0-9a-fA-F]{64})\b/);
  if (!match) throw new Error(`SHA256 checksum not found in entry: ${stdout}`);
  const expected = match[1];
  return validateChecksum(filePath, expected);
}

// Compute SHA256 of a file on the server and compare with expected
export async function validateChecksum(filePath: string, expectedChecksum: string): Promise<boolean> {
  const server = getTarget('server');
  const { stdout } = await server.run(`sha256sum -b ${filePath} | awk '{print $1}'`, { runsInContainer: false });
  return stdout.trim() === expectedChecksum;
}

// Check if a repository URL is a development repository
export function isDevelRepo(repoUrl: string): boolean {
  const url = repoUrl.toLowerCase();
  return (url.includes('devel') || url.includes('systemsmanagement')) && !url.includes('sle-module');
}
