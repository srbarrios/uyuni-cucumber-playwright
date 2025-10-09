// Copyright (c) 2025 SUSE LLC.
// Licensed under the terms of the MIT license.

import * as xmlrpc from 'xmlrpc';
import {getTarget} from '../system/remote_nodes_env.js';

class CobblerTest {
    private client: xmlrpc.Client | undefined;
    private token: string | null = null;

    async init() {
        const server = await getTarget('server');
        const host = server.fullHostname || process.env.SERVER || 'localhost';
        try {
            this.client = xmlrpc.createClient({host, port: 80, path: '/cobbler_api'});
            return this.client;
        } catch (e) {
            throw new Error(`Initializing Cobbler client failed. ${e}`);
        }
    }

    async login(user: string, pass: string): Promise<string> {
        try {
            this.token = await this.methodCall<string>('login', [user, pass]);
            return this.token;
        } catch (e) {
            throw new Error(`Login to Cobbler failed. ${e}`);
        }
    }

    async logout(): Promise<void> {
        try {
            if (this.token) {
                await this.methodCall('logout', [this.token]);
                this.token = null;
            }
        } catch (e) {
            throw new Error(`Logout to Cobbler failed. ${e}`);
        }
    }

    async running(): Promise<boolean> {
        try {
            await this.methodCall('get_profiles');
            return true;
        } catch {
            return false;
        }
    }

    async getList(what: 'systems' | 'profiles' | 'distros'): Promise<string[]> {
        if (!['systems', 'profiles', 'distros'].includes(what)) {
            throw new Error(`Unknown get_list parameter '${what}'`);
        }
        const ret = await this.methodCall<any[]>(`get_${what}`);
        return Array.isArray(ret) ? ret.map((a) => a.name || a['name']) : [];
    }

    async distroCreate(name: string, kernel: string, initrd: string, breed: string = 'suse'): Promise<any> {
        try {
            const id = await this.methodCall('new_distro', [this.token]);
            await this.methodCall('modify_distro', [id, 'name', name, this.token]);
            await this.methodCall('modify_distro', [id, 'kernel', kernel, this.token]);
            await this.methodCall('modify_distro', [id, 'initrd', initrd, this.token]);
            await this.methodCall('modify_distro', [id, 'breed', breed, this.token]);
            await this.methodCall('save_distro', [id, this.token]);
            return id;
        } catch (e) {
            throw new Error(`Creating distribution failed. ${e}`);
        }
    }

    async profileCreate(name: string, distro: string, location: string): Promise<any> {
        try {
            const id = await this.methodCall('new_profile', [this.token]);
            await this.methodCall('modify_profile', [id, 'name', name, this.token]);
            await this.methodCall('modify_profile', [id, 'distro', distro, this.token]);
            await this.methodCall('modify_profile', [id, 'kickstart', location, this.token]);
            await this.methodCall('save_profile', [id, this.token]);
            return id;
        } catch (e) {
            throw new Error(`Creating or saving profile failed. ${e}`);
        }
    }

    async systemCreate(name: string, profile: string): Promise<any> {
        try {
            const id = await this.methodCall('new_system', [this.token]);
            await this.methodCall('modify_system', [id, 'name', name, this.token]);
            await this.methodCall('modify_system', [id, 'profile', profile, this.token]);
            await this.methodCall('save_system', [id, this.token]);
            return id;
        } catch (e) {
            throw new Error(`Creating or saving system failed. ${e}`);
        }
    }

    async systemRemove(name: string): Promise<void> {
        if (!(await this.elementExists('systems', name))) {
            throw new Error('System cannot be found.');
        }
        try {
            await this.methodCall('remove_system', [name, this.token]);
        } catch (e) {
            throw new Error(`Deleting system failed. ${e}`);
        }
    }

    async elementExists(element_type: 'distros' | 'profiles' | 'systems' | 'repos', name: string): Promise<boolean> {
        return this.exists(element_type, 'name', name);
    }

    async repoGetKey(name: string, key: string): Promise<any> {
        if (await this.elementExists('repos', name)) {
            return this.get('repo', name, key);
        }
        throw new Error(`Repo ${name} does not exist`);
    }

    async exists(what: string, key: string, value: any): Promise<boolean> {
        const ret = await this.methodCall<any[]>(`get_${what}`);
        for (const a of ret || []) {
            if ((a as any)[key] === value) return true;
        }
        return false;
    }

    async get(what: string, name: string, key: string): Promise<any> {
        const ret = await this.methodCall<any[]>(`get_${what}`);
        for (const a of ret || []) {
            if (a.name === name || a['name'] === name) return (a as any)[key];
        }
        return null;
    }

    async profileModify(name: string, attribute: string, value: any): Promise<any> {
        try {
            const handle = await this.methodCall('get_profile_handle', [name, this.token]);
            await this.methodCall('modify_profile', [handle, attribute, value, this.token]);
            await this.methodCall('save_profile', [handle, this.token]);
            return handle;
        } catch (e) {
            throw new Error(`Modifying/saving profile failed. ${e}`);
        }
    }

    async distroModify(name: string, attribute: string, value: any): Promise<any> {
        try {
            const handle = await this.methodCall('get_distro_handle', [name, this.token]);
            await this.methodCall('modify_distro', [handle, attribute, value, this.token]);
            await this.methodCall('save_distro', [handle, this.token]);
            return handle;
        } catch (e) {
            throw new Error(`Modifying/saving distribution failed. ${e}`);
        }
    }

    async systemModify(name: string, attribute: string, value: any): Promise<any> {
        try {
            const handle = await this.methodCall('get_system_handle', [name, this.token]);
            await this.methodCall('modify_system', [handle, attribute, value, this.token]);
            await this.methodCall('save_system', [handle, this.token]);
            return handle;
        } catch (e) {
            throw new Error(`Modifying/saving system failed. ${e}`);
        }
    }

    async distroRemove(name: string): Promise<void> {
        if (!(await this.elementExists('distros', name))) {
            throw new Error('Distribution cannot be found.');
        }
        try {
            await this.methodCall('remove_distro', [name, this.token]);
        } catch (e) {
            throw new Error(`Deleting distribution failed. ${e}`);
        }
    }

    async profileRemove(name: string): Promise<void> {
        if (!(await this.elementExists('profiles', name))) {
            throw new Error('Profile cannot be found.');
        }
        try {
            await this.methodCall('remove_profile', [name, this.token]);
        } catch (e) {
            throw new Error(`Deleting profile failed. ${e}`);
        }
    }

    getSystemHandle(name: string): Promise<any> {
        return this.methodCall('get_system_handle', [name, this.token]);
    }

    getProfileHandle(name: string): Promise<any> {
        return this.methodCall('get_profile_handle', [name, this.token]);
    }

    getDistroHandle(name: string): Promise<any> {
        return this.methodCall('get_distro_handle', [name, this.token]);
    }

    private methodCall<T = any>(method: string, params: any[] = []): Promise<T> {
        return new Promise((resolve, reject) => {
            if (!this.client) {
                return reject(new Error('Cobbler client not initialized'));
            }
            this.client.methodCall(method, params, (error: any, value: any) => {
                if (error) reject(error);
                else resolve(value as T);
            });
        });
    }
}

export default CobblerTest

/**
 * Factory function to create Cobbler test instances
 * @returns CobblerTest instance
 */
export async function createCobblerTest(): Promise<CobblerTest> {
    const cobbler = new CobblerTest();
    await cobbler.init();
    return cobbler;
}
