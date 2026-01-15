// Copyright (c) 2025 SUSE LLC
// Licensed under the terms of the MIT license.

import {fileURLToPath} from 'url';
import * as path from 'path';
import {dirname} from 'path';
import * as dotenv from 'dotenv';
import * as fs from 'fs';
import {Browser, BrowserContext, chromium, defineConfig, Page} from '@playwright/test';
import {getGlobalContext, setGlobalContext} from './commonlib.js';
import {QualityIntelligence} from "../monitoring/quality_intelligence.js";
import {ApiTest} from "../api/api_test.js";
import CobblerTest from "../configuration/cobbler_test.js";
import Cobbler_test from "../configuration/cobbler_test.js";
import {CodeCoverage} from "../monitoring/code_coverage.js";

export default defineConfig({
    use: {
        actionTimeout: 5000
    },
});

const __dirname = dirname(fileURLToPath(import.meta.url));

// Load environment variables
dotenv.config();

// Environment configuration
export interface EnvironmentConfig {
    debug: boolean;
    codeCoverageMode: boolean;
    qualityIntelligenceMode: boolean;
    isCloudProvider: boolean;
    isGhValidation: boolean;
    isContainerizedServer: boolean;
    isTransactionalServer: boolean;
    isUsingBuildImage: boolean;
    isUsingSccRepositories: boolean;
    catchTimeoutMessage: boolean;
    betaEnabled: boolean;
}

export interface TestTimeout {
    ssh: number;
    web: number;
    long: number;
}

export interface GlobalVariables {
    moments: Map<string, Date>;
    pxebootMac: string | null;
    pxebootImage: string;
    sle12sp5TerminalMac: string | null;
    sle15sp4TerminalMac: string | null;
    privateNet: string | null;
    mirror: string | null;
    serverHttpProxy: string | null;
    customDownloadEndpoint: string | null;
    buildSources: string | null;
    noAuthRegistry: string | null;
    authRegistry: string | null;
    currentUser: string;
    currentPassword: string;
    chromiumDevTools: boolean;
    chromiumDevPort: number;
    useSaltBundle: boolean;
    qualityIntelligence: QualityIntelligence | null;
    codeCoverage: CodeCoverage | null;
    product: string | undefined;
    apiTest: ApiTest;
    cobblerTest: CobblerTest;
    context: Record<string, any>;
    browserDisconnected: boolean;
}

// Initialize environment configuration
export const ENV_CONFIG: EnvironmentConfig = {
    debug: process.env.DEBUG === 'true',
    codeCoverageMode: process.env.REDIS_HOST !== undefined && process.env.CODE_COVERAGE === 'true',
    qualityIntelligenceMode: process.env.QUALITY_INTELLIGENCE === 'true',
    isCloudProvider: process.env.PROVIDER?.includes('aws') || false,
    isGhValidation: process.env.PROVIDER?.includes('podman') || false,
    isContainerizedServer: ['k3s', 'podman'].includes(process.env.CONTAINER_RUNTIME || ''),
    isTransactionalServer: false, // Will be set dynamically
    isUsingBuildImage: process.env.IS_USING_BUILD_IMAGE === 'true',
    isUsingSccRepositories: process.env.IS_USING_SCC_REPOSITORIES !== 'False',
    catchTimeoutMessage: process.env.CATCH_TIMEOUT_MESSAGE === 'True',
    betaEnabled: process.env.BETA_ENABLED === 'True'
};

export const TIMEOUTS: TestTimeout = {
    ssh: parseInt(process.env.SSH_TIMEOUT || '30', 10),
    web: parseInt(process.env.WEB_TIMEOUT || '20', 10),
    long: parseInt(process.env.DEFAULT_TIMEOUT || '250', 10)
};

export const GLOBAL_VARS: GlobalVariables = {
    moments: undefined as unknown as Map<string, Date>,
    pxebootMac: process.env.PXEBOOT_MAC || null,
    pxebootImage: process.env.PXEBOOT_IMAGE || 'sles15sp3o',
    sle12sp5TerminalMac: process.env.SLE12SP5_TERMINAL_MAC || null,
    sle15sp4TerminalMac: process.env.SLE15SP4_TERMINAL_MAC || null,
    privateNet: process.env.PRIVATENET || null,
    mirror: process.env.MIRROR || null,
    serverHttpProxy: process.env.SERVER_HTTP_PROXY || null,
    customDownloadEndpoint: process.env.CUSTOM_DOWNLOAD_ENDPOINT || null,
    buildSources: process.env.BUILD_SOURCES || null,
    noAuthRegistry: process.env.NO_AUTH_REGISTRY || null,
    authRegistry: process.env.AUTH_REGISTRY || null,
    currentUser: 'admin',
    currentPassword: 'admin',
    chromiumDevTools: process.env.REMOTE_DEBUG === 'true',
    chromiumDevPort: 9222 + parseInt(process.env.TEST_ENV_NUMBER || '0', 10),
    useSaltBundle: process.env.USE_SALT_BUNDLE !== 'false',
    qualityIntelligence: undefined as unknown as QualityIntelligence,
    codeCoverage: undefined as unknown as CodeCoverage,
    product: process.env.PRODUCT || undefined,
    apiTest: undefined as unknown as ApiTest,
    cobblerTest: undefined as unknown as Cobbler_test,
    context: {},
    browserDisconnected: false
};

// Global variables
let globalBrowser: Browser;
let browserContext: BrowserContext;
let globalPage: Page;
let featureScope: string | undefined;
let customRepositories: any | undefined;
let buildValidation: boolean = false;

// Log environment configuration and global variables
console.log('Environment Configuration:\n' , ENV_CONFIG);
console.log('Global Variables:\n' , GLOBAL_VARS);

// Initialize Handlers
if (ENV_CONFIG.codeCoverageMode) {
    GLOBAL_VARS.codeCoverage = new CodeCoverage();
}
if (ENV_CONFIG.qualityIntelligenceMode) {
    GLOBAL_VARS.qualityIntelligence = new QualityIntelligence();
}

// Load custom repositories if available
const customReposPath = path.join(__dirname, '../upload_files/custom_repositories.json');
if (fs.existsSync(customReposPath)) {
    try {
        const customReposFile = fs.readFileSync(customReposPath, 'utf8');
        customRepositories = JSON.parse(customReposFile);
        buildValidation = true;
        console.log('Custom repositories loaded successfully.');
    } catch (error) {
        console.warn('Failed to load custom repositories:', error);
    }
}

/**
 * Browser configuration for Playwright
 */
export function getBrowserConfig() {
    const args = [
        '--disable-dev-shm-usage',
        '--ignore-certificate-errors',
        '--window-size=2048,2048',
        '--no-sandbox',
        '--disable-notifications'
    ];

    if (!ENV_CONFIG.debug) {
        args.push('--headless=new');
    }

    if (GLOBAL_VARS.chromiumDevTools) {
        args.push(`--remote-debugging-port=${GLOBAL_VARS.chromiumDevPort}`);
    }

    if (ENV_CONFIG.isCloudProvider) {
        args.push('--user-data-dir=/root');
    }

    return {
        headless: !ENV_CONFIG.debug,
        args,
        viewport: {width: 2048, height: 2048},
        ignoreHTTPSErrors: true,
        timeout: 240000
    };
}

/**
 * Initialize browser and context
 */
export async function initializeBrowser(): Promise<{ browser: Browser; context: BrowserContext; page: Page }> {
    if (!globalBrowser) {
        const config = getBrowserConfig();
        globalBrowser = await chromium.launch(config);
        globalBrowser.on('disconnected', () => {
            console.error('Browser process unexpectedly disconnected/crashed!');
            GLOBAL_VARS.browserDisconnected = true;
        });
        browserContext = await globalBrowser.newContext({
            ignoreHTTPSErrors: config.ignoreHTTPSErrors,
            viewport: config.viewport,
            permissions: ['storage-access']
        });

        // Set download behavior
        await browserContext.setExtraHTTPHeaders({
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8'
        });

        globalPage = await browserContext.newPage();
        globalPage.setDefaultTimeout(3 * 1000);
    }

    return {
        browser: globalBrowser,
        context: browserContext!,
        page: globalPage!
    };
}

/**
 * Get the current browser, context, and page
 */
export function getBrowserInstances(): { browser: Browser; context: BrowserContext; page: Page } {
    return {
        browser: globalBrowser,
        context: browserContext,
        page: globalPage
    };
}

/**
 * Get the current page
 */
export function getCurrentPage(): Page {
    return globalPage;
}

/**
 * Close browser and clean up
 */
export async function closeBrowser(): Promise<void> {
    if (globalPage) {
        await globalPage.close();
    }
    if (browserContext) {
        await browserContext.close();
    }
    if (globalBrowser) {
        await globalBrowser.close();
    }
}

/**
 * Take a screenshot with error handling
 */
export async function takeScreenshot(page: Page, scenarioName: string): Promise<string | null> {
    try {
        if (!fs.existsSync('screenshots')) {
            fs.mkdirSync('screenshots', {recursive: true});
        }

        const sanitizedName = scenarioName.replace(/[^a-zA-Z0-9]/g, '_');
        const screenshotPath = `screenshots/${sanitizedName}.png`;

        await getCurrentPage().screenshot({
            path: screenshotPath,
            fullPage: true,
            type: 'png'
        });

        return screenshotPath;
    } catch (error) {
        console.warn(`Failed to take screenshot: ${error}`);
        return null;
    }
}

/**
 * Log scenario timing information
 */
export function logScenarioTiming(startTime: number): void {
    const currentTime = Date.now();
    const duration = Math.round((currentTime - startTime) / 1000);
    console.log(`This scenario took: ${duration} seconds`);
}

/**
 * Skip scenario utility
 */
export function skipScenario(reason: string): never {
    throw new Error(`SKIP: ${reason}`);
}

/**
 * Environment variable checkers for feature tags
 */
export function checkEnvironmentVariable(varName: string): boolean {
    return process.env[varName] !== undefined;
}

/**
 * Get app host URL
 */
export function getAppHost(): string {
    const server = process.env.SERVER;
    if (!server) {
        throw new Error('SERVER environment variable is required');
    }
    return `https://${server}`;
}

/**
 * Set feature scope
 */
export function setFeatureScope(scope: string): void {
    featureScope = scope;
    setGlobalContext('feature_scope', scope);
}

/**
 * Get feature scope
 */
export function getFeatureScope(): string | undefined {
    return featureScope || getGlobalContext()['feature_scope'];
}

/**
 * Get custom repositories
 */
export function getCustomRepositories(): any {
    return customRepositories;
}

/**
 * Check if this is a build validation run
 */
export function isBuildValidation(): boolean {
    return buildValidation;
}

// Export constants for external use
export const START_TIME = Date.now();

export {
    ENV_CONFIG as envConfig,
    TIMEOUTS as timeouts,
    GLOBAL_VARS as globalVars
};
