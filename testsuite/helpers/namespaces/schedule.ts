// Copyright (c) 2022-2025 SUSE LLC.
// Licensed under the terms of the MIT license.

import { ApiTest } from '../api/api_test';

export class NamespaceSchedule {
  constructor(private test: ApiTest) {}

  list_all_actions(): Promise<any[]> {
    return this.test.call('schedule.listAllActions', { sessionKey: this.test.currentToken || '' });
  }

  list_in_progress_actions(): Promise<any[]> {
    return this.test.call('schedule.listInProgressActions', { sessionKey: this.test.currentToken || '' });
  }

  list_in_progress_systems(actionId: number): Promise<any[]> {
    return this.test.call('schedule.listInProgressSystems', { sessionKey: this.test.currentToken || '', actionId });
  }

  list_completed_actions(): Promise<any[]> {
    return this.test.call('schedule.listCompletedActions', { sessionKey: this.test.currentToken || '' });
  }

  list_failed_actions(): Promise<any[]> {
    return this.test.call('schedule.listFailedActions', { sessionKey: this.test.currentToken || '' });
  }

  list_failed_systems(actionId: number): Promise<any[]> {
    return this.test.call('schedule.listFailedSystems', { sessionKey: this.test.currentToken || '', actionId });
  }

  cancel_actions(actionIds: number[]): Promise<any> {
    return this.test.call('schedule.cancelActions', { sessionKey: this.test.currentToken || '', actionIds });
  }

  fail_system_action(systemId: number, actionId: number): Promise<any> {
    return this.test.call('schedule.failSystemAction', { sessionKey: this.test.currentToken || '', sid: systemId, actionId });
  }
}
