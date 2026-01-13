// Copyright (c) 2025 SUSE LLC.
// Licensed under the terms of the MIT license.

import {expect, Locator, Page} from '@playwright/test';
import {RemoteNode} from '../system/remote_node.js';
import {ENV_VAR_BY_HOST} from './constants.js';
import {getTarget} from '../system/remote_nodes_env.js';
import {ENV_CONFIG, getAppHost, getCurrentPage, getFeatureScope, globalVars} from './env.js';
import * as yaml from 'js-yaml';
import crypto from 'crypto';
import {ApiTest, createApiTest} from "../api/api_test.js";
import CobblerTest, {createCobblerTest} from "../configuration/cobbler_test.js";


// Type definitions
export interface UptimeInfo {
    seconds: number;
    minutes: number;
    hours: number;
    days: number;
}

export interface TimeoutOptions {
    timeout?: number;
    retries?: number;
    message?: string;
    reportResult?: boolean;
    dontRaise?: boolean;
}

export interface CommandResult {
    stdout: string;
    returnCode: number;
}

/**
 * Returns the current URL of the getCurrentPage().
 */
export function getCurrentUrl(page: Page): string {
    return getCurrentPage().url();
}

/**
 * Counts the number of items in a table by looking for items label.
 * @param page The Playwright page object
 * @returns The number of items in the table as a string
 */
export async function countTableItems(page: Page): Promise<string> {
    try {
        const itemsLabelSelector = '//button[contains(text(), "Items ")]';
        const itemsLabel = await getCurrentPage().textContent(itemsLabelSelector);
        expect(itemsLabel, 'Error counting items').not.toBeNull();
        return itemsLabel!.split('of ')[1]?.trim() || '0';
    } catch (error) {
        throw new Error('Error counting items');
    }
}

/**
 * Determines the product type (Uyuni or SUSE Manager) based on installed patterns.
 * @param serverNode The server node to check
 * @returns The product name
 */
export async function getProduct(serverNode: RemoteNode): Promise<string> {
    if (globalVars.product) {
        return globalVars.product;
    }

    try {
        const {returnCode: uyuniCode} = await serverNode.run('rpm -q patterns-uyuni_server', {checkErrors: false});
        if (uyuniCode === 0) {
            globalVars.product = 'Uyuni';
            return 'Uyuni';
        }

        const {returnCode: sumaCode} = await serverNode.run('rpm -q patterns-suma_server', {checkErrors: false});
        if (sumaCode === 0) {
            globalVars.product = 'SUSE Manager';
            return 'SUSE Manager';
        }
    } catch (error) {
        // Handle error
    }

    throw new Error('Could not determine product');
}

/**
 * Returns the version of the product
 * @param serverNode The server node to check
 * @returns The version number of the product being tested
 */
export async function getProductVersion(serverNode: RemoteNode): Promise<string> {
    try {
        const {stdout: uyuniResult, returnCode: uyuniCode} = await serverNode.run(
            'rpm -q patterns-uyuni_server',
            {checkErrors: false}
        );

        if (uyuniCode === 0) {
            const match = uyuniResult.match(/patterns-uyuni_server-(.*)-.*/);
            if (match && match[1]) {
                return match[1];
            }
        }

        const {stdout: sumaResult, returnCode: sumaCode} = await serverNode.run(
            'rpm -q patterns-suma_server',
            {checkErrors: false}
        );

        if (sumaCode === 0) {
            const match = sumaResult.match(/patterns-suma_server-(.*)-.*/);
            if (match && match[1]) {
                return match[1];
            }
        }
    } catch (error) {
        // Handle error
    }

    throw new Error('Could not determine product version');
}

/**
 * Retrieves the full product version using the 'venv-salt-call' command.
 * @param serverNode The server node to check
 * @returns The full product version if successful, otherwise undefined
 */
export async function getProductVersionFull(serverNode: RemoteNode): Promise<string | undefined> {
    try {
        const cmd = 'venv-salt-call --local grains.get product_version | tail -n 1';
        const {stdout, returnCode} = await serverNode.run(cmd);

        if (returnCode === 0 && stdout) {
            return stdout.trim();
        }
    } catch (error) {
        // Handle error silently
    }

    return undefined;
}

/** Repeats a function until it returns a truthy value or a timeout/retry limit is reached.
 *
 * @param fn
 * @param options
 */
export async function repeatUntilTimeout<T>(
    fn: () => Promise<T | boolean>, options: {
        timeout?: number;
        retries?: number;
        message?: string;
        reportResult?: boolean;
        dontRaise?: boolean;
    }): Promise<T | boolean> {

    const {
        timeout = 250000,
        retries,
        message,
        reportResult = false,
        dontRaise = false
    } = options;

    let lastResult: T | boolean | undefined;
    const startTime = Date.now();
    let attempts = 0;

    try {
        while ((Date.now() - startTime <= timeout) && (retries === undefined || attempts < retries)) {
            lastResult = await fn();
            attempts++;

            if (lastResult) {
                return lastResult;
            }

            // Small delay between attempts
            await new Promise(resolve => setTimeout(resolve, 100));
        }

        const detail = formatDetail(message, lastResult, reportResult);

        let error: Error;
        if (retries && attempts >= retries) {
            error = new Error(`Giving up after ${attempts} attempts${detail}`);
        } else {
            error = new Error(`Timeout after ${timeout}ms (repeatUntilTimeout)${detail}`);
        }

        if (dontRaise) {
            console.error(error.message);
            return false;
        }
        throw error;

    } catch (error) {
        if (dontRaise) {
            console.error(`Error: ${error}`);
            return false;
        }
        throw error;
    }
}

/**
 * Formats the detail message with optional last result and report result.
 */
function formatDetail(message?: string, lastResult?: any, reportResult: boolean = false): string {
    const formattedMessage = message ? `: ${message}` : '';
    const formattedResult = (reportResult && lastResult !== undefined) ? `, last result was: ${lastResult}` : '';
    return `${formattedMessage}${formattedResult}`;
}

/**
 * Refreshes the current page
 * @param page The Playwright page object
 */
export async function refreshPage(page: Page): Promise<void> {
    try {
        await getCurrentPage().reload({waitUntil: 'networkidle'});
    } catch (error) {
        console.warn('Error during page refresh:', error);
    }
}

/**
 * Determines the type of client based on the given name.
 * @param name The name of the client
 * @returns The type of client ('traditional' or 'salt')
 */
export function getClientType(name: string): 'traditional' | 'salt' {
    return name.includes('_client') ? 'traditional' : 'salt';
}

/**
 * Determines if a host is a SUSE host based on its name.
 * @param name The name of the host.
 * @param runsInContainer Whether the host is running in a container.
 * @returns Returns true if the host is a SUSE host, false otherwise.
 */
export async function isSuseHost(name: string, runsInContainer = true): Promise<boolean> {
    const node = await getTarget(name);
    const osFamily = (runsInContainer ? node.osFamily : node.localOsFamily) ?? '';
    const suseFamilies = ['sles', 'opensuse', 'opensuse-leap', 'sle-micro', 'suse-microos', 'opensuse-leap-micro', 'opensuse-tumbleweed'];
    return suseFamilies.includes(osFamily);
}

/**
 * Determines if the given host name is a SLE/SL Micro host.
 * @param name The host name to check.
 * @param runsInContainer Whether the host is running in a container.
 * @returns Returns true if the system is a SLE/SL Micro one.
 */
export async function slemicro_host(name: string, runsInContainer = true): Promise<boolean> {
    const node = await getTarget(name);
    const osFamily = (runsInContainer ? node.osFamily : node.localOsFamily) ?? '';
    return name.includes('slemicro') || name.includes('micro') || osFamily.includes('sle-micro') || osFamily.includes('suse-microos') || osFamily.includes('sl-micro');
}

/**
 * Determines if the given host name is an openSUSE Leap Micro host.
 * @param name The host name to check.
 * @param runsInContainer Whether the host is running in a container.
 * @returns Returns true if the system is an openSUSE Leap Micro one.
 */
export async function leapmicro_host(name: string, runsInContainer = true): Promise<boolean> {
    const node = await getTarget(name);
    const osFamily = (runsInContainer ? node.osFamily : node.localOsFamily) ?? '';
    return osFamily.includes('opensuse-leap-micro');
}

/**
 * Determines if the given host name is a transactional system.
 * Currently, only SLE/SL Micro and openSUSE Leap Micro are considered transactional.
 * @param name The host name to check.
 * @param runsInContainer Whether the host is running in a container.
 * @returns Returns true if the system is a transactional system.
 */
export async function isTransactionalSystem(name: string, runsInContainer = true): Promise<boolean> {
    return await slemicro_host(name, runsInContainer) || await leapmicro_host(name, runsInContainer);
}

/**
 * Checks if the 'proxy' host is a transactional system.
 * @returns Returns true if the proxy is transactional.
 */
export async function isSuseProxyTransactional(): Promise<boolean> {
    const proxyEnvVar = ENV_VAR_BY_HOST['proxy'];
    return !!proxyEnvVar && await isTransactionalSystem('proxy', false);
}

/**
 * Checks if the 'proxy' host is a non-transactional system.
 * @returns Returns true if the proxy is non-transactional.
 */
export async function isSuseProxyNonTransactional(): Promise<boolean> {
    const proxyEnvVar = ENV_VAR_BY_HOST['proxy'];
    return !!proxyEnvVar && !(await isTransactionalSystem('proxy', false));
}

/**
 * Determines if a given host name belongs to a Red Hat-like distribution.
 * @param name The host name to check.
 * @returns Returns true if the host name belongs to a Red Hat-like distribution, false otherwise.
 */
export async function isRhHost(name: string): Promise<boolean> {
    const node = await getTarget(name);
    const osFamily = node.osFamily ?? '';
    const rhFamilies = ['alma', 'almalinux', 'amzn', 'centos', 'liberty', 'ol', 'oracle', 'rocky', 'redhat', 'rhel'];
    return rhFamilies.includes(osFamily);
}

/**
 * Determines if the given host name is a Debian-based host.
 * @param name The host name to check.
 * @returns Returns true if the host name is Debian-based, false otherwise.
 */
export async function isDebHost(name: string): Promise<boolean> {
    const node = await getTarget(name);
    const osFamily = node.osFamily ?? '';
    const debFamilies = ['debian', 'ubuntu'];
    return debFamilies.includes(osFamily);
}

/**
 * Generates a repository name based on the provided repo URL.
 * @param repoUrl The URL of the repository
 * @returns The generated repository name
 */
export function generateRepositoryName(repoUrl: string): string {
    let repoName = repoUrl.trim();

    // Apply regex replacements (converted from Ruby's sub! method)
    const patterns = [
        /http:\/\/(download\.suse\.de|download\.opensuse\.org|minima-mirror-ci-bv\.mgr.*|.*compute\.internal)\/ibs\/SUSE:\/Maintenance:\//g,
        /http:\/\/(download\.suse\.de|download\.opensuse\.org|minima-mirror-ci-bv\.mgr.*|.*compute\.internal)\/download\/ibs\/SUSE:\/Maintenance:\//g,
        /http:\/\/(download\.suse\.de|download\.opensuse\.org|minima-mirror-ci-bv\.mgr.*|.*compute\.internal)\/download\/ibs\/SUSE:\//g,
        /http:\/\/(download\.suse\.de|download\.opensuse\.org|minima-mirror-ci-bv\.mgr.*|.*compute\.internal)\/repositories\/systemsmanagement:\//g,
        /http:\/\/(download\.suse\.de|download\.opensuse\.org|minima-mirror-ci-bv\.mgr.*|.*compute\.internal)\/SUSE:\//g,
        /http:\/\/(download\.suse\.de|download\.opensuse\.org|minima-mirror-ci-bv\.mgr.*|.*compute\.internal)\/ibs\/Devel:\/Galaxy:\/Manager:\//g,
        /http:\/\/(download\.suse\.de|download\.opensuse\.org|minima-mirror-ci-bv\.mgr.*|.*compute\.internal)\/SUSE:\/Maintenance:\//g,
        /http:\/\/(download\.suse\.de|download\.opensuse\.org|minima-mirror-ci-bv\.mgr.*|.*compute\.internal)\/ibs\/SUSE:\/SLE-15:\/Update:\/Products:\/MultiLinuxManagerTools\/images\/repo\//g,
        /http:\/\/(download\.suse\.de|download\.opensuse\.org|minima-mirror-ci-bv\.mgr.*|.*compute\.internal)\/ibs\/SUSE:\//g
    ];

    patterns.forEach(pattern => {
        repoName = repoName.replace(pattern, '');
    });

    // Replace characters
    repoName = repoName.replace(/\//g, '_').replace(/:/g, '_');

    // Limit to 64 characters due to repository label size limit
    return repoName.substring(0, 64);
}

/**
 * Retrieves the uptime of a given host.
 * @param node The remote node to check
 * @returns A hash containing the uptime in seconds, minutes, hours, and days
 */
export async function getUptimeFromHost(node: RemoteNode): Promise<UptimeInfo> {
    const {stdout: uptime} = await node.run('cat /proc/uptime');
    const seconds = parseFloat(uptime.split(' ')[0]);
    const minutes = seconds / 60.0;
    const hours = minutes / 60.0;
    const days = hours / 24.0;

    return {seconds, minutes, hours, days};
}

/**
 * Executes a SQL query on the server.
 * @param query The SQL query to execute
 * @returns The command string to execute the SQL query
 */
export function reportdbServerQuery(query: string): string {
    return `echo "${query}" | spacewalk-sql --reportdb --select-mode -`;
}

/**
 * Check if a repository exists by querying the API channel namespace
 */
export async function repositoryExist(repo: string): Promise<boolean> {
    try {
        const api = getApiTest();
        if (!api?.channel?.software?.listUserRepos()) return false;
        const list: string[] = await api.channel.software.listUserRepos();
        return Array.isArray(list) && list.includes(repo);
    } catch {
        return false;
    }
}

// Export global context and setters
export function getGlobalContext(): Record<string, any> {
    return globalVars.context;
}

export function setGlobalContext(key: string, value: any): void {
    globalVars.context[key] = value;
}

export function getApiTest(): ApiTest {
    if (!globalVars.apiTest) {
        globalVars.apiTest = createApiTest(getAppHost());
    }
    return globalVars.apiTest;
}

export async function resetApiTest(): Promise<ApiTest> {
    if (globalVars.apiTest) {
        await globalVars.apiTest.close();
        globalVars.apiTest = createApiTest(getAppHost());
    }
    return globalVars.apiTest;
}

export function setCobblerTest(cobblerTest: CobblerTest): void {
    globalVars.cobblerTest = cobblerTest;
}

export async function getCobblerTest(): Promise<CobblerTest> {
    if (!globalVars.cobblerTest) {
        // Create the instance only when it's first needed
        globalVars.cobblerTest = await createCobblerTest();
    }
    return globalVars.cobblerTest;
}

/**
 * Check text presence and handle potential request-timeout popup by reloading
 */
export async function checkTextAndCatchRequestTimeoutPopup(
    page: Page,
    locator?: Locator,
    text1?: string,
    text2?: string,
    timeoutMs?: number
): Promise<boolean> {
    timeoutMs = timeoutMs || 60000;
    if (!text1) throw new Error('No text provided to checkTextAndCatchRequestTimeoutPopup');
    if (!ENV_CONFIG.catchTimeoutMessage) {
        const found1 = await getCurrentPage().getByText(text1).isVisible({timeout: timeoutMs}).catch(() => false);
        if (found1) return true;
        if (text2) {
            const found2 = await getCurrentPage().getByText(text2).isVisible({timeout: timeoutMs}).catch(() => false);
            if (found2) return true;
        }
        return false;
    }

    const start = Date.now();
    while (Date.now() - start <= timeoutMs) {
        const found1 = await getCurrentPage().getByText(text1).isVisible({timeout: 4000}).catch(() => false);
        if (found1) return true;
        if (text2) {
            const found2 = await getCurrentPage().getByText(text2).isVisible({timeout: 4000}).catch(() => false);
            if (found2) return true;
        }
        // look for timeout message and reload flow
        const timeoutMsgVisible = await getCurrentPage().getByText('Request has timed out').isVisible({timeout: 200}).catch(() => false);
        if (timeoutMsgVisible) {
            const reload = getCurrentPage().getByRole('button', {name: /reload the page/i});
            if (await reload.isVisible().catch(() => false)) {
                await reload.click().catch(() => {
                });
            } else {
                await getCurrentPage().reload().catch(() => {
                });
            }
            // wait for timeout message to go away
            const gone = await getCurrentPage().getByText('Request has timed out').isHidden({timeout: 10000}).catch(() => true);
            if (!gone) throw new Error(`Request timeout message still present after ${timeoutMs} ms.`);
        }
    }
    return false;
}

/** Click link or button and wait for loading indicator to hide */
export async function clickLinkOrButtonAndWait(
    page: Page,
    selector: string,
    options: Parameters<Page['click']>[1] = {}
): Promise<void> {
    await getCurrentPage().click(selector, options);
    try {
        await getCurrentPage().waitForSelector('.senna-loading', {state: 'hidden', timeout: 20000});
    } catch (e) {
        console.warn('Timeout: Waiting for AJAX transition (click link/button)', e);
    }
}

/** Find and return a locator (ensuring it exists) */
export async function findAndWaitClick(page: Page, selector: string): Promise<import('@playwright/test').Locator> {
    const loc = getCurrentPage().locator(selector).first();
    await loc.waitFor();
    return loc;
}

/** Compute and cache net prefix */
let netPrefixCache: string | null = null;

export function netPrefix(): string | null {
    if (!netPrefixCache && globalVars.privateNet) {
        netPrefixCache = globalVars.privateNet.replace(/\.0+\/24$/, '.');
    }
    return netPrefixCache;
}

/** Get system name used in systems list */
export async function getSystemName(host: string): Promise<string> {
    switch (host) {
        case 'pxeboot_minion':
        case 'sle12sp5_terminal':
        case 'sle15sp4_terminal': {
            const server = await getTarget('server') as RemoteNode;
            const {stdout} = await server.run('salt-key');
            const words = stdout.split(/\s+/);
            const match = words.find((w) =>
                /example\.(Intel|pxeboot|sle12sp5terminal|sle15sp4terminal)/.test(w)
            );
            if (match) return match;
            // fallback guesses
            if (host === 'pxeboot_minion') return 'pxeboot.example.org';
            if (host === 'sle12sp5_terminal') return 'sle12sp5terminal.example.org';
            if (host === 'sle15sp4_terminal') return 'sle15sp4terminal.example.org';
            return host;
        }
        default: {
            try {
                const node = await getTarget(host) as RemoteNode;
                return node.fullHostname;
            } catch (e) {
                console.warn((e as Error).message);
                return host;
            }
        }
    }
}

/** Get MAC address for host */
export async function getMacAddress(host: string): Promise<string | null> {
    if (host === 'pxeboot_minion') {
        return process.env.PXEBOOT_MAC || null;
    }
    const node = await getTarget(host) as RemoteNode;
    const {stdout} = await node.run('ip link show dev eth1');
    const line = stdout.split('\n')[1] || '';
    const parts = line.trim().split(/\s+/);
    return parts[1] || null;
}

/** Update controller CA from server cert */
export async function updateControllerCA(): Promise<void> {
    const server = await getTarget('server') as RemoteNode;
    const controller = await getTarget('localhost') as RemoteNode;
    // Fetch server IP and name
    const serverIp = server.publicIp || (await server.run("hostname -I | awk '{print $1}'", {checkErrors: false})).stdout.trim();
    const serverName = server.fullHostname;
    const cmd = [
        'certutil -d sql:/root/.pki/nssdb -t TC -n "susemanager" -D',
        'rm -f /etc/pki/trust/anchors/*',
        `curl http://${serverIp}/pub/RHN-ORG-TRUSTED-SSL-CERT -o /etc/pki/trust/anchors/${serverName}.cert`,
        'update-ca-certificates',
        `certutil -d sql:/root/.pki/nssdb -A -t TC -n "susemanager" -i /etc/pki/trust/anchors/${serverName}.cert`
    ].join(' && ');
    await controller.run(cmd, {checkErrors: false});
}

/** Channel sync status helpers */
export async function channelIsSynced(channel: string): Promise<boolean> {
    const server = await getTarget('server') as RemoteNode;
    // Try dumpsolv on solv
    let res = await server.run(`dumpsolv /var/cache/rhn/repodata/${channel}/solv`, {checkErrors: false});
    if (res.returnCode === 0 && !res.stdout.includes('repo size: 0')) {
        const newRes = await server.run(`dumpsolv /var/cache/rhn/repodata/${channel}/solv.new`, {checkErrors: false});
        return newRes.returnCode !== 0;
    } else if (res.stdout.includes('repo size: 0')) {
        // Unknown EMPTY_CHANNELS list; conservatively return false
        const prim = await server.run(`zcat /var/cache/rhn/repodata/${channel}/*primary.xml.gz | grep 'packages=\"0\"'`, {checkErrors: false});
        return prim.returnCode === 0;
    } else {
        // Debian-like: presence of Release and Packages
        const deb = await server.run(`test -s /var/cache/rhn/repodata/${channel}/Release && test -e /var/cache/rhn/repodata/${channel}/Packages`, {checkErrors: false});
        return deb.returnCode === 0;
    }
}

export async function channelSyncCompleted(channelName: string): Promise<boolean> {
    const server = await getTarget('server') as RemoteNode;
    const tmp = '/tmp/reposync.log';
    await server.extract('/var/log/rhn/reposync.log', tmp).catch(() => false);
    // We can't read remote files here without fs on controller, but we can grep remotely
    const content = await server.run(`grep -n "Channel: " /var/log/rhn/reposync.log | cat`, {checkErrors: false});
    const lines = content.stdout.split('\n');
    let channelFound = false;
    for (const line of lines) {
        if (line.includes('Channel: ') && line.includes(channelName)) channelFound = true;
        else if (line.includes('Channel: ') && !line.includes(channelName)) channelFound = false;
        else if (line.includes('Sync of channel completed.') && channelFound) {
            const synced = await channelIsSynced(channelName);
            if (synced) return true;
            console.warn(`WARN: Repository metadata for ${channelName} seems not synchronized.`);
            return false;
        }
    }
    return false;
}

/** Get a time in the future HH:MM adding minutes */
export function getFutureTime(minutesToAdd: number): string {
    if (!Number.isInteger(minutesToAdd)) throw new TypeError('minutes_to_add should be an Integer');
    const now = new Date();
    const future = new Date(now.getTime() + minutesToAdd * 60 * 1000);
    const hh = String(future.getHours()).padStart(2, '0');
    const mm = String(future.getMinutes()).padStart(2, '0');
    return `${hh}:${mm}`;
}

/**
 * Determine if the proxy host is transactional (SLE/SL Micro, Leap Micro)
 */
export async function suseProxyTransactional(): Promise<boolean> {
    const envVar = ENV_VAR_BY_HOST['proxy'];
    if (!process.env[envVar]) return false;
    const node = await getTarget('proxy') as RemoteNode;
    // Prefer local OS family when available
    const localFamily = node.localOsFamily || '';
    const families = ['sle-micro', 'suse-microos', 'sl-micro', 'opensuse-leap-micro'];
    if (families.some((f) => localFamily.includes(f))) return true;
    // Fallback to generic check
    return isTransactionalSystem('proxy', false);
}

export async function suseProxyNonTransactional(): Promise<boolean> {
    const envVar = ENV_VAR_BY_HOST['proxy'];
    if (!process.env[envVar]) return false;
    return !(await suseProxyTransactional());
}

/**
 * Extract logs from a given node and download archive to ./logs
 */
export async function extractLogsFromNode(node: RemoteNode, host: string): Promise<void> {
    try {
        // Try to ensure tar exists depending on transactional system
        const osFamily = node.osFamily || '';
        const server = await getTarget('server') as RemoteNode;
        if (osFamily.startsWith('opensuse') && process.env.PROVIDER !== 'podman') {
            await node.run('zypper --non-interactive install -y tar', {checkErrors: false});
        }
        // Write useful logs
        await node.run('journalctl > /var/log/messages', {checkErrors: false});
        if ((globalThis as any).hostByNode && (globalThis as any).hostByNode.get(node) !== 'server') {
            await node.run('venv-salt-call --local grains.items | tee -a /var/log/salt_grains', {checkErrors: false});
        }
        // Create archive
        await node.run(`tar cfvJP /tmp/${node.fullHostname}-logs.tar.xz /var/log/ || [[ $? -eq 1 ]]`, {checkErrors: false});
        // Ensure local logs dir
        const local = await getTarget('localhost') as RemoteNode;
        await local.runLocal('mkdir -p logs', {checkErrors: false});
        const success = await (node as any).extract(`/tmp/${node.fullHostname}-logs.tar.xz`, `logs/${node.fullHostname}-logs.tar.xz`);
        expect(success, 'Download log archive failed').toBeTruthy();
    } catch (e) {
        console.warn((e as Error).message);
    }
}

/** Escapes regex special characters */
export function escapeRegex(text: string): string {
    return text.replace(/([$.*\[\]/^])/g, '\\$1');
}

/** Get system id by node */
export async function getSystemId(node: RemoteNode): Promise<number> {
    const api = getApiTest();
    if (!api?.system?.searchByName) throw new Error('API system namespace not available');
    const result = await api.system.searchByName(node.fullHostname);
    if (!result || !Array.isArray(result) || result.length === 0) {
        throw new Error(`No system found for hostname: ${node.fullHostname}`);
    }
    return result[0].id;
}

/** Wait until host goes down (ping fails) */
export async function checkShutdown(host: string, timeoutSec: number): Promise<void> {
    const ctl = await getTarget('localhost') as RemoteNode;
    await repeatUntilTimeout(async () => {
        const res = await ctl.runLocal(`ping -c1 ${host}`, {checkErrors: false});
        if (res.returnCode !== 0) {
            console.log(`machine: ${host} went down`);
            return true;
        }
        await new Promise((r) => setTimeout(r, 1000));
        return false;
    }, {timeout: timeoutSec * 1000, message: "machine didn't reboot"});
}

/** Wait for host ping and SSH to come back */
export async function checkRestart(host: string, node: RemoteNode, timeoutSec: number): Promise<void> {
    const ctl = await getTarget('localhost') as RemoteNode;
    await repeatUntilTimeout(async () => {
        const res = await ctl.runLocal(`ping -c1 ${host}`, {checkErrors: false});
        if (res.returnCode === 0) {
            console.log(`machine: ${host} network is up`);
            return true;
        }
        await new Promise((r) => setTimeout(r, 1000));
        return false;
    }, {timeout: timeoutSec * 1000, message: "machine didn't come up"});

    await repeatUntilTimeout(async () => {
        const res = await node.run('ls', {checkErrors: false, timeout: 10});
        if (res.returnCode === 0) {
            console.log(`machine: ${host} ssh is up`);
            return true;
        }
        await new Promise((r) => setTimeout(r, 1000));
        return false;
    }, {timeout: timeoutSec * 1000, message: "machine didn't come up"});
}

/** Get GPG keys list based on node family */
export async function getGpgKeys(node: RemoteNode, target: RemoteNode): Promise<string[]> {
    let osVersion = node.osVersion || '';
    const osFamily = node.osFamily || '';
    let cmd;
    if (/^sles/.test(osFamily)) {
        if (osVersion.startsWith('15')) {
            osVersion = '12';
        } else if (osVersion.startsWith('12')) {
            osVersion = osVersion.slice(0, 2);
        }
        cmd = `cd /srv/www/htdocs/pub/ && ls -1 sle${osVersion}*`;
    } else if (/^centos/.test(osFamily)) {
        cmd = `cd /srv/www/htdocs/pub/ && ls -1 ${osFamily}${osVersion}* res*`;
    } else {
        cmd = `cd /srv/www/htdocs/pub/ && ls -1 ${osFamily}*`;
    }
    const res = await target.run(cmd, {checkErrors: false});
    return res.stdout.split('\n').map((l) => l.trim()).filter(Boolean);
}

/** Feature-scope context getters/setters */
export function getContext<T = any>(key: string): T | undefined {
    const scope = getFeatureScope();
    if (!scope) return undefined;
    const ctx = getGlobalContext();
    return ctx[scope]?.[key];
}

export function addContext(key: string, value: any): void {
    const scope = getFeatureScope();
    if (!scope) return;
    if (!globalVars.context[scope]) globalVars.context[scope] = {};
    globalVars.context[scope][key] = value;
}

/** Read server secret and issue HS256 JWT */
export async function serverSecret(): Promise<string> {
    const server = await getTarget('server') as RemoteNode;
    const {stdout} = await server.run("sed -n 's/^server.secret_key\\s*=\\s*\\(\\h\\+\\)$/\\1/p' /etc/rhn/rhn.conf", {checkErrors: false});
    return stdout.trim();
}

function base64url(buf: Buffer): string {
    return buf.toString('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
}

export function token(secretHex: string, claims: Record<string, any> = {}): string {
    const header = {alg: 'HS256', typ: 'JWT'};
    const payload = {...claims};
    const encHeader = base64url(Buffer.from(JSON.stringify(header)));
    const encPayload = base64url(Buffer.from(JSON.stringify(payload)));
    const data = `${encHeader}.${encPayload}`;
    const key = Buffer.from(secretHex, 'hex');
    const sig = crypto.createHmac('sha256', key).update(data).digest();
    return `${data}.${base64url(sig)}`;
}

/** Salt pillar helpers */
export async function pillarGet(key: string, minion: string): Promise<string> {
    const server = await getTarget('server') as RemoteNode;
    const systemName = (async () => {
        try {
            let node = await getTarget(minion) as RemoteNode;
            return node.fullHostname;
        } catch {
            return minion;
        }
    })();
    const cmd = (minion === 'sle_minion') ? 'salt' : (['ssh_minion', 'rhlike_minion', 'deblike_minion'].includes(minion) ? 'mgr-salt-ssh' : null);
    if (!cmd) throw new Error('Invalid target');
    const {stdout} = await server.run(`${cmd} ${systemName} pillar.get ${key}`);
    return stdout;
}

export async function saltMasterPillarGet(key: string): Promise<string> {
    const server = await getTarget('server') as RemoteNode;
    const {stdout} = await server.run('salt-run --out=yaml salt.cmd pillar.items');
    const pillars: any = yaml.load(stdout) || {};
    return pillars?.[key] ?? '';
}

/** Wait for an action to complete */
export async function waitActionComplete(actionId: number, timeoutSec: number = 250): Promise<void> {
    const api = getApiTest();
    if (!api?.schedule?.listCompletedActions()) throw new Error('API schedule namespace not available');
    await repeatUntilTimeout(async () => {
        const list = await api.schedule.listCompletedActions();
        if (Array.isArray(list) && list.some((a: any) => a.id === actionId)) return true;
        await new Promise((r) => setTimeout(r, 2000));
        return false;
    }, {timeout: timeoutSec * 1000, message: 'Action was not found among completed actions'});
}

/** Filter channels by removing those matching any filter string */
export function filterChannels(channels: string[] | null | undefined, filters: string[] = []): string[] {
    if (!channels || channels.length === 0) {
        console.warn('Warning: No channels to filter');
        return [];
    }
    let filtered = [...channels];
    for (const f of filters) {
        filtered = filtered.filter((c) => !c.includes(f));
    }
    return filtered;
}

/** Get the highest event (latest) for a host */
export async function getLastEvent(host: string): Promise<any> {
    const node = await getTarget(host) as RemoteNode;
    const systemId = await getSystemId(node);
    const api = getApiTest();
    const events = await api.system.getEventHistory(systemId, 0, 1);
    return events?.[0];
}

/** Trigger upgrade via spacecmd */
export async function triggerUpgrade(hostname: string, packageName: string): Promise<void> {
    const server = await getTarget('server') as RemoteNode;
    await server.run(`spacecmd -u admin -p admin system_upgradepackage ${hostname} ${packageName} -y`, {checkErrors: true});
}

/**
 * Generates a list of valid uptime messages based on the given uptime information.
 * @param uptime The uptime information
 * @returns A list of valid uptime messages
 */
export function getValidUptimeMessages(uptime: UptimeInfo): string[] {
    const rounded_uptime_minutes = Math.round(uptime.minutes);
    const rounded_uptime_hours = Math.round(uptime.hours);
    const eleven_hours_in_seconds = 39600;
    const rounded_uptime_days = Math.round(
        (uptime.seconds + eleven_hours_in_seconds) / 86400.0
    );

    const valid_uptime_messages: string[] = [];
    const diffs = [-1, 0, 1];
    if (
        (uptime.days >= 1 && rounded_uptime_days < 2) ||
        (uptime.days < 1 && rounded_uptime_hours >= 22)
    ) {
        valid_uptime_messages.push('a day ago');
    } else if (rounded_uptime_hours > 1 && rounded_uptime_hours <= 21) {
        valid_uptime_messages.push(
            ...diffs.map((n) => `${rounded_uptime_hours + n} hours ago`)
        );
        valid_uptime_messages.forEach((time, index) => {
            if (time === '1 hours ago') {
                valid_uptime_messages[index] = 'an hour ago';
            }
        });
    } else if (rounded_uptime_minutes >= 45 && rounded_uptime_hours === 1) {
        valid_uptime_messages.push('an hour ago');
    } else if (rounded_uptime_minutes > 1 && rounded_uptime_hours <= 1) {
        valid_uptime_messages.push(
            ...diffs.map((n) => `${rounded_uptime_minutes + n} minutes ago`)
        );
        valid_uptime_messages.forEach((time, index) => {
            if (time === '1 minutes ago') {
                valid_uptime_messages[index] = 'a minute ago';
            }
        });
    } else if (uptime.seconds >= 45 && rounded_uptime_minutes === 1) {
        valid_uptime_messages.push('a minute ago');
    } else if (uptime.seconds < 45) {
        valid_uptime_messages.push('a few seconds ago');
    } else if (rounded_uptime_days < 25) {
        valid_uptime_messages.push(
            ...diffs.map((n) => `${rounded_uptime_days + n} days ago`)
        );
        valid_uptime_messages.forEach((time, index) => {
            if (time === '1 days ago') {
                valid_uptime_messages[index] = 'a day ago';
            }
        });
    } else {
        valid_uptime_messages.push('a month ago');
    }
    return valid_uptime_messages;
}
