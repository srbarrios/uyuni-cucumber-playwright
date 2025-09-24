// Copyright (c) 2022-2025 SUSE LLC.
// Licensed under the terms of the MIT license.

import { ApiTest } from '../api/api_test';

export interface ActionChainAction {
  id: number;
  label?: string;
  [key: string]: any;
}

export class NamespaceActionchain {
  constructor(private test: ApiTest) {}

  async list_chains(): Promise<string[]> {
    const res = await this.test.call('actionchain.listChains', { sessionKey: this.test.currentToken || '' });
    return Array.isArray(res) ? res.map((x: any) => x.label || x['label']) : [];
  }

  create_chain(label: string): Promise<any> {
    return this.test.call('actionchain.createChain', { sessionKey: this.test.currentToken || '', chainLabel: label });
  }

  delete_chain(label: string): Promise<any> {
    return this.test.call('actionchain.deleteChain', { sessionKey: this.test.currentToken || '', chainLabel: label });
  }

  remove_action(label: string, actionId: number): Promise<any> {
    return this.test.call('actionchain.removeAction', { sessionKey: this.test.currentToken || '', chainLabel: label, actionId });
  }

  rename_chain(oldLabel: string, newLabel: string): Promise<any> {
    return this.test.call('actionchain.renameChain', { sessionKey: this.test.currentToken || '', previousLabel: oldLabel, newLabel });
  }

  add_script_run(systemId: number, label: string, uid: string, gid: string, timeout: number, script: string): Promise<any> {
    const scriptBody = Buffer.from(script, 'utf8').toString('base64');
    return this.test.call('actionchain.addScriptRun', { sessionKey: this.test.currentToken || '', sid: systemId, chainLabel: label, uid, gid, timeout, scriptBody });
  }

  async list_chain_actions(label: string): Promise<ActionChainAction[]> {
    const res = await this.test.call('actionchain.listChainActions', { sessionKey: this.test.currentToken || '', chainLabel: label });
    return Array.isArray(res) ? res : [];
  }

  add_system_reboot(systemId: number, label: string): Promise<any> {
    return this.test.call('actionchain.addSystemReboot', { sessionKey: this.test.currentToken || '', sid: systemId, chainLabel: label });
  }

  add_package_install(systemId: number, packageIds: number[] | string[], label: string): Promise<any> {
    return this.test.call('actionchain.addPackageInstall', { sessionKey: this.test.currentToken || '', sid: systemId, packageIds, chainLabel: label });
  }

  add_package_upgrade(systemId: number, packageIds: number[] | string[], label: string): Promise<any> {
    return this.test.call('actionchain.addPackageUpgrade', { sessionKey: this.test.currentToken || '', sid: systemId, packageIds, chainLabel: label });
  }

  add_package_verify(systemId: number, packageIds: number[] | string[], label: string): Promise<any> {
    return this.test.call('actionchain.addPackageVerify', { sessionKey: this.test.currentToken || '', sid: systemId, packageIds, chainLabel: label });
  }

  add_package_removal(systemId: number, packageIds: number[] | string[], label: string): Promise<any> {
    return this.test.call('actionchain.addPackageRemoval', { sessionKey: this.test.currentToken || '', sid: systemId, packageIds, chainLabel: label });
  }

  schedule_chain(label: string, earliest: string): Promise<any> {
    return this.test.call('actionchain.scheduleChain', { sessionKey: this.test.currentToken || '', chainLabel: label, date: earliest });
  }
}
