// Copyright (c) 2025 SUSE LLC.
// Licensed under the terms of the MIT license.

import {ApiTest} from '../api/api_test.js';

export class NamespaceSchedule {
    constructor(private test: ApiTest) {
    }

    listAllActions(): Promise<any[]> {
        return this.test.call('schedule.listAllActions', {sessionKey: this.test.currentToken || ''});
    }

    listInProgressActions(): Promise<any[]> {
        return this.test.call('schedule.listInProgressActions', {sessionKey: this.test.currentToken || ''});
    }

    listInProgressSystems(actionId: number): Promise<any[]> {
        return this.test.call('schedule.listInProgressSystems', {sessionKey: this.test.currentToken || '', actionId});
    }

    listCompletedActions(): Promise<any[]> {
        return this.test.call('schedule.listCompletedActions', {sessionKey: this.test.currentToken || ''});
    }

    listFailedActions(): Promise<any[]> {
        return this.test.call('schedule.listFailedActions', {sessionKey: this.test.currentToken || ''});
    }

    listFailedSystems(actionId: number): Promise<any[]> {
        return this.test.call('schedule.listFailedSystems', {sessionKey: this.test.currentToken || '', actionId});
    }

    cancelActions(actionIds: number[]): Promise<any> {
        return this.test.call('schedule.cancelActions', {sessionKey: this.test.currentToken || '', actionIds});
    }

    failSystemAction(systemId: number, actionId: number): Promise<any> {
        return this.test.call('schedule.failSystemAction', {
            sessionKey: this.test.currentToken || '',
            sid: systemId,
            actionId
        });
    }
}
