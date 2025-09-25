import {After, AfterAll, AfterStep, Before, BeforeAll, setDefaultTimeout, Status} from '@cucumber/cucumber';
import * as fs from 'fs';
import * as path from 'path';
import {
    addContext,
    closeBrowser,
    getContext,
    getCurrentPage,
    getSccCredentials,
    initializeBrowser,
    logScenarioTiming,
    setFeatureScope,
    TIMEOUTS
} from '../helpers/index.js';
import {getProduct, suseProxyNonTransactional, suseProxyTransactional} from '../helpers/core/commonlib.js';
import {ENV_VAR_BY_HOST} from '../helpers/core/constants.js';
import {envConfig, globalVars} from '../helpers/core/env.js';
import {getTarget} from '../helpers/system/remote_nodes_env.js';
import {authorizeUser, createUser} from "../helpers/embedded_steps/navigation_helper.js";

class SkipScenarioError extends Error {
    constructor(message?: string) {
        super(message);
        this.name = 'SkipScenarioError';
    }
}

function skipThisScenario(): void {
    throw new SkipScenarioError('Scenario skipped intentionally.');
}

setDefaultTimeout(TIMEOUTS.web * 1000);

BeforeAll(async function () {
    await initializeBrowser();
});

AfterAll(async function () {
    if (envConfig.codeCoverageMode) {
        await processCodeCoverage();
    }
    await closeBrowser();
});

async function c(): Promise<boolean> {
    //TODO: To be implemented
    return true;
}

async function clickDetailsIfPresent(): Promise<void> {
    const hasBootstrapMinions = await getCurrentPage().locator('text=Bootstrap Minions').isVisible({timeout: 0});
    let hasDetails = false;
    if (hasBootstrapMinions) {
        hasDetails = await getCurrentPage().locator('text=Details').isVisible({timeout: 0});
    }
    if (hasBootstrapMinions && hasDetails) {
        try {
            await getCurrentPage().locator('button', {hasText: 'Details'}).click();
        } catch (error: any) {
            if (error.name === 'TimeoutError') {
                console.log("Button 'Details' not found or not interactable on the page.");
            } else {
                console.log(`An unexpected error occurred: ${error.message}`);
            }
        }
    }
}

async function relogAndVisitPreviousUrl(): Promise<void> {
    try {
        const previousUrl = getCurrentPage().url();
        await authorizeUser(globalVars.currentUser, globalVars.currentPassword);
        await getCurrentPage().goto(previousUrl, {timeout: TIMEOUTS.long * 1000});
    } catch (error: any) {
        if (error.name === 'TimeoutError') {
            console.warn(`Timed out while attempting to relog and visit the previous URL: ${getCurrentPage().url()}`);
        } else {
            console.warn(`An error occurred while relogging and visiting the previous URL: ${error.message}`);
        }
    }
}

async function handleScreenshotAndRelog(world: any, scenario: any, currentEpoch: number): Promise<void> {
    const screenshotsDir = 'screenshots';

    if (!fs.existsSync(screenshotsDir)) {
        fs.mkdirSync(screenshotsDir);
    }
    // Ensure the scenario name is safe for a filename
    const scenarioName = scenario.pickle.name.replace(/[^a-z0-9]/gi, '_');
    const screenshotPath = path.join(screenshotsDir, `${scenarioName}_${currentEpoch}.png`); // Add epoch for uniqueness if running in parallel

    try {
        await clickDetailsIfPresent();
        await getCurrentPage().screenshot({path: screenshotPath});
        const screenshotBuffer = fs.readFileSync(screenshotPath);
        world.attach(screenshotBuffer, 'image/png');
        fs.unlinkSync(screenshotPath);
        const startTime = Number(getContext('scenarioStartTime'));
        const endTime = currentEpoch * 1000;
        const metadata = `${new Date(startTime).toLocaleTimeString()} - ${new Date(endTime).toLocaleTimeString()} | Current URL: ${getCurrentPage().url()}`;
        world.attach(metadata, 'text/plain');

    } catch (e: any) {
        console.warn(`Error during screenshot/attachment/cleanup: ${e.message}`);
    } finally {
        await relogAndVisitPreviousUrl();
    }
}

async function printServerLogs(): Promise<void> {
    console.log('=> /var/log/rhn/rhn_web_ui.log');
    let {stdout: stdout1} = await (await getTarget('server')).run('tail -n20 /var/log/rhn/rhn_web_ui.log | awk -v limit="$(date --date="5 minutes ago" "+%Y-%m-%d %H:%M:%S")" \'substr($0, 1, 19) > limit\'', {checkErrors: false});
    stdout1.split('\n').forEach(line => console.log(line));

    console.log('=> /var/log/rhn/rhn_web_api.log');
    let {stdout: stdout2} = await (await getTarget('server')).run('tail -n20 /var/log/rhn/rhn_web_api.log | awk -v limit="$(date --date="5 minutes ago" "+%Y-%m-%d %H:%M:%S")" \'substr($0, 2, 19) > limit\'', {checkErrors: false});
    stdout2.split('\n').forEach(line => console.log(line));
}

async function processCodeCoverage(): Promise<void> {
    const featureFilename = getContext('featureScope');
    if (featureFilename && globalVars.codeCoverage) {
        await globalVars.codeCoverage.jacocoDump(featureFilename);
        await globalVars.codeCoverage.pushFeatureCoverage(featureFilename);
    }
}

async function sccAccessLoggingGrain(): Promise<boolean> {
    const cmd = 'grep "\\"scc_access_logging\\": true" /etc/salt/grains';
    const {returnCode: code} = await (await getTarget('server')).run(cmd, {checkErrors: false});
    return code === 0;
}

// Helper to skip scenario if condition is false
function skipThisScenarioUnless(condition: any): void {
    if (!condition) {
        skipThisScenario();
    }
}

// Define the current feature scope
Before(async function (scenario) {
    const featureScope = scenario.pickle.uri.split(/(\.feature|\/)/)[scenario.pickle.uri.split(/(\.feature|\/)/).length - 3];
    setFeatureScope(featureScope);
});

// Embed a screenshot after each failed scenario
After(async function (scenario) {
    const currentEpoch = Date.now();
    logScenarioTiming(currentEpoch);
    if (scenario.result?.status === Status.FAILED) {
        try {
            if (!globalVars.browserDisconnected) {
                await handleScreenshotAndRelog(this, scenario, currentEpoch);
            } else {
                console.warn('There is no active web session; unable to take a screenshot or relog.');
            }
        } finally {
            await printServerLogs();
        }
    }
});

// Dump feature code coverage into a Redis DB before we run next feature
Before(async function (scenario) {
    if (!envConfig.codeCoverageMode) {
        return;
    }

    // Initialize this.featurePath if that's the first feature
    addContext('featureScope', scenario.pickle.uri);

    // Skip if still in the same feature file
    if (getContext('featureScope') === scenario.pickle.uri) {
        return;
    }

    // Runs only if a new feature file starts
    await processCodeCoverage();
    addContext('featureScope', scenario.pickle.uri);
});

// get the Cobbler log output when it fails
After('@scope_cobbler', async function (scenario) {
    if (scenario.result?.status === Status.FAILED) {
        console.log('=> /var/log/cobbler/cobbler.log');
        const result = await (await getTarget('server')).run('tail -n20 /var/log/cobbler/cobbler.log');
        const out = result.stdout;
        out.split('\n').forEach((line: any) => console.log(line));
        console.log('');
    }
});

AfterStep(async function () {
    const sennaLoadingVisible = await getCurrentPage().locator('.senna-loading').isVisible({timeout: 0});
    const sennaLoadingHidden = await getCurrentPage().locator('.senna-loading').isHidden({timeout: TIMEOUTS.long * 1000});

    if (sennaLoadingVisible && !sennaLoadingHidden) {
        console.log('Timeout: Waiting AJAX transition');
    }
});

Before(async function () {
    addContext('scenarioStartTime', Date.now());
    const retrievedTime = Number(await getContext('scenarioStartTime'));
    console.log(`This scenario ran at: ${new Date(retrievedTime).toLocaleString()}\n`);
});

Before('@skip', async function () {
    skipThisScenario();
});

Before('@skip_known_issue', async function () {
    throw new Error('This scenario is known to fail, skipping it');
});

// Create a user for each feature
Before(async function (scenario) {
    const featurePath = scenario.pickle.uri;
    const featureFilename = scenario.pickle.uri.split(/(\.feature|\/)/)[scenario.pickle.uri.split(/(\.feature|\/)/).length - 3];
    if (getContext('user_created') === true) {
        return;
    }

    if (!featurePath.match(/core|reposync|finishing|build_validation/)) {
        await createUser(featureFilename, 'linux');
        addContext('user_created', true);
    }
});

// do some tests only if the corresponding node exists
Before('@proxy', async function () {
    skipThisScenarioUnless(process.env[ENV_VAR_BY_HOST['proxy']]);
});

Before('@run_if_proxy_transactional_or_slmicro61_minion', async function () {
    skipThisScenarioUnless(await suseProxyTransactional() || process.env[ENV_VAR_BY_HOST['slmicro61_minion']]);
});

Before('@run_if_proxy_not_transactional_or_sles15sp7_minion', async function () {
    skipThisScenarioUnless(await suseProxyNonTransactional() || process.env[ENV_VAR_BY_HOST['sle15sp7_minion']]);
});

Before('@sle_minion', async function () {
    skipThisScenarioUnless(process.env[ENV_VAR_BY_HOST['sle_minion']]);
});

Before('@rhlike_minion', async function () {
    skipThisScenarioUnless(process.env[ENV_VAR_BY_HOST['rhlike_minion']]);
});

Before('@deblike_minion', async function () {
    skipThisScenarioUnless(process.env[ENV_VAR_BY_HOST['deblike_minion']]);
});

Before('@pxeboot_minion', async function () {
    skipThisScenarioUnless(globalVars.pxebootMac);
});

Before('@ssh_minion', async function () {
    skipThisScenarioUnless(process.env[ENV_VAR_BY_HOST['ssh_minion']]);
});

Before('@build_host', async function () {
    skipThisScenarioUnless(process.env[ENV_VAR_BY_HOST['build_host']]);
});

Before('@alma8_minion', async function () {
    skipThisScenarioUnless(process.env[ENV_VAR_BY_HOST['alma8_minion']]);
});

Before('@alma8_ssh_minion', async function () {
    skipThisScenarioUnless(process.env[ENV_VAR_BY_HOST['alma8_ssh_minion']]);
});

Before('@alma9_minion', async function () {
    skipThisScenarioUnless(process.env[ENV_VAR_BY_HOST['alma9_minion']]);
});

Before('@alma9_ssh_minion', async function () {
    skipThisScenarioUnless(process.env[ENV_VAR_BY_HOST['alma9_ssh_minion']]);
});

Before('@amazon2023_minion', async function () {
    skipThisScenarioUnless(process.env[ENV_VAR_BY_HOST['amazon2023_minion']]);
});

Before('@amazon2023_ssh_minion', async function () {
    skipThisScenarioUnless(process.env[ENV_VAR_BY_HOST['amazon2023_ssh_minion']]);
});

Before('@centos7_minion', async function () {
    skipThisScenarioUnless(process.env[ENV_VAR_BY_HOST['centos7_minion']]);
});

Before('@centos7_ssh_minion', async function () {
    skipThisScenarioUnless(process.env[ENV_VAR_BY_HOST['centos7_ssh_minion']]);
});

Before('@liberty9_minion', async function () {
    skipThisScenarioUnless(process.env[ENV_VAR_BY_HOST['liberty9_minion']]);
});

Before('@liberty9_ssh_minion', async function () {
    skipThisScenarioUnless(process.env[ENV_VAR_BY_HOST['liberty9_ssh_minion']]);
});

Before('@oracle9_minion', async function () {
    skipThisScenarioUnless(process.env[ENV_VAR_BY_HOST['oracle9_minion']]);
});

Before('@oracle9_ssh_minion', async function () {
    skipThisScenarioUnless(process.env[ENV_VAR_BY_HOST['oracle9_ssh_minion']]);
});

Before('@rhel9_minion', async function () {
    skipThisScenarioUnless(process.env[ENV_VAR_BY_HOST['rhel9_minion']]);
});

Before('@rhel9_ssh_minion', async function () {
    skipThisScenarioUnless(process.env[ENV_VAR_BY_HOST['rhel9_ssh_minion']]);
});

Before('@rocky8_minion', async function () {
    skipThisScenarioUnless(process.env[ENV_VAR_BY_HOST['rocky8_minion']]);
});

Before('@rocky8_ssh_minion', async function () {
    skipThisScenarioUnless(process.env[ENV_VAR_BY_HOST['rocky8_ssh_minion']]);
});

Before('@rocky9_minion', async function () {
    skipThisScenarioUnless(process.env[ENV_VAR_BY_HOST['rocky9_minion']]);
});

Before('@rocky9_ssh_minion', async function () {
    skipThisScenarioUnless(process.env[ENV_VAR_BY_HOST['rocky9_ssh_minion']]);
});

Before('@ubuntu2004_minion', async function () {
    skipThisScenarioUnless(process.env[ENV_VAR_BY_HOST['ubuntu2004_minion']]);
});

Before('@ubuntu2004_ssh_minion', async function () {
    skipThisScenarioUnless(process.env[ENV_VAR_BY_HOST['ubuntu2004_ssh_minion']]);
});

Before('@ubuntu2204_minion', async function () {
    skipThisScenarioUnless(process.env[ENV_VAR_BY_HOST['ubuntu2204_minion']]);
});

Before('@ubuntu2204_ssh_minion', async function () {
    skipThisScenarioUnless(process.env[ENV_VAR_BY_HOST['ubuntu2204_ssh_minion']]);
});

Before('@ubuntu2404_minion', async function () {
    skipThisScenarioUnless(process.env[ENV_VAR_BY_HOST['ubuntu2404_minion']]);
});

Before('@ubuntu2404_ssh_minion', async function () {
    skipThisScenarioUnless(process.env[ENV_VAR_BY_HOST['ubuntu2404_ssh_minion']]);
});

Before('@debian12_minion', async function () {
    skipThisScenarioUnless(process.env[ENV_VAR_BY_HOST['debian12_minion']]);
});

Before('@debian12_ssh_minion', async function () {
    skipThisScenarioUnless(process.env[ENV_VAR_BY_HOST['debian12_ssh_minion']]);
});

Before('@sle12sp5_minion', async function () {
    skipThisScenarioUnless(process.env[ENV_VAR_BY_HOST['sle12sp5_minion']]);
});

Before('@sle12sp5_ssh_minion', async function () {
    skipThisScenarioUnless(process.env[ENV_VAR_BY_HOST['sle12sp5_ssh_minion']]);
});

Before('@sle15sp3_minion', async function () {
    skipThisScenarioUnless(process.env[ENV_VAR_BY_HOST['sle15sp3_minion']]);
});

Before('@sle15sp3_ssh_minion', async function () {
    skipThisScenarioUnless(process.env[ENV_VAR_BY_HOST['sle15sp3_ssh_minion']]);
});

Before('@sle15sp4_minion', async function () {
    skipThisScenarioUnless(process.env[ENV_VAR_BY_HOST['sle15sp4_minion']]);
});

Before('@sle15sp4_ssh_minion', async function () {
    skipThisScenarioUnless(process.env[ENV_VAR_BY_HOST['sle15sp4_ssh_minion']]);
});

Before('@sle15sp5_minion', async function () {
    skipThisScenarioUnless(process.env[ENV_VAR_BY_HOST['sle15sp5_minion']]);
});

Before('@sle15sp5_ssh_minion', async function () {
    skipThisScenarioUnless(process.env[ENV_VAR_BY_HOST['sle15sp5_ssh_minion']]);
});

Before('@sle15sp6_minion', async function () {
    skipThisScenarioUnless(process.env[ENV_VAR_BY_HOST['sle15sp6_minion']]);
});

Before('@sle15sp6_ssh_minion', async function () {
    skipThisScenarioUnless(process.env[ENV_VAR_BY_HOST['sle15sp6_ssh_minion']]);
});

Before('@sle15sp7_minion', async function () {
    skipThisScenarioUnless(process.env[ENV_VAR_BY_HOST['sle15sp7_minion']]);
});

Before('@sle15sp7_ssh_minion', async function () {
    skipThisScenarioUnless(process.env[ENV_VAR_BY_HOST['sle15sp7_ssh_minion']]);
});

Before('@opensuse156arm_minion', async function () {
    skipThisScenarioUnless(process.env[ENV_VAR_BY_HOST['opensuse156arm_minion']]);
});

Before('@opensuse156arm_ssh_minion', async function () {
    skipThisScenarioUnless(process.env[ENV_VAR_BY_HOST['opensuse156arm_ssh_minion']]);
});

Before('@sle15sp5s390_minion', async function () {
    skipThisScenarioUnless(process.env[ENV_VAR_BY_HOST['sle15sp5s390_minion']]);
});

Before('@sle15sp5s390_ssh_minion', async function () {
    skipThisScenarioUnless(process.env[ENV_VAR_BY_HOST['sle15sp5s390_ssh_minion']]);
});

Before('@salt_migration_minion', async function () {
    skipThisScenarioUnless(process.env[ENV_VAR_BY_HOST['salt_migration_minion']]);
});

Before('@slemicro', async function (scenario) {
    skipThisScenarioUnless(scenario.pickle.uri.includes('slemicro'));
});

Before('@slemicro51_minion', async function () {
    skipThisScenarioUnless(process.env[ENV_VAR_BY_HOST['slemicro51_minion']]);
});

Before('@slemicro51_ssh_minion', async function () {
    skipThisScenarioUnless(process.env[ENV_VAR_BY_HOST['slemicro51_ssh_minion']]);
});

Before('@slemicro52_minion', async function () {
    skipThisScenarioUnless(process.env[ENV_VAR_BY_HOST['slemicro52_minion']]);
});

Before('@slemicro52_ssh_minion', async function () {
    skipThisScenarioUnless(process.env[ENV_VAR_BY_HOST['slemicro52_ssh_minion']]);
});

Before('@slemicro53_minion', async function () {
    skipThisScenarioUnless(process.env[ENV_VAR_BY_HOST['slemicro53_minion']]);
});

Before('@slemicro53_ssh_minion', async function () {
    skipThisScenarioUnless(process.env[ENV_VAR_BY_HOST['slemicro53_ssh_minion']]);
});

Before('@slemicro54_minion', async function () {
    skipThisScenarioUnless(process.env[ENV_VAR_BY_HOST['slemicro54_minion']]);
});

Before('@slemicro54_ssh_minion', async function () {
    skipThisScenarioUnless(process.env[ENV_VAR_BY_HOST['slemicro54_ssh_minion']]);
});

Before('@slemicro55_minion', async function () {
    skipThisScenarioUnless(process.env[ENV_VAR_BY_HOST['slemicro55_minion']]);
});

Before('@slemicro55_ssh_minion', async function () {
    skipThisScenarioUnless(process.env[ENV_VAR_BY_HOST['slemicro55_ssh_minion']]);
});

Before('@slmicro60_minion', async function () {
    skipThisScenarioUnless(process.env[ENV_VAR_BY_HOST['slmicro60_minion']]);
});

Before('@slmicro60_ssh_minion', async function () {
    skipThisScenarioUnless(process.env[ENV_VAR_BY_HOST['slmicro60_ssh_minion']]);
});

Before('@slmicro61_minion', async function () {
    skipThisScenarioUnless(process.env[ENV_VAR_BY_HOST['slmicro61_minion']]);
});

Before('@slmicro61_ssh_minion', async function () {
    skipThisScenarioUnless(process.env[ENV_VAR_BY_HOST['slmicro61_ssh_minion']]);
});

Before('@sle12sp5_buildhost', async function () {
    skipThisScenarioUnless(process.env[ENV_VAR_BY_HOST['sle12sp5_buildhost']]);
});

Before('@sle12sp5_terminal', async function () {
    skipThisScenarioUnless(globalVars.sle12sp5TerminalMac);
});

Before('@sle15sp4_buildhost', async function () {
    skipThisScenarioUnless(process.env[ENV_VAR_BY_HOST['sle15sp4_buildhost']]);
});

Before('@monitoring_server', async function () {
    skipThisScenarioUnless(process.env[ENV_VAR_BY_HOST['monitoring_server']]);
});

Before('@sle15sp4_terminal', async function () {
    skipThisScenarioUnless(globalVars.sle15sp4TerminalMac);
});

Before('@suse_minion', async function (scenario) {
    const filename = scenario.pickle.uri;
    skipThisScenarioUnless(filename.includes('minion') && (filename.includes('sle') || filename.includes('suse')));
});

Before('@sle_micro_minion', async function (scenario) {
    skipThisScenarioUnless(scenario.pickle.uri.includes('slemicro'));
});

Before('@skip_for_debianlike', async function (scenario) {
    const filename = scenario.pickle.uri;
    if (filename.includes('ubuntu') || filename.includes('debian')) {
        skipThisScenario();
    }
});

Before('@skip_for_rocky9', async function (scenario) {
    if (scenario.pickle.uri.includes('rocky9')) {
        skipThisScenario();
    }
});

Before('@skip_for_alma9', async function (scenario) {
    if (scenario.pickle.uri.includes('alma9')) {
        skipThisScenario();
    }
});

Before('@skip_for_minion', async function (scenario) {
    if (scenario.pickle.uri.includes('minion')) {
        skipThisScenario();
    }
});

Before('@skip_for_sle_micro', async function (scenario) {
    if (scenario.pickle.uri.includes('slemicro')) {
        skipThisScenario();
    }
});

Before('@skip_for_sle_micro_ssh_minion', async function (scenario) {
    const sleMicroSshNodes = ['slemicro51_ssh_minion', 'slemicro52_ssh_minion', 'slemicro53_ssh_minion', 'slemicro54_ssh_minion', 'slemicro55_ssh_minion', 'slmicro60_ssh_minion', 'slmicro61_ssh_minion'];
    const currentFeatureNode = scenario.pickle.uri.split(/(_smoke_tests.feature|\/)/)[scenario.pickle.uri.split(/(_smoke_tests.feature|\/)/).length - 2];
    if (sleMicroSshNodes.includes(currentFeatureNode)) {
        skipThisScenario();
    }
});

Before('@skip_for_sl_micro', async function (scenario) {
    if (scenario.pickle.uri.includes('slmicro')) {
        skipThisScenario();
    }
});

// do some tests only if we have SCC credentials
Before('@scc_credentials', async function () {
    skipThisScenarioUnless(getSccCredentials());
});

// do some tests only if there is a private network
Before('@private_net', async function () {
    skipThisScenarioUnless(globalVars.privateNet);
});

// do some tests only if we don't use a mirror
Before('@no_mirror', async function () {
    if (globalVars.mirror) {
        skipThisScenario();
    }
});

// do some tests only if the server is using SUSE Manager
Before('@susemanager', async function () {
    skipThisScenarioUnless(await getProduct(await getTarget('server')) === 'SUSE Manager'); // Use getProduct
});

// do some tests only if the server is using Uyuni
Before('@uyuni', async function () {
    skipThisScenarioUnless(await getProduct(await getTarget('server')) === 'Uyuni'); // Use getProduct
});

// do some tests only if we are using salt bundle
Before('@salt_bundle', async function () {
    skipThisScenarioUnless(globalVars.useSaltBundle);
});

// do some tests only if we are using salt bundle
Before('@skip_if_salt_bundle', async function () {
    if (globalVars.useSaltBundle) {
        skipThisScenario();
    }
});

// do test only if HTTP proxy for Uyuni is defined
Before('@server_http_proxy', async function () {
    skipThisScenarioUnless(globalVars.serverHttpProxy);
});

// do test only if custom downlad endpoint for packages is defined
Before('@custom_download_endpoint', async function () {
    skipThisScenarioUnless(globalVars.customDownloadEndpoint);
});

// do test only if the registry is available
Before('@no_auth_registry', async function () {
    skipThisScenarioUnless(globalVars.noAuthRegistry);
});

// do test only if the registry with authentication is available
Before('@auth_registry', async function () {
    skipThisScenarioUnless(globalVars.authRegistry);
});

// skip tests if executed in cloud environment
Before('@skip_if_cloud', async function () {
    if (envConfig.isCloudProvider) {
        skipThisScenario();
    }
});

// skip tests if executed in cloud environment
Before('@cloud', async function () {
    skipThisScenarioUnless(envConfig.isCloudProvider);
});

// skip tests if executed in containers for the GitHub validation
Before('@skip_if_github_validation', async function () {
    if (envConfig.isGhValidation) {
        skipThisScenario();
    }
});

// skip tests if the server runs in a container
Before('@skip_if_containerized_server', async function () {
    if (envConfig.isContainerizedServer) {
        skipThisScenario();
    }
});

// do test only if we have a containerized server
Before('@containerized_server', async function () {
    skipThisScenarioUnless(envConfig.isContainerizedServer);
});

// skip tests if the server runs on a transactional base OS
Before('@skip_if_transactional_server', async function () {
    if (envConfig.isTransactionalServer) {
        skipThisScenario();
    }
});

// do tests only if the server runs on a transactional base OS
Before('@transactional_server', async function () {
    skipThisScenarioUnless(envConfig.isTransactionalServer);
});

// only test for excessive SCC accesses if SCC access is being logged
Before('@srv_scc_access_logging', async function () {
    skipThisScenarioUnless(await sccAccessLoggingGrain());
});

// do test only if we have beta channels enabled
Before('@beta', async function () {
    skipThisScenarioUnless(envConfig.betaEnabled);
});
