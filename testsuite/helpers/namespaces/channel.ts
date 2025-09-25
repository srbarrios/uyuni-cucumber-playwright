// Copyright (c) 2025 SUSE LLC.
// Licensed under the terms of the MIT license.

import {ApiTest} from '../api/api_test.js';

/**
 * Channel namespace wrapper
 */
export class NamespaceChannel {
    public software: NamespaceChannelSoftware;
    public appstreams: NamespaceChannelAppstreams;
    private test: ApiTest;

    constructor(apiTest: ApiTest) {
        this.test = apiTest;
        this.software = new NamespaceChannelSoftware(apiTest);
        this.appstreams = new NamespaceChannelAppstreams(apiTest);
    }

    async getSoftwareChannelsCount(): Promise<number> {
        const channels = await this.test.call('channel.listSoftwareChannels', {sessionKey: this.test.currentToken || ''});
        return Array.isArray(channels) ? channels.length : 0;
    }

    async verifyChannel(label: string): Promise<boolean> {
        const channels = await this.test.call('channel.listSoftwareChannels', {sessionKey: this.test.currentToken || ''});
        if (!Array.isArray(channels)) return false;
        const labels = channels.map((c: any) => c.label || c['label']);
        return labels.includes(label);
    }

    async listAllChannels(): Promise<Record<string, any>> {
        const channels = await this.test.call('channel.listAllChannels', {sessionKey: this.test.currentToken || ''});
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

    async listSoftwareChannels(): Promise<string[]> {
        const channels = await this.test.call('channel.listSoftwareChannels', {sessionKey: this.test.currentToken || ''});
        return Array.isArray(channels) ? channels.map((c: any) => c.label || c['label']) : [];
    }
}

export class NamespaceChannelSoftware {
    constructor(private test: ApiTest) {
    }

    create(label: string, name: string, summary: string, arch: string, parent?: string): Promise<any> {
        return this.test.call('channel.software.create', {
            sessionKey: this.test.currentToken || '',
            label,
            name,
            summary,
            archLabel: arch,
            parentLabel: parent
        });
    }

    delete(label: string): Promise<any> {
        return this.test.call('channel.software.delete', {
            sessionKey: this.test.currentToken || '',
            channelLabel: label
        });
    }

    createRepo(label: string, url: string, type: string = 'yum'): Promise<any> {
        return this.test.call('channel.software.createRepo', {
            sessionKey: this.test.currentToken || '',
            label,
            type,
            url
        });
    }

    associateRepo(channelLabel: string, repoLabel: string): Promise<any> {
        return this.test.call('channel.software.associateRepo', {
            sessionKey: this.test.currentToken || '',
            channelLabel,
            repoLabel
        });
    }

    removeRepo(label: string): Promise<any> {
        return this.test.call('channel.software.removeRepo', {sessionKey: this.test.currentToken || '', label});
    }

    async parentChannel(child: string, parent: string): Promise<boolean> {
        const channel = await this.test.call('channel.software.getDetails', {
            sessionKey: this.test.currentToken || '',
            channelLabel: child
        });
        return channel?.parent_channel_label === parent || channel?.parentLabel === parent;
    }

    getDetails(label: string): Promise<any> {
        return this.test.call('channel.software.getDetails', {
            sessionKey: this.test.currentToken || '',
            channelLabel: label
        });
    }

    async listChildChannels(parentLabel: string): Promise<string[]> {
        const channels = await this.test.call('channel.listSoftwareChannels', {sessionKey: this.test.currentToken || ''});
        const labels = Array.isArray(channels) ? channels.map((c: any) => c.label || c['label']) : [];
        const filtered: string[] = [];
        for (const l of labels) {
            if (await this.parentChannel(l, parentLabel)) filtered.push(l);
        }
        return filtered;
    }

    async listUserRepos(): Promise<string[]> {
        const repos = await this.test.call('channel.software.listUserRepos', {sessionKey: this.test.currentToken || ''});
        return Array.isArray(repos) ? repos.map((r: any) => r.label || r['label']) : [];
    }

    async listSystemChannels(systemId: number): Promise<string[]> {
        const channels = await this.test.call('channel.software.listSystemChannels', {
            sessionKey: this.test.currentToken || '',
            sid: systemId
        });
        return Array.isArray(channels) ? channels.map((c: any) => c.name || c['name']) : [];
    }
}

export class NamespaceChannelAppstreams {
    constructor(private test: ApiTest) {
    }

    isModular(label: string): Promise<boolean> {
        return this.test.call('channel.appstreams.isModular', {
            sessionKey: this.test.currentToken || '',
            channelLabel: label
        });
    }

    async listModularChannels(): Promise<string[]> {
        const channels = await this.test.call('channel.appstreams.listModular', {sessionKey: this.test.currentToken || ''});
        return Array.isArray(channels) ? channels.map((c: any) => c.name || c['name']) : [];
    }

    listModuleStreams(label: string): Promise<any[]> {
        return this.test.call('channel.appstreams.listModuleStreams', {
            sessionKey: this.test.currentToken || '',
            channelLabel: label
        });
    }
}
