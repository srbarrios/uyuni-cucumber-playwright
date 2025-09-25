// Copyright (c) 2025 SUSE LLC.
// Licensed under the terms of the MIT license.

import {ApiTest} from '../api/api_test.js';
import {getTarget} from "../system/remote_nodes_env.js";

export class NamespaceSystem {
    public config: NamespaceSystemConfig;
    public custominfo: NamespaceSystemCustominfo;
    public provisioning: NamespaceSystemProvisioning;
    public scap: NamespaceSystemScap;
    public search: NamespaceSystemSearch;

    constructor(private test: ApiTest) {
        this.config = new NamespaceSystemConfig(test);
        this.custominfo = new NamespaceSystemCustominfo(test);
        this.provisioning = new NamespaceSystemProvisioning(test);
        this.scap = new NamespaceSystemScap(test);
        this.search = new NamespaceSystemSearch(test);
    }

    async retrieveServerId(server: string): Promise<number | null> {
        const systems = await this.listSystems();
        if (!Array.isArray(systems)) throw new Error('Cannot list systems');
        const match = systems.find((s: any) => s.name === server);
        if (!match) throw new Error(`Cannot find ${server}`);
        return match.id ?? null;
    }


    async bootstrapSystem(host: string, activationKey: string, saltSsh: boolean): Promise<any> {
        if (!await getTarget('proxy')) {
            return this.test.call('system.bootstrap', {
                sessionKey: this.test.currentToken || '',
                host,
                sshPort: 22,
                sshUser: 'root',
                sshPassword: 'linux',
                activationKey,
                saltSSH: saltSsh
            });
        } else {
            const proxy = this.test.call('system.searchByName', {
                sessionKey: this.test.currentToken || '',
                regexp: (await getTarget('proxy')).fullHostname
            });
            const proxyId = Array.isArray(proxy) ? proxy.map((s: any) => s.id)[0] : undefined;
            return this.test.call('system.bootstrap', {
                sessionKey: this.test.currentToken || '',
                host,
                sshPort: 22,
                sshUser: 'root',
                sshPassword: 'linux',
                activationKey,
                proxyId,
                saltSSH: saltSsh
            });
        }
    }

    listSystems(): Promise<any[]> {
        return this.test.call('system.listSystems', {sessionKey: this.test.currentToken || ''});
    }

    searchByName(name: string): Promise<any[]> {
        return this.test.call('system.searchByName', {sessionKey: this.test.currentToken || '', regexp: name});
    }

    listAllInstallablePackages(serverId: number): Promise<any[]> {
        return this.test.call('system.listAllInstallablePackages', {
            sessionKey: this.test.currentToken || '',
            sid: serverId
        });
    }

    listLatestUpgradablePackages(serverId: number): Promise<any[]> {
        return this.test.call('system.listLatestUpgradablePackages', {
            sessionKey: this.test.currentToken || '',
            sid: serverId
        });
    }

    scheduleApplyHighstate(serverId: number, date: string, testMode: boolean): Promise<any> {
        return this.test.call('system.scheduleApplyHighstate', {
            sessionKey: this.test.currentToken || '',
            sid: serverId,
            earliestOccurrence: date,
            test: testMode
        });
    }

    schedulePackageRefresh(serverId: number, date: string): Promise<any> {
        return this.test.call('system.schedulePackageRefresh', {
            sessionKey: this.test.currentToken || '',
            sid: serverId,
            earliestOccurrence: date
        });
    }

    scheduleReboot(serverId: number, date: string): Promise<any> {
        return this.test.call('system.scheduleReboot', {
            sessionKey: this.test.currentToken || '',
            sid: serverId,
            earliestOccurrence: date
        });
    }

    scheduleScriptRun(serverId: number, uid: string, gid: string, timeout: number, script: string, date: string): Promise<any> {
        return this.test.call('system.scheduleScriptRun', {
            sessionKey: this.test.currentToken || '',
            sid: serverId,
            username: uid,
            groupname: gid,
            timeout,
            script,
            earliestOccurrence: date
        });
    }

    createSystemRecord(name: string, ksLabel: string, kOptions: string, comment: string, netDevices: Record<string, any>): Promise<any> {
        return this.test.call('system.createSystemRecord', {
            sessionKey: this.test.currentToken || '',
            systemName: name,
            ksLabel,
            kOptions,
            comment,
            netDevices
        });
    }

    createSystemRecordWithSid(sid: number, ksLabel: string): Promise<any> {
        return this.test.call('system.createSystemRecord', {sessionKey: this.test.currentToken || '', sid, ksLabel});
    }

    createSystemProfile(name: string, data: string): Promise<any> {
        return this.test.call('system.createSystemProfile', {
            sessionKey: this.test.currentToken || '',
            systemName: name,
            data
        });
    }

    listEmptySystemProfiles(): Promise<any[]> {
        return this.test.call('system.listEmptySystemProfiles', {sessionKey: this.test.currentToken || ''});
    }

    obtainReactivationKey(serverId: number): Promise<string> {
        return this.test.call('system.obtainReactivationKey', {
            sessionKey: this.test.currentToken || '',
            sid: serverId
        });
    }

    setVariables(serverId: number, variables: any[]): Promise<any> {
        return this.test.call('system.setVariables', {
            sessionKey: this.test.currentToken || '',
            sid: serverId,
            netboot: true,
            variables
        });
    }

    getSystemErrata(systemId: number): Promise<any[]> {
        return this.test.call('system.getRelevantErrata', {sessionKey: this.test.currentToken || '', sid: systemId});
    }

    getSystemsErrata(systemIds: number[]): Promise<any[]> {
        return this.test.call('system.getRelevantErrata', {sessionKey: this.test.currentToken || '', sids: systemIds});
    }

    getEventHistory(systemId: number, offset: number, limit: number): Promise<any[]> {
        return this.test.call('system.getEventHistory', {
            sessionKey: this.test.currentToken || '',
            sid: systemId,
            offset,
            limit
        });
    }

    getEventDetails(systemId: number, eventId: number | string): Promise<any> {
        return this.test.call('system.getEventDetails', {
            sessionKey: this.test.currentToken || '',
            sid: systemId,
            eid: eventId
        });
    }
}

export class NamespaceSystemConfig {
    constructor(private test: ApiTest) {
    }

    removeChannels(servers: number[], channels: string[]): Promise<any> {
        return this.test.call('system.config.removeChannels', {
            sessionKey: this.test.currentToken || '',
            sids: servers,
            configChannelLabels: channels
        });
    }
}

export class NamespaceSystemCustominfo {
    constructor(private test: ApiTest) {
    }

    createKey(value: string, desc: string): Promise<any> {
        return this.test.call('system.custominfo.createKey', {
            sessionKey: this.test.currentToken || '',
            keyLabel: value,
            keyDescription: desc
        });
    }
}

export class NamespaceSystemProvisioning {
    public powermanagement: NamespaceSystemProvisioningPowermanagement;

    constructor(private test: ApiTest) {
        this.powermanagement = new NamespaceSystemProvisioningPowermanagement(test);
    }
}

export class NamespaceSystemProvisioningPowermanagement {
    constructor(private test: ApiTest) {
    }

    listTypes(): Promise<any[]> {
        return this.test.call('system.provisioning.powermanagement.listTypes', {sessionKey: this.test.currentToken || ''});
    }

    getDetails(serverId: number): Promise<any> {
        return this.test.call('system.provisioning.powermanagement.getDetails', {
            sessionKey: this.test.currentToken || '',
            sid: serverId
        });
    }

    getStatus(serverId: number): Promise<any> {
        return this.test.call('system.provisioning.powermanagement.getStatus', {
            sessionKey: this.test.currentToken || '',
            sid: serverId
        });
    }

    setDetails(serverId: number, data: any): Promise<any> {
        return this.test.call('system.provisioning.powermanagement.setDetails', {
            sessionKey: this.test.currentToken || '',
            sid: serverId,
            data
        });
    }

    powerOn(serverId: number): Promise<any> {
        return this.test.call('system.provisioning.powermanagement.powerOn', {
            sessionKey: this.test.currentToken || '',
            sid: serverId
        });
    }

    powerOff(serverId: number): Promise<any> {
        return this.test.call('system.provisioning.powermanagement.powerOff', {
            sessionKey: this.test.currentToken || '',
            sid: serverId
        });
    }

    reboot(serverId: number): Promise<any> {
        return this.test.call('system.provisioning.powermanagement.reboot', {
            sessionKey: this.test.currentToken || '',
            sid: serverId
        });
    }
}

export class NamespaceSystemScap {
    constructor(private test: ApiTest) {
    }

    listXccdfScans(serverId: number): Promise<any[]> {
        return this.test.call('system.scap.listXccdfScans', {sessionKey: this.test.currentToken || '', sid: serverId});
    }
}

export class NamespaceSystemSearch {
    constructor(private test: ApiTest) {
    }

    hostname(server: string): Promise<any> {
        return this.test.call('system.search.hostname', {sessionKey: this.test.currentToken || '', searchTerm: server});
    }
}
