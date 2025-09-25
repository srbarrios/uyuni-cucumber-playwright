// Copyright (c) 2025 SUSE LLC.
// Licensed under the terms of the MIT license.

import {ApiTest} from '../api/api_test.js';

export interface ActionChainAction {
    id: number;
    label?: string;

    [key: string]: any;
}

export class NamespaceActionchain {
    constructor(private test: ApiTest) {
    }

    async listChains(): Promise<string[]> {
        const res = await this.test.call('actionchain.listChains', {sessionKey: this.test.currentToken || ''});
        return Array.isArray(res) ? res.map((x: any) => x.label || x['label']) : [];
    }

    createChain(label: string): Promise<any> {
        return this.test.call('actionchain.createChain', {sessionKey: this.test.currentToken || '', chainLabel: label});
    }

    deleteChain(label: string): Promise<any> {
        return this.test.call('actionchain.deleteChain', {sessionKey: this.test.currentToken || '', chainLabel: label});
    }

    removeAction(label: string, actionId: number): Promise<any> {
        return this.test.call('actionchain.removeAction', {
            sessionKey: this.test.currentToken || '',
            chainLabel: label,
            actionId
        });
    }

    renameChain(oldLabel: string, newLabel: string): Promise<any> {
        return this.test.call('actionchain.renameChain', {
            sessionKey: this.test.currentToken || '',
            previousLabel: oldLabel,
            newLabel
        });
    }

    addScriptRun(systemId: number, label: string, uid: string, gid: string, timeout: number, script: string): Promise<any> {
        const scriptBody = Buffer.from(script, 'utf8').toString('base64');
        return this.test.call('actionchain.addScriptRun', {
            sessionKey: this.test.currentToken || '',
            sid: systemId,
            chainLabel: label,
            uid,
            gid,
            timeout,
            scriptBody
        });
    }

    async listChainActions(label: string): Promise<ActionChainAction[]> {
        const res = await this.test.call('actionchain.listChainActions', {
            sessionKey: this.test.currentToken || '',
            chainLabel: label
        });
        return Array.isArray(res) ? res : [];
    }

    addSystemReboot(systemId: number, label: string): Promise<any> {
        return this.test.call('actionchain.addSystemReboot', {
            sessionKey: this.test.currentToken || '',
            sid: systemId,
            chainLabel: label
        });
    }

    addPackageInstall(systemId: number, packageIds: number[] | string[], label: string): Promise<any> {
        return this.test.call('actionchain.addPackageInstall', {
            sessionKey: this.test.currentToken || '',
            sid: systemId,
            packageIds,
            chainLabel: label
        });
    }

    addPackageUpgrade(systemId: number, packageIds: number[] | string[], label: string): Promise<any> {
        return this.test.call('actionchain.addPackageUpgrade', {
            sessionKey: this.test.currentToken || '',
            sid: systemId,
            packageIds,
            chainLabel: label
        });
    }

    addPackageVerify(systemId: number, packageIds: number[] | string[], label: string): Promise<any> {
        return this.test.call('actionchain.addPackageVerify', {
            sessionKey: this.test.currentToken || '',
            sid: systemId,
            packageIds,
            chainLabel: label
        });
    }

    addPackageRemoval(systemId: number, packageIds: number[] | string[], label: string): Promise<any> {
        return this.test.call('actionchain.addPackageRemoval', {
            sessionKey: this.test.currentToken || '',
            sid: systemId,
            packageIds,
            chainLabel: label
        });
    }

    scheduleChain(label: string, earliest: string): Promise<any> {
        return this.test.call('actionchain.scheduleChain', {
            sessionKey: this.test.currentToken || '',
            chainLabel: label,
            date: earliest
        });
    }
}
