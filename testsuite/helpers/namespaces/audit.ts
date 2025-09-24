// Copyright (c) 2022-2025 SUSE LLC.
// Licensed under the terms of the MIT license.

import { ApiTest } from '../api/api_test';

export class NamespaceAudit {
  constructor(private test: ApiTest) {}

  list_systems_by_patch_status(cveIdentifier: string): Promise<any[]> {
    return this.test.call('audit.listSystemsByPatchStatus', {
      sessionKey: this.test.currentToken || '',
      cveIdentifier
    });
  }
}
