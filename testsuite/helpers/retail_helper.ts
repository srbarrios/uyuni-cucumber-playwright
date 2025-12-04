// Copyright (c) 2025 SUSE LLC.
// Licensed under the terms of the MIT license.

import {expect} from '@playwright/test';
import {
    envConfig,
    getApiTest,
    getCurrentPage,
    getProductVersionFull,
    getTarget,
    globalVars,
    isBuildValidation
} from '../helpers/index.js';
import * as yaml from 'js-yaml';
import * as fs from 'fs';
import * as path from 'path';
import {dirname} from 'path';
import {fileURLToPath} from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * Reads the terminals from the massive-import-terminals.yml file.
 * @returns An array of terminal names.
 */
export function readTerminalsFromYaml(): string[] {
    const filePath = path.join(__dirname, '../../upload_files/massive-import-terminals.yml');
    const fileContents = fs.readFileSync(filePath, 'utf8');
    const tree: any = yaml.load(fileContents);
    return Object.keys(tree['branches'][Object.keys(tree['branches'])[0]]['terminals']);
}

/**
 * Reads the branch prefix from the massive-import-terminals.yml file.
 * @returns The branch prefix.
 */
export function readBranchPrefixFromYaml(): string {
    const filePath = path.join(__dirname, '../../upload_files/massive-import-terminals.yml');
    const fileContents = fs.readFileSync(filePath, 'utf8');
    const tree: any = yaml.load(fileContents);
    return tree['branches'][Object.keys(tree['branches'])[0]]['branch_prefix'];
}

/**
 * Manages branch server repositories by enabling or disabling them.
 * @param action 'enable' or 'disable'
 * @param when 'before' or 'after'
 */
export async function manageBranchServerRepositories(action: 'enable' | 'disable', when: 'before' | 'after'): Promise<void> {
    const proxy = await getTarget('proxy');
    const osVersion = proxy.osVersion;
    const osFamily = proxy.osFamily;

    let repos = 'os_pool_repo os_update_repo ';
    const fullProductVersion = await getProductVersionFull(proxy) || '';
    if (!isBuildValidation() && !envConfig.isContainerizedServer && !fullProductVersion.includes('-released')) {
        repos += 'testing_overlay_devel_repo ';
    }

    if (osFamily?.startsWith('sles') && osVersion?.startsWith('15')) {
        repos += 'proxy_module_pool_repo proxy_module_update_repo ' +
            'proxy_product_pool_repo proxy_product_update_repo ' +
            'module_server_applications_pool_repo module_server_applications_update_repo ';
        const fullProductVersion = await getProductVersionFull(proxy) || '';
        if (!isBuildValidation() && !fullProductVersion.includes('-released')) {
            repos += 'proxy_devel_releasenotes_repo proxy_devel_repo ';
        }
    } else if (osFamily?.startsWith('opensuse')) {
        if (!envConfig.isContainerizedServer) {
            repos += 'proxy_pool_repo ';
        }
    }
    await proxy.run(`zypper mr --${action} ${repos}`, {verbose: true});
}

/**
 * Determines the OS image for PXE boot and terminal tests.
 * @param host The host name.
 * @returns The OS image name.
 */
export function computeImage(host: string): string {
    // TODO: now that the terminals derive from sumaform's pxe_boot module,
    //       we could also specify the desired image as an environment variable
    switch (host) {
        case 'pxeboot_minion':
            return globalVars.pxebootImage || '';
        case 'sle12sp5_terminal':
            return 'sles12sp5o';
        case 'sle15sp4_terminal':
            return 'sles15sp4o';
        case 'sle15sp7_terminal':
            return 'sles15sp7o';
        default:
            throw new Error(`Is ${host} a supported terminal?`);
    }
}

/**
 * Determines the Kiwi profile filename for PXE boot and terminal tests.
 * @param host The host name.
 * @returns The Kiwi profile filename.
 */
export function computeKiwiProfileFilename(host: string): string {
    const image = computeImage(host);
    switch (image) {
        case 'sles15sp7o':
        case 'sles15sp4o':
            return globalVars.product === 'Uyuni' ? 'Kiwi/POS_Image-JeOS7_uyuni' : 'Kiwi/POS_Image-JeOS7_head';
        case 'sles12sp5o':
            return 'Kiwi/POS_Image-JeOS6_head';
        default:
            throw new Error(`Is ${image} a supported image version?`);
    }
}

/**
 * Determines the Kiwi profile name for PXE boot and terminal tests.
 * @param host The host name.
 * @returns The Kiwi profile name.
 */
export function computeKiwiProfileName(host: string): string {
    const image = computeImage(host);
    switch (image) {
        case 'sles15sp7o':
        case 'sles15sp4o':
            return globalVars.product === 'Uyuni' ? 'POS_Image_JeOS7_uyuni' : 'POS_Image_JeOS7_head';
        case 'sles12sp5o':
            return 'POS_Image_JeOS6_head';
        default:
            throw new Error(`Is ${image} a supported image version?`);
    }
}

/**
 * Determines the Kiwi profile version for PXE boot and terminal tests.
 * @param host The host name.
 * @returns The Kiwi profile version.
 */
export function computeKiwiProfileVersion(host: string): string {
    const image = computeImage(host);
    switch (image) {
        case 'sles15sp7o':
        case 'sles15sp4o':
            return '7.0.0';
        case 'sles12sp5o':
            return '6.0.0';
        default:
            throw new Error(`Is ${image} a supported image version?`);
    }
}

/**
 * Opens the details page of a Kiwi image.
 * @param host The host name.
 */
export async function openImageDetailsPage(host: string): Promise<void> {
    const name = computeKiwiProfileName(host);
    const tr = getCurrentPage().locator('tr', {hasText: name});
    await tr.locator('button[aria-label="Details"]').click();
}

/**
 * Asserts that a Kiwi image is built.
 * @param host The host name.
 */
export async function shouldSeeImageIsBuilt(host: string): Promise<void> {
    const name = computeKiwiProfileName(host);
    const tr = getCurrentPage().locator('tr', {hasText: name});
    await expect(tr.locator('i[title="Built"]')).toBeVisible();
}

/**
 * Asserts that a link to download a Kiwi image is visible and the image is available.
 * @param host The host name.
 */
export async function shouldSeeLinkToDownloadImage(host: string): Promise<void> {
    const name = computeKiwiProfileName(host);
    const link = getCurrentPage().locator(`a[href*='${name}'][href$='.xz']`);
    await expect(link).toBeVisible();

    const imgUrl = await link.getAttribute('href');
    if (!imgUrl) {
        throw new Error(`Download link for image ${name} not found.`);
    }

    // We use the HEAD method to verify the image is available, as it can be quite big for a GET
    const url = new URL(imgUrl);
    const response = await fetch(url.toString(), {method: 'HEAD'});

    if (!response.ok) {
        throw new Error(`Failed HEAD request for image ${name}: ${response.statusText}`);
    }
}

/**
 * Retrieves the build host ID, needed for scheduleImageBuild call.
 * @returns The build host ID.
 */
export async function retrieveBuildHostId(): Promise<number> {
    const api = getApiTest();
    const systems = await api.system.listSystems();
    expect(systems).not.toBeNull();
    const buildHost = await getTarget('build_host');
    const buildHostId = systems
        .filter((s: any) => s['name'] === buildHost.fullHostname)
        .map((s: any) => s['id'])[0];
    expect(buildHostId, `Build host ${buildHost.fullHostname} is not yet registered?`).not.toBeNull();
    return buildHostId;
}
