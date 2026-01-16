import { After, AfterAll, AfterStep, Before, BeforeAll, setDefaultTimeout, Status } from '@cucumber/cucumber';
import * as fs from 'fs';
import * as path from 'path';
import {
    addContext,
    closeBrowser,
    getContext,
    getCurrentPage,
    getSccCredentials, globalVars,
    initializeBrowser,
    logScenarioTiming,
    setFeatureScope,
    TIMEOUTS
} from '../helpers/index.js';
import {suseProxyNonTransactional, suseProxyTransactional} from '../helpers/core/commonlib.js';
import {ENV_VAR_BY_HOST} from '../helpers/core/constants.js';
import {envConfig} from '../helpers/core/env.js';
import {getTarget} from '../helpers/system/remote_nodes_env.js';
import {authorizeUser, createUser} from "../helpers/embedded_steps/navigation_helper.js";

setDefaultTimeout(TIMEOUTS.scenario);

BeforeAll(async function () {
    await initializeBrowser();
});

AfterAll(async function () {
    if (envConfig.codeCoverageMode) {
        await processCodeCoverage();
    }
    await closeBrowser();
});

// Dynamic Host Tags
const hostTags = [
    'proxy', 'sle_minion', 'rhlike_minion', 'deblike_minion', 'ssh_minion', 'build_host',
    'alma8_minion', 'alma9_minion', 'centos7_minion', 'oracle9_minion', 'rhel9_minion',
    'rocky8_minion', 'rocky9_minion', 'ubuntu2004_minion', 'ubuntu2204_minion',
    'ubuntu2404_minion', 'debian12_minion', 'sle12sp5_minion', 'sle15sp4_minion',
    'sle15sp7_minion', 'slemicro55_minion', 'slmicro61_minion'
    /* Add others as needed */
];

hostTags.forEach(tag => {
    Before({ tags: `@${tag}` }, async () => !(ENV_VAR_BY_HOST[tag] in process.env) && 'skipped');
});

// Product specific hooks
Before('@susemanager', async () => globalVars.product !== 'SUSE Multi-Linux Manager' && 'skipped');
Before('@uyuni', async () => globalVars.product !== 'Uyuni' && 'skipped');
Before('@scc_credentials', async () => !getSccCredentials() && 'skipped');
Before('@private_net', async () => !getContext('privateNet') && 'skipped');
Before('@no_mirror', async () => getContext('mirror') && 'skipped');
Before('@skip', async () => 'skipped');

// Conditional Infrastructure Hooks
Before('@run_if_proxy_transactional_or_slmicro61_minion', async () =>
    !(await suseProxyTransactional() || ENV_VAR_BY_HOST['slmicro61_minion'] in process.env) && 'skipped');

Before('@pxeboot_minion', async () => !getContext('pxebootMac') && 'skipped');
Before('@skip_if_cloud', async () => envConfig.isCloudProvider && 'skipped');
Before('@skip_if_containerized_server', async () => envConfig.isContainerizedServer && 'skipped');

// Scenario life-cycle Hooks
Before(async function (scenario) {
    const featureScope = scenario.pickle.uri.split(/(\.feature|\/)/).slice(-3, -2)[0];
    setFeatureScope(featureScope);
    addContext('scenarioStartTime', Date.now());
    console.log(`Scenario started: ${new Date().toLocaleString()}`);
});

After(async function (scenario) {
    logScenarioTiming(Number(getContext('scenarioStartTime')));
    if (scenario.result?.status === Status.FAILED) {
        if (!getContext('browserDisconnected')) await handleFailure(this, scenario);
        await printServerLogs();
    }
});

// Core Logic Helpers
async function handleFailure(world: any, scenario: any) {
    const screenshotPath = path.join('screenshots', `${scenario.pickle.name.replace(/\W/g, '_')}_${Date.now()}.png`);
    if (!fs.existsSync('screenshots')) fs.mkdirSync('screenshots');

    try {
        const page = getCurrentPage();
        if (await page.locator('text=Bootstrap Minions').isVisible({timeout: 0})) {
            await page.locator('button', {hasText: 'Details'}).click().catch(() => {});
        }
        await page.screenshot({ path: screenshotPath });
        world.attach(fs.readFileSync(screenshotPath), 'image/png');
        fs.unlinkSync(screenshotPath);
    } catch (e: any) {
        console.warn(`Failure handling failed: ${e.message}`);
    } finally {
        const user = getContext('currentUser');
        if (user) {
            await authorizeUser(user, <string>getContext('currentPassword'));
            await getCurrentPage().goto(getCurrentPage().url(), {timeout: TIMEOUTS.long * 1000});
        }
    }
}

async function printServerLogs() {
    const server = await getTarget('server');
    const logs = ['/var/log/rhn/rhn_web_ui.log', '/var/log/rhn/rhn_web_api.log'];
    for (const log of logs) {
        console.log(`=> ${log}`);
        const { stdout } = await server.run(`tail -n10 ${log} | awk -v limit="$(date --date="2 minutes ago" "+%Y-%m-%d %H:%M:%S")" 'substr($0, ${log.includes('api') ? 2 : 1}, 19) > limit'`, {checkErrors: false});
        console.log(stdout);
    }
}

async function processCodeCoverage() {
    const scope = getContext('featureScope');
    const cov = getContext('codeCoverage');
    if (scope && cov) {
        await cov.jacocoDump(scope);
        await cov.pushFeatureCoverage(scope);
    }
}
