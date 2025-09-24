// Copyright (c) 2025 SUSE LLC
// Licensed under the terms of the MIT license.

import * as fs from 'fs/promises';
import * as path from 'path';
import * as yaml from 'js-yaml';
import { getTarget } from '../system/remote_nodes_env';
import { GLOBAL_VARS } from '../core/env';
import { getProduct } from '../core/commonlib';
import { RemoteNode } from '../system/remote_node';
import { getGlobalApiTest } from '../core/commonlib';

// Read terminals from massive-import-terminals.yml
export async function readTerminalsFromYaml(): Promise<string[]> {
  const filePath = path.resolve(__dirname, '../upload_files/massive-import-terminals.yml');
  const content = await fs.readFile(filePath, 'utf8');
  const tree: any = yaml.load(content);
  const branches = tree?.branches;
  if (!branches) return [];
  const firstBranch = Object.values(branches)[0] as any;
  return Object.keys(firstBranch?.terminals || {});
}

// Extract branch prefix from YAML
export async function readBranchPrefixFromYaml(): Promise<string | undefined> {
  const filePath = path.resolve(__dirname, '../upload_files/massive-import-terminals.yml');
  const content = await fs.readFile(filePath, 'utf8');
  const tree: any = yaml.load(content);
  const branches = tree?.branches;
  const firstBranch = Object.values(branches || {})[0] as any;
  return firstBranch?.branch_prefix;
}

// Determine OS image for PXE boot and terminal tests
export function computeImage(host: string): string {
  switch (host) {
    case 'pxeboot_minion':
      return globalVars.pxebootImage;
    case 'sle12sp5_terminal':
      return 'sles12sp5o';
    case 'sle15sp4_terminal':
      return 'sles15sp4o';
    case 'sle15sp7_terminal':
      return 'sles15sp7o';
    default:
      throw new Error(`Is ${host} a supported terminal?`);
  }
}

// Determine Kiwi profile filename
export async function computeKiwiProfileFilename(host: string): Promise<string> {
  const image = computeImage(host);
  const product = await getProduct(getTarget('server') as RemoteNode);
  switch (image) {
    case 'sles15sp7o':
    case 'sles15sp4o':
      return product === 'Uyuni' ? 'Kiwi/POS_Image-JeOS7_uyuni' : 'Kiwi/POS_Image-JeOS7_head';
    case 'sles12sp5o':
      return 'Kiwi/POS_Image-JeOS6_head';
    default:
      throw new Error(`Is ${image} a supported image version?`);
  }
}

// Determine Kiwi profile name
export async function computeKiwiProfileName(host: string): Promise<string> {
  const image = computeImage(host);
  const product = await getProduct(getTarget('server') as RemoteNode);
  switch (image) {
    case 'sles15sp7o':
    case 'sles15sp4o':
      return product === 'Uyuni' ? 'POS_Image_JeOS7_uyuni' : 'POS_Image_JeOS7_head';
    case 'sles12sp5o':
      return 'POS_Image_JeOS6_head';
    default:
      throw new Error(`Is ${image} a supported image version?`);
  }
}

// Determine Kiwi profile version
export function computeKiwiProfileVersion(host: string): string {
  const image = computeImage(host);
  switch (image) {
    case 'sles15sp7o':
    case 'sles15sp4o':
      return '7.0.0';
    case 'sles12sp5o':
      return '6.0.0';
    default:
      throw new Error(`Is ${image} a supported image version?`);
  }
}

// Retrieve build host id (for scheduleImageBuild)
export async function retrieveBuildHostId(): Promise<number> {
  const api = getGlobalApiTest();
  if (!api?.system?.list_systems) throw new Error('API system namespace not available');
  const systems = await api.system.list_systems();
  if (!systems) throw new Error('Cannot list systems');
  const hostname = getTarget('build_host').fullHostname;
  const match = systems.find((s: any) => s.name === hostname);
  if (!match?.id) throw new Error(`Build host ${hostname} is not yet registered?`);
  return match.id as number;
}
