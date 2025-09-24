// Copyright (c) 2025 SUSE LLC.
// Licensed under the terms of the MIT license.

import {ApiTest} from '../api/api_test';

export class NamespaceImage {
    public profile: NamespaceImageProfile;
    public store: NamespaceImageStore;

    constructor(private test: ApiTest) {
        this.profile = new NamespaceImageProfile(test);
        this.store = new NamespaceImageStore(test);
    }

    delete(imageId: number | string): Promise<any> {
        return this.test.call('image.delete', {sessionKey: this.test.currentToken || '', imageId});
    }

    getDetails(imageId: number | string): Promise<any> {
        return this.test.call('image.getDetails', {sessionKey: this.test.currentToken || '', imageId});
    }

    scheduleImageBuild(profileLabel: string, version: string, buildHostId: number | string, date: string): Promise<any> {
        return this.test.call('image.scheduleImageBuild', {
            sessionKey: this.test.currentToken || '',
            profileLabel,
            version,
            buildHostId,
            earliestOccurrence: date
        });
    }

    listImages(): Promise<any[]> {
        return this.test.call('image.listImages', {sessionKey: this.test.currentToken || ''});
    }
}

export class NamespaceImageProfile {
    constructor(private test: ApiTest) {
    }

    create(label: string, type: string, storeLabel: string, path: string, activationKey: string): Promise<any> {
        return this.test.call('image.profile.create', {
            sessionKey: this.test.currentToken || '',
            label,
            type,
            storeLabel,
            path,
            activationKey
        });
    }

    delete(label: string): Promise<any> {
        return this.test.call('image.profile.delete', {sessionKey: this.test.currentToken || '', label});
    }

    setCustomValues(label: string, values: Record<string, any>): Promise<any> {
        return this.test.call('image.profile.setCustomValues', {
            sessionKey: this.test.currentToken || '',
            label,
            values
        });
    }

    deleteCustomValues(label: string, keys: string[]): Promise<any> {
        return this.test.call('image.profile.deleteCustomValues', {
            sessionKey: this.test.currentToken || '',
            label,
            keys
        });
    }

    getCustomValues(label: string): Promise<any> {
        return this.test.call('image.profile.getCustomValues', {sessionKey: this.test.currentToken || '', label});
    }

    listImageProfileTypes(): Promise<any[]> {
        return this.test.call('image.profile.listImageProfileTypes', {sessionKey: this.test.currentToken || ''});
    }

    listImageProfiles(): Promise<any[]> {
        return this.test.call('image.profile.listImageProfiles', {sessionKey: this.test.currentToken || ''});
    }

    getDetails(label: string): Promise<any> {
        return this.test.call('image.profile.getDetails', {sessionKey: this.test.currentToken || '', label});
    }

    setDetails(label: string, details: any): Promise<any> {
        return this.test.call('image.profile.setDetails', {sessionKey: this.test.currentToken || '', label, details});
    }
}

export class NamespaceImageStore {
    constructor(private test: ApiTest) {
    }

    create(label: string, uri: string, storeType: string, credentials: any = {}): Promise<any> {
        return this.test.call('image.store.create', {
            sessionKey: this.test.currentToken || '',
            label,
            uri,
            storeType,
            credentials
        });
    }

    delete(label: string): Promise<any> {
        return this.test.call('image.store.delete', {sessionKey: this.test.currentToken || '', label});
    }

    listImageStoreTypes(): Promise<any[]> {
        return this.test.call('image.store.listImageStoreTypes', {sessionKey: this.test.currentToken || ''});
    }

    listImageStores(): Promise<any[]> {
        return this.test.call('image.store.listImageStores', {sessionKey: this.test.currentToken || ''});
    }

    getDetails(label: string): Promise<any> {
        return this.test.call('image.store.getDetails', {sessionKey: this.test.currentToken || '', label});
    }

    setDetails(label: string, details: any): Promise<any> {
        return this.test.call('image.store.setDetails', {sessionKey: this.test.currentToken || '', label, details});
    }
}
