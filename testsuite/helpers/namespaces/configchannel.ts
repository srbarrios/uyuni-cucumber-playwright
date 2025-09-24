// Copyright (c) 2025 SUSE LLC.
// Licensed under the terms of the MIT license.

import {ApiTest} from '../api/api_test';

export class NamespaceConfigchannel {
    constructor(private test: ApiTest) {
    }

    channelExists(channel: string): Promise<boolean> {
        return this.test.call('configchannel.channelExists', {
            sessionKey: this.test.currentToken || '',
            label: channel
        });
    }

    listFiles(channel: string): Promise<any[]> {
        return this.test.call('configchannel.listFiles', {sessionKey: this.test.currentToken || '', label: channel});
    }

    listSubscribedSystems(channel: string): Promise<any[]> {
        return this.test.call('configchannel.listSubscribedSystems', {
            sessionKey: this.test.currentToken || '',
            label: channel
        });
    }

    getFileRevision(channel: string, filePath: string, revision: number): Promise<any> {
        return this.test.call('configchannel.getFileRevision', {
            sessionKey: this.test.currentToken || '',
            label: channel,
            filePath,
            revision
        });
    }

    create(label: string, name: string, description: string, type: string): Promise<any> {
        return this.test.call('configchannel.create', {
            sessionKey: this.test.currentToken || '',
            label,
            name,
            description,
            type
        });
    }

    createWithPathInfo(label: string, name: string, description: string, type: string, info: any): Promise<any> {
        return this.test.call('configchannel.create', {
            sessionKey: this.test.currentToken || '',
            label,
            name,
            description,
            type,
            pathInfo: info
        });
    }

    createOrUpdatePath(channel: string, file: string, contents: string): Promise<any> {
        return this.test.call('configchannel.createOrUpdatePath', {
            sessionKey: this.test.currentToken || '',
            label: channel,
            path: file,
            isDir: false,
            pathInfo: {contents, owner: 'root', group: 'root', permissions: '644'},
        });
    }

    deployAllSystems(channel: string): Promise<any> {
        return this.test.call('configchannel.deployAllSystems', {
            sessionKey: this.test.currentToken || '',
            label: channel
        });
    }

    deleteChannels(channels: string[]): Promise<any> {
        return this.test.call('configchannel.deleteChannels', {
            sessionKey: this.test.currentToken || '',
            labels: channels
        });
    }
}
