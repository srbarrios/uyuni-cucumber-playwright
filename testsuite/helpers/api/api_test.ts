// Copyright (c) 2025 SUSE LLC.
// Licensed under the terms of the MIT license.

import {HttpClient} from "./http_client.js";
import {XmlrpcClient} from "./xmlrpc_client.js";
import {repeatUntilTimeout} from '../core/commonlib.js';
import {globalVars, TIMEOUTS} from '../core/env.js';
import {NamespaceApi} from '../namespaces/api.js';
import {NamespaceChannel, NamespaceChannelSoftware, NamespaceChannelAppstreams} from '../namespaces/channel.js';
import {ActionChainAction, NamespaceActionchain} from '../namespaces/actionchain.js';
import {NamespaceActivationkey} from '../namespaces/activationkey.js';
import {NamespaceAudit} from '../namespaces/audit.js';
import {NamespaceConfigchannel} from '../namespaces/configchannel.js';
import {NamespaceImage, NamespaceImageProfile, NamespaceImageStore} from '../namespaces/image.js';
import {NamespaceKickstart, NamespaceKickstartTree, NamespaceKickstartProfile} from '../namespaces/kickstart.js';
import {NamespaceSchedule} from '../namespaces/schedule.js';
import {NamespaceSystem, NamespaceSystemConfig, NamespaceSystemCustominfo, NamespaceSystemProvisioning, NamespaceSystemProvisioningPowermanagement, NamespaceSystemScap, NamespaceSystemSearch} from '../namespaces/system.js';
import {NamespaceUser} from '../namespaces/user.js';
import {getTarget} from '../system/remote_nodes_env.js';


// We'll need to create these namespace classes
// For now, we'll define placeholder interfaces
export interface INamespaceActionchain {
    listChains(): Promise<string[]>;
    createChain(label: string): Promise<any>;
    deleteChain(label: string): Promise<any>;
    removeAction(label: string, actionId: number): Promise<any>;
    renameChain(oldLabel: string, newLabel: string): Promise<any>;
    addScriptRun(systemId: number, label: string, uid: string, gid: string, timeout: number, script: string): Promise<any>;
    listChainActions(label: string): Promise<ActionChainAction[]>;
    addSystemReboot(systemId: number, label: string): Promise<any>;
    addPackageInstall(systemId: number, packageIds: number[] | string[], label: string): Promise<any>;
    addPackageUpgrade(systemId: number, packageIds: number[] | string[], label: string): Promise<any>;
    addPackageVerify(systemId: number, packageIds: number[] | string[], label: string): Promise<any>;
    addPackageRemoval(systemId: number, packageIds: number[] | string[], label: string): Promise<any>;
    scheduleChain(label: string, earliest: string): Promise<any>;
}

export interface INamespaceActivationkey {
    create(id: string, descr: string, baseChannel: string, limit: number): Promise<any>;
    delete(id: string): Promise<any>;
    getActivationKeysCount(): Promise<number>;
    getActivatedSystemsCount(id: string): Promise<number>;
    getConfigChannelsCount(id: string): Promise<number>;
    verify(id: string): Promise<boolean>;
    addConfigChannels(id: string, configChannelLabels: string[]): Promise<any>;
    addChildChannels(id: string, childChannelLabels: string[]): Promise<any>;
    getDetails(id: string): Promise<any>;
    setDetails(id: string, description: string, baseChannelLabel: string, usageLimit: number, contactMethod: 'default' | 'ssh-push' | 'ssh-push-tunnel'): Promise<boolean>;
    addEntitlements(id: string, entitlements: string[]): Promise<any>;
}

export interface INamespaceAudit {
    listSystemsByPatchStatus(cveIdentifier: string): Promise<any[]>;
}

export interface INamespaceChannelSoftware {
    create(label: string, name: string, summary: string, arch: string, parent?: string): Promise<any>;
    delete(label: string): Promise<any>;
    createRepo(label: string, url: string, type?: string): Promise<any>;
    associateRepo(channelLabel: string, repoLabel: string): Promise<any>;
    removeRepo(label: string): Promise<any>;
    parentChannel(child: string, parent: string): Promise<boolean>;
    getDetails(label: string): Promise<any>;
    listChildChannels(parentLabel: string): Promise<string[]>;
    listUserRepos(): Promise<string[]>;
    listSystemChannels(systemId: number): Promise<string[]>;
}

export interface INamespaceChannelAppstreams {
    isModular(label: string): Promise<boolean>;
    listModularChannels(): Promise<string[]>;
    listModuleStreams(label: string): Promise<any[]>;
}

export interface INamespaceChannel {
    software: INamespaceChannelSoftware;
    appstreams: INamespaceChannelAppstreams;
    getSoftwareChannelsCount(): Promise<number>;
    verifyChannel(label: string): Promise<boolean>;
    listAllChannels(): Promise<Record<string, any>>;
    listSoftwareChannels(): Promise<string[]>;
}

export interface INamespaceConfigchannel {
    channelExists(channel: string): Promise<boolean>;
    listFiles(channel: string): Promise<any[]>;
    listSubscribedSystems(channel: string): Promise<any[]>;
    getFileRevision(channel: string, filePath: string, revision: number): Promise<any>;
    create(label: string, name: string, description: string, type: string): Promise<any>;
    createWithPathInfo(label: string, name: string, description: string, type: string, info: any): Promise<any>;
    createOrUpdatePath(channel: string, file: string, contents: string): Promise<any>;
    deployAllSystems(channel: string): Promise<any>;
    deleteChannels(channels: string[]): Promise<any>;
}

export interface INamespaceImageProfile {
    create(label: string, type: string, storeLabel: string, path: string, activationKey: string): Promise<any>;
    delete(label: string): Promise<any>;
    setCustomValues(label: string, values: Record<string, any>): Promise<any>;
    deleteCustomValues(label: string, keys: string[]): Promise<any>;
    getCustomValues(label: string): Promise<any>;
    listImageProfileTypes(): Promise<any[]>;
    listImageProfiles(): Promise<any[]>;
    getDetails(label: string): Promise<any>;
    setDetails(label: string, details: any): Promise<any>;
}

export interface INamespaceImageStore {
    create(label: string, uri: string, storeType: string, credentials?: any): Promise<any>;
    delete(label: string): Promise<any>;
    listImageStoreTypes(): Promise<any[]>;
    listImageStores(): Promise<any[]>;
    getDetails(label: string): Promise<any>;
    setDetails(label: string, details: any): Promise<any>;
}

export interface INamespaceImage {
    profile: INamespaceImageProfile;
    store: INamespaceImageStore;
    delete(imageId: number | string): Promise<any>;
    getDetails(imageId: number | string): Promise<any>;
    scheduleImageBuild(profileLabel: string, version: string, buildHostId: number | string, date: string): Promise<any>;
    listImages(): Promise<any[]>;
}

export interface INamespaceKickstartProfile {
    setVariables(profile: string, variables: any[]): Promise<any>;
}

export interface INamespaceKickstartTree {
    createDistro(distro: string, path: string, label: string, installType: string): Promise<any>;
    createDistroWithKernelOptions(distro: string, path: string, label: string, installType: string, options: string, postOptions: string): Promise<any>;
    updateDistro(distro: string, path: string, label: string, installType: string, options: string, postOptions: string): Promise<any>;
    deleteTreeAndProfiles(distro: string): Promise<any>;
}

export interface INamespaceKickstart {
    tree: INamespaceKickstartTree;
    profile: INamespaceKickstartProfile;
    createProfile(name: string, ksTreeLabel: string, ksHost: string): Promise<any>;
    createProfileUsingImportFile(name: string, ksTreeLabel: string, fileContent: string): Promise<any>;
}

export interface INamespaceSchedule {
    listAllActions(): Promise<any[]>;
    listInProgressActions(): Promise<any[]>;
    listInProgressSystems(actionId: number): Promise<any[]>;
    listCompletedActions(): Promise<any[]>;
    listFailedActions(): Promise<any[]>;
    listFailedSystems(actionId: number): Promise<any[]>;
    cancelActions(actionIds: number[]): Promise<any>;
    failSystemAction(systemId: number, actionId: number): Promise<any>;
}

export interface INamespaceSystemConfig {
    removeChannels(servers: number[], channels: string[]): Promise<any>;
}

export interface INamespaceSystemCustominfo {
    createKey(value: string, desc: string): Promise<any>;
}

export interface INamespaceSystemProvisioningPowermanagement {
    listTypes(): Promise<any[]>;
    getDetails(serverId: number): Promise<any>;
    getStatus(serverId: number): Promise<any>;
    setDetails(serverId: number, data: any): Promise<any>;
    powerOn(serverId: number): Promise<any>;
    powerOff(serverId: number): Promise<any>;
    reboot(serverId: number): Promise<any>;
}

export interface INamespaceSystemProvisioning {
    powermanagement: INamespaceSystemProvisioningPowermanagement;
}

export interface INamespaceSystemScap {
    listXccdfScans(serverId: number): Promise<any[]>;
}

export interface INamespaceSystemSearch {
    hostname(server: string): Promise<any>;
}

export interface INamespaceSystem {
    config: INamespaceSystemConfig;
    custominfo: INamespaceSystemCustominfo;
    provisioning: INamespaceSystemProvisioning;
    scap: INamespaceSystemScap;
    search: INamespaceSystemSearch;
    retrieveServerId(server: string): Promise<number | null>;
    bootstrapSystem(host: string, activationKey: string, saltSsh: boolean): Promise<any>;
    listSystems(): Promise<any[]>;
    searchByName(name: string): Promise<any[]>;
    listAllInstallablePackages(serverId: number): Promise<any[]>;
    listLatestUpgradablePackages(serverId: number): Promise<any[]>;
    scheduleApplyHighstate(serverId: number, date: string, testMode: boolean): Promise<any>;
    schedulePackageRefresh(serverId: number, date: string): Promise<any>;
    scheduleReboot(serverId: number, date: string): Promise<any>;
    scheduleScriptRun(serverId: number, uid: string, gid: string, timeout: number, script: string, date: string): Promise<any>;
    createSystemRecord(name: string, ksLabel: string, kOptions: string, comment: string, netDevices: Record<string, any>): Promise<any>;
    createSystemRecordWithSid(sid: number, ksLabel: string): Promise<any>;
    createSystemProfile(name: string, data: string): Promise<any>;
    listEmptySystemProfiles(): Promise<any[]>;
    obtainReactivationKey(serverId: number): Promise<string>;
    setVariables(serverId: number, variables: any[]): Promise<any>;
    getSystemErrata(systemId: number): Promise<any[]>;
    getSystemsErrata(systemIds: number[]): Promise<any[]>;
    getEventHistory(systemId: number, offset: number, limit: number): Promise<any[]>;
    getEventDetails(systemId: number, eventId: number | string): Promise<any>;
}

export interface INamespaceUser {
    // Methods will be implemented when we convert the namespace files
}

export interface ApiConnection {
    call(name: string, params: any): Promise<any>;

    close?(): void;
}

export interface ApiCallParams {
    sessionKey?: string;

    [key: string]: any;
}

/**
 * Abstract parent class describing an API test
 */
export abstract class ApiTest {
    /**
     * Handles API lock management
     * @param name The API method name
     */
    private static adminApiLocked: boolean = false;
    // Namespace instances - these will be properly implemented when we convert namespace files
    public readonly actionchain: NamespaceActionchain;
    public readonly activationkey: NamespaceActivationkey;
    public readonly api: NamespaceApi;
    public readonly audit: NamespaceAudit;
    public readonly channel: NamespaceChannel;
    public readonly configchannel: NamespaceConfigchannel;
    public readonly image: NamespaceImage;
    public readonly kickstart: NamespaceKickstart;
    public readonly schedule: NamespaceSchedule;
    public readonly system: NamespaceSystem;
    public readonly user: NamespaceUser;
    protected connection: ApiConnection | null = null;
    protected token: string | null = null;
    private semaphore: boolean = false;

    /**
     * Creates objects that are used to interact with the API.
     * @param _host The hostname of the Spacewalk server
     */
    protected constructor(_host: string) {
        // For now, these are placeholders - will be implemented when namespace classes are converted
        this.actionchain = new NamespaceActionchain(this);
        this.activationkey = new NamespaceActivationkey(this);
        this.api = new NamespaceApi(this);
        this.audit = new NamespaceAudit(this);
        this.channel = new NamespaceChannel(this);
        this.configchannel = new NamespaceConfigchannel(this);
        this.image = new NamespaceImage(this);
        this.kickstart = new NamespaceKickstart(this);
        this.schedule = new NamespaceSchedule(this);
        this.system = new NamespaceSystem(this);
        this.user = new NamespaceUser(this);
    }

    /**
     * Get the current token
     */
    get currentToken(): string | null {
        return this.token;
    }

    /**
     * Calls a function with the given name and parameters, and returns its response.
     * @param name The name of the method you want to call
     * @param params The parameters to pass to the API call
     * @returns Promise with the response from the API call
     */
    async call(name: string, params: ApiCallParams = {}): Promise<any> {
        // Wait for semaphore to be free
        await this.waitForSemaphore();

        try {
            this.semaphore = true;

            await this.manageApiLock(name);
            return await this.makeApiCall(name, params);
        } finally {
            // Always clean up
            if (this.token && this.connection) {
                try {
                    await this.connection.call('auth.logout', {sessionKey: this.token});
                } catch (error) {
                    console.warn('Failed to logout:', error);
                }
            }

            if (name.includes('user.')) {
                this.apiUnlock();
            }

            this.semaphore = false;
        }
    }

    /**
     * Abstract method to check if an attribute is a date
     * @param attribute The attribute to check
     */
    abstract isDate(attribute: any): boolean;

    /**
     * Abstract method to get current date
     */
    abstract getCurrentDate(): any;

    /**
     * Close the connection
     */
    async close(): Promise<void> {
        if (this.connection?.close) {
            this.connection.close();
        }
    }

    /**
     * Wait for the semaphore to be free
     */
    private async waitForSemaphore(): Promise<void> {
        while (this.semaphore) {
            await new Promise(resolve => setTimeout(resolve, 10));
        }
    }

    private async manageApiLock(name: string): Promise<void> {
        if (!this.connection) {
            throw new Error('API connection not initialized');
        }

        if (name.includes('user.')) {
            // Single-process admin API lock
            await repeatUntilTimeout(async () => {
                if (!ApiTest.adminApiLocked) {
                    ApiTest.adminApiLocked = true;
                    return true;
                }
                await new Promise(resolve => setTimeout(resolve, 100));
                return false;
            }, {
                timeout: TIMEOUTS.long * 1000,
                message: 'We couldn\'t get access to the API'
            });

            this.token = await this.connection.call('auth.login', {
                login: 'admin',
                password: 'admin'
            });
        } else {
            this.token = await this.connection.call('auth.login', {
                login: globalVars.currentUser,
                password: globalVars.currentPassword
            });
        }
    }

    /**
     * Makes the actual API call
     * @param name The method name
     * @param params The parameters
     * @returns Promise with the API response
     */
    private async makeApiCall(name: string, params: ApiCallParams): Promise<any> {
        if (!this.connection || !this.token) {
            throw new Error('API connection or token not available');
        }

        const callParams = {...params, sessionKey: this.token};
        return this.connection.call(name, callParams);
    }

    /**
     * Check if API is locked (placeholder implementation)
     * @returns Promise with lock status
     */
    private async isApiLocked(): Promise<boolean> {
        return ApiTest.adminApiLocked;
    }

    /**
     * Release API lock (placeholder implementation)
     */
    private apiUnlock(): void {
        ApiTest.adminApiLocked = false;
    }
}

/**
 * Derived class for an XML-RPC test
 */
export class ApiTestXmlrpc extends ApiTest {
    /**
     * Creates a new instance with XmlrpcClient
     * @param host The hostname of the server
     */
    constructor(host: string) {
        super(host);
        this.connection = new XmlrpcClient(host);
    }

    /**
     * Returns a boolean on whether the given attribute is an XMLRPC DateTime object or not
     * @param attribute The attribute to check
     * @returns Whether the attribute is an XMLRPC DateTime object or not
     */
    isDate(attribute: any): boolean {
        // Check if it's an XML-RPC DateTime object
        // This is a simplified check - in reality, we'd need to check for specific xmlrpc DateTime structure
        return attribute &&
            typeof attribute === 'object' &&
            attribute.hasOwnProperty('year') &&
            attribute.hasOwnProperty('month') &&
            attribute.hasOwnProperty('day');
    }

    /**
     * Returns the current date and time as an XMLRPC DateTime object
     * @returns The current date and time as an XMLRPC DateTime object
     */
    getCurrentDate(): any {
        const now = new Date();
        return {
            year: now.getFullYear(),
            month: now.getMonth() + 1, // JavaScript months are 0-based
            day: now.getDate(),
            hour: now.getHours(),
            minute: now.getMinutes(),
            second: now.getSeconds()
        };
    }
}

/**
 * Derived class for an HTTP test
 */
export class ApiTestHttp extends ApiTest {
    /**
     * Creates a new instance with HttpClient
     * @param host The hostname of the server
     * @param sslVerify Whether to verify SSL certificates or not
     */
    constructor(host: string, sslVerify: boolean = true) {
        super(host);
        this.connection = new HttpClient(host, sslVerify);
    }

    /**
     * Attempts to parse a given string as a Date object, to validate it.
     * @param attribute The date string to be parsed
     * @returns Whether the attribute is a valid Date or not
     */
    isDate(attribute: any): boolean {
        try {
            const date = new Date(attribute);
            return !isNaN(date.getTime());
        } catch {
            return false;
        }
    }

    /**
     * Returns a string with the current date and time in ISO format
     * @returns The current date and time in ISO format
     */
    getCurrentDate(): string {
        return new Date().toISOString();
    }
}

/**
 * Factory function to create API test instances
 * @param host The hostname
 * @param useHttp Whether to use HTTP (true) or XML-RPC (false)
 * @param sslVerify Whether to verify SSL certificates (only for HTTP)
 * @returns ApiTest instance
 */
export function createApiTest(host: string, useHttp: boolean = false, sslVerify: boolean = true): ApiTest {
    return useHttp ? new ApiTestHttp(host, sslVerify) : new ApiTestXmlrpc(host);
}
