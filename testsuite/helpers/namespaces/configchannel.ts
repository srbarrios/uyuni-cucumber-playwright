// Copyright (c) 2022-2025 SUSE LLC.
// Licensed under the terms of the MIT license.

import { ApiTest } from '../api/api_test';

export class NamespaceConfigchannel {
  constructor(private test: ApiTest) {}

  channel_exists(channel: string): Promise<boolean> {
    return this.test.call('configchannel.channelExists', { sessionKey: this.test.currentToken || '', label: channel });
  }

  list_files(channel: string): Promise<any[]> {
    return this.test.call('configchannel.listFiles', { sessionKey: this.test.currentToken || '', label: channel });
  }

  list_subscribed_systems(channel: string): Promise<any[]> {
    return this.test.call('configchannel.listSubscribedSystems', { sessionKey: this.test.currentToken || '', label: channel });
  }

  get_file_revision(channel: string, filePath: string, revision: number): Promise<any> {
    return this.test.call('configchannel.getFileRevision', { sessionKey: this.test.currentToken || '', label: channel, filePath, revision });
  }

  create(label: string, name: string, description: string, type: string): Promise<any> {
    return this.test.call('configchannel.create', { sessionKey: this.test.currentToken || '', label, name, description, type });
  }

  create_with_pathinfo(label: string, name: string, description: string, type: string, info: any): Promise<any> {
    return this.test.call('configchannel.create', { sessionKey: this.test.currentToken || '', label, name, description, type, pathInfo: info });
  }

  create_or_update_path(channel: string, file: string, contents: string): Promise<any> {
    return this.test.call('configchannel.createOrUpdatePath', {
      sessionKey: this.test.currentToken || '',
      label: channel,
      path: file,
      isDir: false,
      pathInfo: { contents, owner: 'root', group: 'root', permissions: '644' },
    });
  }

  deploy_all_systems(channel: string): Promise<any> {
    return this.test.call('configchannel.deployAllSystems', { sessionKey: this.test.currentToken || '', label: channel });
  }

  delete_channels(channels: string[]): Promise<any> {
    return this.test.call('configchannel.deleteChannels', { sessionKey: this.test.currentToken || '', labels: channels });
  }
}
