// Copyright (c) 2022-2025 SUSE LLC.
// Licensed under the terms of the MIT license.

import { ApiTest } from '../api/api_test';

/**
 * Channel namespace wrapper
 */
export class NamespaceChannel {
  private test: ApiTest;
  public software: NamespaceChannelSoftware;
  public appstreams: NamespaceChannelAppstreams;

  constructor(apiTest: ApiTest) {
    this.test = apiTest;
    this.software = new NamespaceChannelSoftware(apiTest);
    this.appstreams = new NamespaceChannelAppstreams(apiTest);
  }

  async get_software_channels_count(): Promise<number> {
    const channels = await this.test.call('channel.listSoftwareChannels', { sessionKey: this.test.currentToken || '' });
    return Array.isArray(channels) ? channels.length : 0;
  }

  async verify_channel(label: string): Promise<boolean> {
    const channels = await this.test.call('channel.listSoftwareChannels', { sessionKey: this.test.currentToken || '' });
    if (!Array.isArray(channels)) return false;
    const labels = channels.map((c: any) => c.label || c['label']);
    return labels.includes(label);
  }

  async list_all_channels(): Promise<Record<string, any>> {
    const channels = await this.test.call('channel.listAllChannels', { sessionKey: this.test.currentToken || '' });
    if (!Array.isArray(channels)) return {};
    const mapped = channels.map((ch: any) => [
      ch.label || ch['label'],
      {
        id: ch.id,
        name: ch.name,
        provider_name: ch.provider_name,
        packages: ch.packages,
        systems: ch.systems,
        arch_name: ch.arch_name,
      },
    ]);
    return Object.fromEntries(mapped);
  }

  async list_software_channels(): Promise<string[]> {
    const channels = await this.test.call('channel.listSoftwareChannels', { sessionKey: this.test.currentToken || '' });
    return Array.isArray(channels) ? channels.map((c: any) => c.label || c['label']) : [];
  }
}

export class NamespaceChannelSoftware {
  constructor(private test: ApiTest) {}

  create(label: string, name: string, summary: string, arch: string, parent?: string): Promise<any> {
    return this.test.call('channel.software.create', { sessionKey: this.test.currentToken || '', label, name, summary, archLabel: arch, parentLabel: parent });
  }

  delete(label: string): Promise<any> {
    return this.test.call('channel.software.delete', { sessionKey: this.test.currentToken || '', channelLabel: label });
  }

  createRepo(label: string, url: string, type: string = 'yum'): Promise<any> {
    return this.test.call('channel.software.createRepo', { sessionKey: this.test.currentToken || '', label, type, url });
  }

  associateRepo(channelLabel: string, repoLabel: string): Promise<any> {
    return this.test.call('channel.software.associateRepo', { sessionKey: this.test.currentToken || '', channelLabel, repoLabel });
  }

  removeRepo(label: string): Promise<any> {
    return this.test.call('channel.software.removeRepo', { sessionKey: this.test.currentToken || '', label });
  }

  async parent_channel(child: string, parent: string): Promise<boolean> {
    const channel = await this.test.call('channel.software.getDetails', { sessionKey: this.test.currentToken || '', channelLabel: child });
    return channel?.parent_channel_label === parent || channel?.parentLabel === parent;
  }

  getDetails(label: string): Promise<any> {
    return this.test.call('channel.software.getDetails', { sessionKey: this.test.currentToken || '', channelLabel: label });
  }

  async list_child_channels(parentLabel: string): Promise<string[]> {
    const channels = await this.test.call('channel.listSoftwareChannels', { sessionKey: this.test.currentToken || '' });
    const labels = Array.isArray(channels) ? channels.map((c: any) => c.label || c['label']) : [];
    const filtered: string[] = [];
    for (const l of labels) {
      if (await this.parent_channel(l, parentLabel)) filtered.push(l);
    }
    return filtered;
  }

  async list_user_repos(): Promise<string[]> {
    const repos = await this.test.call('channel.software.listUserRepos', { sessionKey: this.test.currentToken || '' });
    return Array.isArray(repos) ? repos.map((r: any) => r.label || r['label']) : [];
  }

  async list_system_channels(systemId: number): Promise<string[]> {
    const channels = await this.test.call('channel.software.listSystemChannels', { sessionKey: this.test.currentToken || '', sid: systemId });
    return Array.isArray(channels) ? channels.map((c: any) => c.name || c['name']) : [];
  }
}

export class NamespaceChannelAppstreams {
  constructor(private test: ApiTest) {}

  modular(label: string): Promise<boolean> {
    return this.test.call('channel.appstreams.isModular', { sessionKey: this.test.currentToken || '', channelLabel: label });
  }

  async list_modular_channels(): Promise<string[]> {
    const channels = await this.test.call('channel.appstreams.listModular', { sessionKey: this.test.currentToken || '' });
    return Array.isArray(channels) ? channels.map((c: any) => c.name || c['name']) : [];
  }

  list_module_streams(label: string): Promise<any[]> {
    return this.test.call('channel.appstreams.listModuleStreams', { sessionKey: this.test.currentToken || '', channelLabel: label });
  }
}
