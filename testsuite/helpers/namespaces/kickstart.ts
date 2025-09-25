// Copyright (c) 2025 SUSE LLC.
// Licensed under the terms of the MIT license.

import {ApiTest} from '../api/api_test.js';

export class NamespaceKickstart {
    public tree: NamespaceKickstartTree;
    public profile: NamespaceKickstartProfile;

    constructor(private test: ApiTest) {
        this.tree = new NamespaceKickstartTree(test);
        this.profile = new NamespaceKickstartProfile(test);
    }

    createProfile(name: string, ksTreeLabel: string, ksHost: string): Promise<any> {
        return this.test.call('kickstart.profile.createProfile', {
            sessionKey: this.test.currentToken || '',
            profileLabel: name,
            virtualizationType: 'none',
            kickstartableTreeLabel: ksTreeLabel,
            kickstartHost: ksHost,
            rootPassword: 'linux',
            updateType: 'all',
        });
    }

    async createProfileUsingImportFile(name: string, ksTreeLabel: string, fileContent: string): Promise<any> {
        return this.test.call('kickstart.importRawFile', {
            sessionKey: this.test.currentToken || '',
            profileLabel: name,
            virtualizationType: 'none',
            kickstartableTreeLabel: ksTreeLabel,
            kickstartFileContents: fileContent,
        });
    }
}

export class NamespaceKickstartProfile {
    constructor(private test: ApiTest) {
    }

    setVariables(profile: string, variables: any[]): Promise<any> {
        return this.test.call('kickstart.profile.setVariables', {
            sessionKey: this.test.currentToken || '',
            ksLabel: profile,
            variables
        });
    }
}

export class NamespaceKickstartTree {
    constructor(private test: ApiTest) {
    }

    createDistro(distro: string, path: string, label: string, installType: string): Promise<any> {
        return this.test.call('kickstart.tree.create', {
            sessionKey: this.test.currentToken || '',
            treeLabel: distro,
            basePath: path,
            channelLabel: label,
            installType
        });
    }

    createDistroWithKernelOptions(distro: string, path: string, label: string, installType: string, options: string, postOptions: string): Promise<any> {
        return this.test.call('kickstart.tree.create', {
            sessionKey: this.test.currentToken || '',
            treeLabel: distro,
            basePath: path,
            channelLabel: label,
            installType,
            kernelOptions: options,
            postKernelOptions: postOptions
        });
    }

    updateDistro(distro: string, path: string, label: string, installType: string, options: string, postOptions: string): Promise<any> {
        return this.test.call('kickstart.tree.update', {
            sessionKey: this.test.currentToken || '',
            treeLabel: distro,
            basePath: path,
            channelLabel: label,
            installType,
            kernelOptions: options,
            postKernelOptions: postOptions
        });
    }

    deleteTreeAndProfiles(distro: string): Promise<any> {
        return this.test.call('kickstart.tree.deleteTreeAndProfiles', {
            sessionKey: this.test.currentToken || '',
            treeLabel: distro
        });
    }
}
