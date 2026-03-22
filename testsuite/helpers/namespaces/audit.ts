import {ApiTest} from '../api/api_test.js';

export class NamespaceAudit {
    constructor(private test: ApiTest) {
    }

    listSystemsByPatchStatus(cveIdentifier: string): Promise<any[]> {
        return this.test.call('audit.listSystemsByPatchStatus', {
            sessionKey: this.test.currentToken || '',
            cveIdentifier
        });
    }
}
