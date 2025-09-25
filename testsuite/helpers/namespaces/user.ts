// Copyright (c) 2025 SUSE LLC.
// Licensed under the terms of the MIT license.

import {ApiTest} from '../api/api_test.js';

export class NamespaceUser {
    constructor(private test: ApiTest) {
    }

    listUsers(): Promise<any[]> {
        return this.test.call('user.listUsers', {sessionKey: this.test.currentToken || ''});
    }

    listRoles(user: string): Promise<any[]> {
        return this.test.call('user.listRoles', {sessionKey: this.test.currentToken || '', login: user});
    }

    create(user: string, password: string, first: string, last: string, email: string): Promise<any> {
        return this.test.call('user.create', {
            sessionKey: this.test.currentToken || '',
            login: user,
            password,
            firstName: first,
            lastName: last,
            email
        });
    }

    delete(user: string): Promise<any> {
        return this.test.call('user.delete', {sessionKey: this.test.currentToken || '', login: user});
    }

    addRole(user: string, role: string): Promise<any> {
        return this.test.call('user.addRole', {sessionKey: this.test.currentToken || '', login: user, role});
    }

    removeRole(user: string, role: string): Promise<any> {
        return this.test.call('user.removeRole', {sessionKey: this.test.currentToken || '', login: user, role});
    }

    getDetails(user: string): Promise<any> {
        return this.test.call('user.getDetails', {sessionKey: this.test.currentToken || '', login: user});
    }
}
