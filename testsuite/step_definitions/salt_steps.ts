import {Given, Then, When} from '@cucumber/cucumber';

import {
    addContext,
    checkTextAndCatchRequestTimeoutPopup,
    FIELD_IDS,
    fileDelete,
    fileInject,
    getApiTest,
    getContext,
    getSystemName,
    getTarget,
    globalVars,
    pillarGet,
    repeatUntilTimeout,
    saltMasterPillarGet
} from '../helpers/index.js';
import {
    manageRepositories,
    removePackages,
    waitUntilServiceInactive
} from '../helpers/embedded_steps/command_helper.js';
import {waitUntilDoNotSeeText} from '../helpers/embedded_steps/common_helper.js';
import {
    waitUntilDoNotSeeTextRefreshingPage,
    waitUntilSeeSystemRefreshingPage
} from '../helpers/embedded_steps/navigation_helper.js';
import {storeFileInSaltMinionConfig} from '../helpers/embedded_steps/salt_helper.js';
import * as fs from 'fs/promises';
import * as tmp from 'tmp';
import {expect} from "@playwright/test";
import {getAppHost, getCurrentPage} from "../helpers/index.js";

Given(/^the Salt master can reach "(.*?)"$/, async function (minion) {
    const systemName = await getSystemName(minion);
    const server = await getTarget('server');
    const start = Date.now();
    await repeatUntilTimeout(async () => {
        const {stdout, returnCode} = await server.run(`salt ${systemName} test.ping`, {checkErrors: false});
        if (returnCode === 0 && stdout.includes(systemName) && stdout.includes('True')) {
            const finished = Date.now();
            console.log(`It took ${(finished - start) / 1000} seconds to contact the minion`);
            return true;
        }
        await new Promise(r => setTimeout(r, 1000));
        return false;
    }, {timeout: 700, reportResult: true});
});

When(/^I get the contents of the remote file "(.*?)"$/, async function (filename) {
    const {stdout} = await (await getTarget('server')).run(`cat ${filename}`);
    addContext('output', stdout);
});

When(/^I stop salt-minion on "(.*?)"$/, async function (minion) {
    const node = await getTarget(minion);
    const pkgname = globalVars.useSaltBundle ? 'venv-salt-minion' : 'salt-minion';
    const osVersion = node.osVersion;
    const osFamily = node.osFamily;
    if (osFamily?.match(/^sles/) && osVersion?.match(/^11/)) {
        await node.run(`rc${pkgname} stop`, {checkErrors: false});
    } else {
        await node.run(`systemctl stop ${pkgname}`, {checkErrors: false});
    }
});

When(/^I start salt-minion on "(.*?)"$/, async function (minion) {
    const node = await getTarget(minion);
    const pkgname = globalVars.useSaltBundle ? 'venv-salt-minion' : 'salt-minion';
    const osVersion = node.osVersion;
    const osFamily = node.osFamily;
    if (osFamily?.match(/^sles/) && osVersion?.match(/^11/)) {
        await node.run(`rc${pkgname} start`, {checkErrors: false});
    } else {
        await node.run(`systemctl start ${pkgname}`, {checkErrors: false});
    }
});

When(/^I restart salt-minion on "(.*?)"$/, async function (minion) {
    const node = await getTarget(minion);
    const pkgname = globalVars.useSaltBundle ? 'venv-salt-minion' : 'salt-minion';
    const osVersion = node.osVersion;
    const osFamily = node.osFamily;
    if (osFamily?.match(/^sles/) && osVersion?.match(/^11/)) {
        await node.run(`rc${pkgname} restart`, {checkErrors: false});
    } else {
        await node.run(`systemctl restart ${pkgname}`, {checkErrors: false});
    }
});

When(/^I refresh salt-minion grains on "(.*?)"$/, async function (minion) {
    const node = await getTarget(minion);
    const saltCall = globalVars.useSaltBundle ? 'venv-salt-call' : 'salt-call';
    await node.run(`${saltCall} saltutil.refresh_grains`);
});

When(/^I setup a git_pillar environment on the Salt master$/, async function (...args: any[]) {
    const file = 'salt_git_pillar_setup.sh';
    const source = `${__dirname}/../upload_files/${file}`;
    const dest = `/tmp/${file}`;
    await fileInject(await getTarget('server'), source, dest);
    await (await getTarget('server')).run(`sh /tmp/${file} setup`, {checkErrors: true, verbose: true});
});

When(/^I clean up the git_pillar environment on the Salt master$/, async function () {
    const file = 'salt_git_pillar_setup.sh';
    await (await getTarget('server')).run(`sh /tmp/${file} clean`, {checkErrors: true, verbose: true});
});

When(/^I wait at most (\d+) seconds until Salt master sees "([^"]*)" as "([^"]*)"$/, async function (keyTimeout, minion, keyType) {
    const cmd = `salt-key --list ${keyType}`;
    await repeatUntilTimeout(async () => {
        const systemName = await getSystemName(minion);
        if (systemName) {
            const {stdout, returnCode} = await (await getTarget('server')).run(cmd, {checkErrors: false});
            return returnCode === 0 && stdout.includes(systemName);
        }
        await new Promise(r => setTimeout(r, 1000));
        return false;
    }, {timeout: Number(keyTimeout)});
});

When(/^I wait until Salt client is inactive on "([^"]*)"$/, async function (minion) {
    const saltMinion = globalVars.useSaltBundle ? 'venv-salt-minion' : 'salt-minion';
    await waitUntilServiceInactive(saltMinion, minion);
});

When(/^I wait until Salt master can reach "([^"]*)"$/, async function (minion) {
    const systemName = getSystemName(minion);
    await (await getTarget('server')).runUntilOk(`bash -c 'until timeout 5s salt ${systemName} test.ping; do :; done'`);
});

When(/^I wait until no Salt job is running on "([^"]*)"$/, async function (minion) {
    const target = await getTarget(minion);
    const saltCall = globalVars.useSaltBundle ? 'venv-salt-call' : 'salt-call';
    await repeatUntilTimeout(async () => {
        const {stdout} = await target.run(`${saltCall} -lquiet saltutil.running`, {verbose: true});
        return stdout === "local:\n";
    }, {timeout: 600});
});

When(/^I delete "([^"]*)" key in the Salt master$/, async function (host) {
    const systemName = getSystemName(host);
    const {stdout} = await (await getTarget('server')).run(`salt-key -y -d ${systemName}`, {checkErrors: false});
    addContext('output', stdout);
});

When(/^I accept "([^"]*)" key in the Salt master$/, async function (host) {
    const systemName = getSystemName(host);
    await (await getTarget('server')).run(`salt-key -y --accept=${systemName}*`);
});

When(/^I list all Salt keys shown on the Salt master$/, async function () {
    await (await getTarget('server')).run('salt-key --list-all', {checkErrors: false, verbose: true});
});

When(/^I get OS information of "([^"]*)" from the Master$/, async function (host) {
    const systemName = getSystemName(host);
    const {stdout} = await (await getTarget('server')).run(`salt ${systemName} grains.get osfullname`);
    addContext('output', stdout);
});

Then(/^it should contain a "([^"]*?)" text$/, async function (content) {
    const output = getContext('output');
    if (!output.includes(content)) {
        throw new Error(`Output does not contain "${content}"`);
    }
});

Then(/^it should contain the OS of "([^"]*)"$/, async function (host) {
    const node = await getTarget(host);
    const osFamily = node.osFamily;
    const family = osFamily?.match(/^opensuse/) ? 'Leap' : 'SLES';
    const output = getContext('output');
    if (!output.includes(family)) {
        throw new Error(`Output does not contain "${family}"`);
    }
});

When(/^I apply state "([^"]*)" to "([^"]*)"$/, async function (state, host) {
    const systemName = getSystemName(host);
    await (await getTarget('server')).run(`salt ${systemName} state.apply ${state}`, {verbose: true});
});

Then(/^salt-api should be listening on local port (\d+)$/, async function (port) {
    const {stdout} = await (await getTarget('server')).run(`ss -ntl | grep ${port}`);
    if (!stdout.includes(`127.0.0.1:${port}`)) {
        throw new Error(`Salt-api not listening on 127.0.0.1:${port}`);
    }
});

Then(/^salt-master should be listening on public port (\d+)$/, async function (port) {
    const {stdout} = await (await getTarget('server')).run(`ss -ntl | grep ${port}`);
    if (!stdout.match(/(0.0.0.0|\*|\[::\]):#{port}/)) {
        throw new Error(`Salt-master not listening on public port ${port}`);
    }
});

Then(/^the system should have a base channel set$/, async function () {
    await waitUntilDoNotSeeText('This system has no Base Software Channel. You can select a Base Channel from the list below.');
});

Then(/^"(.*?)" should not be registered$/, async function (host) {
    const systemName = getSystemName(host);
    const systems = await getApiTest().system.listSystems();
    const systemNames = systems.map((s: any) => s.name);
    if (systemNames.includes(systemName)) {
        throw new Error(`System ${systemName} is registered but should not be`);
    }
});

Then(/^"(.*?)" should be registered$/, async function (host) {
    const systemName = getSystemName(host);
    const systems = await getApiTest().system.listSystems();
    const systemNames = systems.map((s: any) => s.name);
    if (!systemNames.includes(systemName)) {
        throw new Error(`System ${systemName} is not registered but should be`);
    }
});

Then(/^"(.*?)" should have been reformatted$/, async function (host) {
    const systemName = getSystemName(host);
    const {stdout} = await (await getTarget('server')).run(`salt ${systemName} file.fileExists /intact`);
    if (!stdout.includes('False')) {
        throw new Error(`Minion ${host} is intact`);
    }
});

When(/^I click on preview$/, async function () {
    const maxAttempts = 2;
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        const stopButton = getCurrentPage().getByRole('button', {name: 'stop'});
        if (await stopButton.isVisible()) {
            console.log('Stop button visible, searching request ongoing.');
        } else {
            await getCurrentPage().locator('button#preview').click();
        }
        const runButton = getCurrentPage().getByRole('button', {name: 'run'});
        if (await runButton.isVisible({timeout: 5000})) {
            console.log('The run button is visible.');
            return;
        } else {
            console.log(`The run button is not visible after clicking preview (attempt ${attempt}).`);
        }
    }
    throw new Error(`Preview button not working: the run button is not visible after ${maxAttempts} attempts.`);
});

When(/^I click on stop waiting$/, async function () {
    await getCurrentPage().locator('button#stop').click();
});

When(/^I click on run$/, async function () {
    await getCurrentPage().locator('button#run').click();
});

When(/^I expand the results for "([^"]*)"$/, async function (host) {
    const systemName = getSystemName(host);
    await getCurrentPage().locator(`div[id='${systemName}']`).click();
});

When(/^I enter command "([^"]*)"$/, async function (cmd) {
    await getCurrentPage().locator('input#command').fill(cmd);
});

When(/^I enter target "([^"]*)"$/, async function (host) {
    const value = await getSystemName(host);
    await getCurrentPage().locator('input#target').fill(value);
});

Then(/^I should see "([^"]*)" in the command output for "([^"]*)"$/, async function (text, host) {
    const systemName = getSystemName(host);
    await getCurrentPage().locator(`pre[id='${systemName}-results']`).filter({hasText: text}).waitFor({state: 'visible'});
});

When(/^I manually install the "([^"]*)" formula on the server$/, async function (pkg) {
    const server = await getTarget('server');
    await server.run('zypper --non-interactive refresh');
    await server.run(`zypper --non-interactive install --force ${pkg}-formula`);
});

When(/^I manually uninstall the "([^"]*)" formula from the server$/, async function (pkg) {
    const server = await getTarget('server');
    await server.run(`zypper --non-interactive remove ${pkg}-formula`);
    if (pkg === 'uyuni-config') {
        await server.run('zypper --non-interactive remove uyuni-config-modules');
    }
});

When(/^I synchronize all Salt dynamic modules on "([^"]*)"$/, async function (host) {
    const systemName = getSystemName(host);
    await (await getTarget('server')).run(`salt ${systemName} saltutil.sync_all`);
});

When(/^I remove "([^"]*)" from salt cache on "([^"]*)"$/, async function (filename, host) {
    const node = await getTarget(host);
    const saltCache = globalVars.useSaltBundle ? '/var/cache/venv-salt-minion/' : '/var/cache/salt/';
    await fileDelete(node, `${saltCache}${filename}`);
});

When(/^I remove "([^"]*)" from salt minion config directory on "([^"]*)"$/, async function (filename, host) {
    const node = await getTarget(host);
    const saltConfig = globalVars.useSaltBundle ? '/etc/venv-salt-minion/minion.d/' : '/etc/salt/minion.d/';
    await fileDelete(node, `${saltConfig}${filename}`);
});

When(/^I configure salt minion on "([^"]*)"$/, async function (host) {
    const content = `master: ${(await getTarget('server')).fullHostname}\nserver_id_use_crc: adler32\nenable_legacy_startup_events: False\nenable_fqdns_grains: False\nstart_event_grains:\n  - machine_id\n  - saltboot_initrd\n  - susemanager`;
    await storeFileInSaltMinionConfig(content, 'susemanager.conf', host);
});

When(/^I store "([^"]*)" into file "([^"]*)" in salt minion config directory on "([^"]*)"$/, async function (content, filename, host) {
    await storeFileInSaltMinionConfig(content, filename, host);
});

When(/^I ([^ ]*) the "([^"]*)" formula$/, async function (action, formula) {
    const targetClass = action === 'check' ? 'fa-square-o' : 'fa-check-square-o';
    const xpathQuery = `//a[@id = '${formula}']/i[contains(@class, '${targetClass}')]`;
    await getCurrentPage().locator(`xpath=${xpathQuery}`).click();
});

Then(/^the "([^"]*)" formula should be ([^ ]*)$/, async function (formula, state) {
    const expectedClass = state === 'checked' ? 'fa-check-square-o' : 'fa-square-o';
    const xpathQuery = `//a[@id = '${formula}']/i[contains(@class, '${expectedClass}')]`;
    const isCorrect = await getCurrentPage().locator(`xpath=${xpathQuery}`).isVisible();
    if (!isCorrect) {
        throw new Error(`Checkbox for ${formula} is not ${state}`);
    }
});

When(/^I select "([^"]*)" in (.*) field$/, async function (value, box) {
    const fieldId = FIELD_IDS[box];
    await getCurrentPage().locator(`select#${fieldId}`).selectOption({value});
});

Then(/^the timezone on "([^"]*)" should be "([^"]*)"$/, async function (minion, timezone) {
    const node = await getTarget(minion);
    const {stdout} = await node.run('date +%Z');
    const result = stdout.trim();
    if (result === 'CEST') {
        if (timezone !== 'CET') {
            throw new Error(`The timezone ${timezone} is different to CET`);
        }
    } else if (result !== timezone) {
        throw new Error(`The timezone ${timezone} is different to ${result}`);
    }
});

Then(/^the keymap on "([^"]*)" should be "([^"]*)"$/, async function (minion, keymap) {
    const node = await getTarget(minion);
    const {stdout} = await node.run('grep \'KEYMAP=\' /etc/vconsole.conf');
    if (stdout.trim() !== `KEYMAP=${keymap}`) {
        throw new Error(`The keymap ${keymap} is different to the output: ${stdout.trim()}`);
    }
});

Then(/^the language on "([^"]*)" should be "([^"]*)"$/, async function (minion, language) {
    const node = await getTarget(minion);
    const {stdout: langOutput} = await node.run('grep \'RC_LANG=\' /etc/sysconfig/language');
    if (langOutput.trim() !== `RC_LANG="${language}"`) {
        const {stdout: localeOutput} = await node.run('grep \'LANG=\' /etc/locale.conf');
        if (localeOutput.trim() !== `LANG=${language}`) {
            throw new Error(`The language ${language} is different to the output: ${localeOutput.trim()}`);
        }
    }
});

When(/^I refresh the pillar data$/, async function () {
    await (await getTarget('server')).run(`salt '${(await getTarget('sle_minion')).fullHostname}' saltutil.refresh_pillar wait=True`);
});

When(/^I wait until there is no pillar refresh salt job active$/, async function () {
    await repeatUntilTimeout(async () => {
        const {stdout} = await (await getTarget('server')).run('salt-run jobs.active');
        return !stdout.includes('saltutil.refresh_pillar');
    }, {timeout: 600, reportResult: true});
});

When(/^I wait until there is no Salt job calling the module "([^"]*)" on "([^"]*)"$/, async function (saltModule, minion) {
    const target = await getTarget(minion);
    const saltCall = globalVars.useSaltBundle ? 'venv-salt-call' : 'salt-call';
    await target.runUntilFail(`${saltCall} -lquiet saltutil.running | grep ${saltModule}`, 600);
});

Then(/^the pillar data for "([^"]*)" should be "([^"]*)" on "([^"]*)"$/, async function (key, value, minion) {
    const stdout = await pillarGet(key, minion);
    if (value === '') {
        if (stdout.split('\n').length !== 1) {
            throw new Error(`Output has more than one line: ${stdout}`);
        }
    } else {
        if (stdout.split('\n').length <= 1) {
            throw new Error(`Output value wasn't found: ${stdout}`);
        }
        if (stdout.split('\n')[1].trim() !== value) {
            throw new Error(`Output value is different than ${value}: ${stdout}`);
        }
    }
});

Then(/^the pillar data for "([^"]*)" should contain "([^"]*)" on "([^"]*)"$/, async function (key, value, minion) {
    const stdout = await pillarGet(key, minion);
    if (!stdout.includes(value)) {
        throw new Error(`Output doesn't contain ${value}: ${stdout}`);
    }
});

Then(/^the pillar data for "([^"]*)" should not contain "([^"]*)" on "([^"]*)"$/, async function (key, value, minion) {
    const stdout = await pillarGet(key, minion);
    if (stdout.includes(value)) {
        throw new Error(`Output contains ${value}: ${stdout}`);
    }
});

Then(/^the pillar data for "([^"]*)" should be empty on "([^"]*)"$/, async function (key, minion) {
    await repeatUntilTimeout(async () => {
        const stdout = await pillarGet(key, minion);
        return stdout.split('\n').length === 1;
    }, {reportResult: true});
});

Then(/^the pillar data for "([^"]*)" should be empty on the Salt master$/, async function (key) {
    const output = await saltMasterPillarGet(key);
    if (output !== '') {
        throw new Error(`Output value is not empty: ${output}`);
    }
});

Then(/^the pillar data for "([^"]*)" should be "([^"]*)" on the Salt master$/, async function (key, value) {
    const output = await saltMasterPillarGet(key);
    if (output.trim() !== value) {
        throw new Error(`Output value is different than ${value}: ${output}`);
    }
});

Given(/^I try to download "([^"]*)" from channel "([^"]*)"$/, async function (rpm: string, channel: string) {
    const server = await getTarget('server');
    let url = `https://${server.fullHostname}/rhn/manager/download/${channel}/getPackage/${rpm}`;

    if (getContext('token')) {
        url = `${url}?token=${getContext('token')}`;
    }

    let tempFilePath: string | null = null;
    let cleanupCallback: (() => void) | null = null;

    try {
        const tmpFileResult = await new Promise<{ path: string, cleanup: () => void }>((resolve, reject) => {
            tmp.file({
                prefix: 'download-',
                postfix: `.${rpm.split('.').pop() || 'tmp'}`,
                keep: false
            }, (err, path, fd, cleanup) => {
                if (err) return reject(err);
                resolve({path, cleanup});
            });
        });

        tempFilePath = tmpFileResult.path;
        cleanupCallback = tmpFileResult.cleanup;
        addContext('downloadPath', tempFilePath);

        const response = await fetch(url);

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`HTTP Error ${response.status}: ${response.statusText}. Body: ${errorText.substring(0, 100)}...`);
        }

        const buffer = await response.arrayBuffer();
        await fs.writeFile(tempFilePath, Buffer.from(buffer));

    } catch (e) {
        addContext('downloadError', e instanceof Error ? e : new Error("Unknown download error."));
        addContext('downloadPath', null);
    } finally {
        if (cleanupCallback) {
            cleanupCallback();
        }
    }
});


Then(/^the download should get a (\d+) response$/, function (code: string) {
    const expectedCode = parseInt(code, 10);
    const error = getContext('downloadError');

    expect(error, `Expected a download error with status ${expectedCode}, but no error was caught.`).toBeDefined();
    expect(error.status, `Expected HTTP status code ${expectedCode}, but received ${error.status || 'N/A'}.`).toEqual(expectedCode);
});

Then(/^the download should get no error$/, function () {
    const error = getContext('downloadError');
    expect(error, `Expected no download error, but received: ${error ? JSON.stringify(error) : error}`).toBeNull();
});

When(/^I reject "([^"]*)" from the Pending section$/, async function (host) {
    const systemName = getSystemName(host);
    const xpathQuery = `//tr[td[contains(.,'${systemName}')]]//button[@title = 'Reject']`;
    await getCurrentPage().locator(`xpath=${xpathQuery}`).click();
});

When(/^I delete "([^"]*)" from the Rejected section$/, async function (host) {
    const systemName = getSystemName(host);
    const xpathQuery = `//tr[td[contains(.,'${systemName}')]]//button[@title = 'Delete']`;
    await getCurrentPage().locator(`xpath=${xpathQuery}`).click();
});

When(/^I see "([^"]*)" fingerprint$/, async function (host) {
    const node = await getTarget(host);
    const saltCall = globalVars.useSaltBundle ? 'venv-salt-call' : 'salt-call';
    const {stdout} = await node.run(`${saltCall} --local key.finger`);
    const fing = stdout.split('\n')[1].trim();
    if (!(await checkTextAndCatchRequestTimeoutPopup(getCurrentPage(), undefined, fing))) {
        throw new Error(`Text: ${fing} not found`);
    }
});

When(/^I accept "([^"]*)" key$/, async function (host) {
    const systemName = getSystemName(host);
    const xpathQuery = `//tr[td[contains(.,'${systemName}')]]//button[@title = 'Accept']`;
    await getCurrentPage().locator(`xpath=${xpathQuery}`).click();
});

When(/^I refresh page until I see "(.*?)" hostname as text$/, async function (minion) {
    await getCurrentPage().locator('#spacewalk-content').waitFor();
    const systemName = await getSystemName(minion);
    await waitUntilSeeSystemRefreshingPage(systemName);
});

When(/^I refresh page until I do not see "(.*?)" hostname as text$/, async function (minion) {
    await getCurrentPage().locator('#spacewalk-content').waitFor();
    const systemName = await getSystemName(minion);
    await waitUntilDoNotSeeTextRefreshingPage(systemName);
});

When(/^I list packages with "(.*?)"$/, async function (str) {
    await getCurrentPage().locator('input#package-search').fill(str);
    await getCurrentPage().locator('button#search').click();
    await getCurrentPage().locator('button#search').isEnabled();
});

When(/^I change the state of "([^"]*)" to "([^"]*)" and "([^"]*)"$/, async function (pkg, state, instdState) {
    await getCurrentPage().locator(`select#${pkg}-pkg-state`).selectOption(state);
    if (instdState && state === 'Installed') {
        await getCurrentPage().locator(`select#${pkg}-version-constraint`).selectOption(instdState);
    }
});

When(/^I click apply$/, async function () {
    await getCurrentPage().locator('button#apply').click();
});

When(/^I click save$/, async function () {
    await getCurrentPage().locator('button#save').click();
});

Then(/^the salt event log on server should contain no failures$/, async function () {
    const server = await getTarget('server');
    // File injection can't be done
    throw new Error('This step requires file injection which cannot be performed.');
});

When(/^I should see a "([^"]*)" or "([^"]*)" text in element "([^"]*)"$/, async function (text1: string, text2: string, element: string) {
    const elementLocator = getCurrentPage().locator(`div#${element}, div.${element}, span#${element}, span.${element}`);
    await expect(elementLocator.getByText(text1).or(elementLocator.getByText(text2))).toBeVisible();
});

When(/^I install Salt packages from "(.*?)"$/, async function (host) {
    const target = await getTarget(host);
    const pkgs = globalVars.useSaltBundle ? 'venv-salt-minion' : 'salt salt-minion';
    const osFamily = target.osFamily;
    if (osFamily?.match(/^sles/)) {
        await target.run(`test -e /usr/bin/zypper && zypper --non-interactive install -y ${pkgs}`, {checkErrors: false});
    } else if (osFamily?.match(/transactional/)) {
        await target.run(`test -e /usr/bin/zypper && transactional-update -n pkg install ${pkgs}`, {checkErrors: false});
    } else if (osFamily?.match(/^centos|rocky/)) {
        await target.run(`test -e /usr/bin/yum && yum -y install ${pkgs}`, {checkErrors: false});
    } else if (osFamily?.match(/^debian/)) {
        const debPkgs = globalVars.product !== 'Uyuni' ? 'salt-common salt-minion' : pkgs;
        await target.run(`test -e /usr/bin/apt && apt -y install ${debPkgs}`, {checkErrors: false});
    }
});

When(/^I enable repositories before installing Salt on this "([^"]*)"$/, async function (host) {
    await manageRepositories('enable', 'tools_additional_repo', host, 'without error control');
});

When(/^I disable repositories after installing Salt on this "([^"]*)"$/, async function (host) {
    await manageRepositories('disable', 'tools_additional_repo', host, 'without error control');
});

Then(/^I run spacecmd listeventhistory for "([^"]*)"$/, async function (host) {
    const server = await getTarget('server');
    const systemName = getSystemName(host);
    await server.run('spacecmd -u admin -p admin clear_caches');
    await server.run(`spacecmd -u admin -p admin system_listeventhistory ${systemName}`);
});

When(/^I perform a full salt minion cleanup on "([^"]*)"$/, async function (host) {
    const node = await getTarget(host);
    const saltBundleConfigDir = '/etc/venv-salt-minion';
    const saltClassicConfigDir = '/etc/salt';
    const saltBundleCleanupPaths = '/var/cache/venv-salt-minion /run/venv-salt-minion /var/venv-salt-minion.log /var/tmp/.root*';
    const saltClassicCleanupPaths = '/var/cache/salt/minion /var/run/salt /run/salt /var/log/salt /var/tmp/.root*';
    await node.run(`rm -f ${saltBundleConfigDir}/grains ${saltBundleConfigDir}/minion_id`, {checkErrors: false});
    await node.run(`find ${saltBundleConfigDir}/minion.d/ -type f ! -name '00-venv.conf' -delete`, {checkErrors: false});
    await node.run(`rm -f ${saltBundleConfigDir}/pki/minion/*`, {checkErrors: false});
    await node.run(`rm -f ${saltClassicConfigDir}/grains ${saltClassicConfigDir}/minion_id`, {checkErrors: false});
    await node.run(`find ${saltClassicConfigDir}/minion.d/ -type f ! -name '00-venv.conf' -delete`, {checkErrors: false});
    await node.run(`rm -f ${saltClassicConfigDir}/pki/minion/*`, {checkErrors: false});
    await node.run(`rm -Rf /root/salt ${saltBundleCleanupPaths} ${saltClassicCleanupPaths}`, {checkErrors: false});
    await removePackages('venv-salt-minion salt salt-minion', host, 'without error control');
    await manageRepositories('disable', 'tools_update_repo tools_pool_repo', host, 'without error control');
});

When(/^I install a salt pillar top file for "([^"]*)" with target "([^"]*)" on the server$/, async function (files, host) {
    const server = await getTarget('server');
    const systemName = host === '*' ? '*' : await getSystemName(host);
    let script = 'base:\n';
    if (systemName === '*') {
        script += '  \'*\':\n';
    } else {
        script += `  '${systemName}':\n`;
    }
    files.split(', ').forEach((file: string) => {
        script += `    - '${file}'\n`;
    });
    // file injection not possible
    throw new Error('This step requires file injection which cannot be performed.');
});

When(/^I install the package download endpoint pillar file on the server$/, async function () {
    const filepath = '/srv/pillar/pkg_endpoint.sls';
    const server = await getTarget('server');
    if (!globalVars.customDownloadEndpoint) {
        throw new Error('Global variable customDownloadEndpoint is not set');
    }
    const uri = new URL(globalVars.customDownloadEndpoint);
    const content = `pkg_download_point_protocol: ${uri.protocol.replace(':', '')}\npkg_download_point_host: ${uri.hostname}\npkg_download_point_port: ${uri.port}`;
    await server.run(`echo -e "${content}" > ${filepath}`);
});

When(/^I delete the package download endpoint pillar file from the server$/, async function () {
    const filepath = '/srv/pillar/pkg_endpoint.sls';
    await fileDelete(await getTarget('server'), filepath);
});

When(/^I install "([^"]*)" to custom formula metadata directory "([^"]*)"$/, async function (file, formula) {
    const server = await getTarget('server');
    const dest = `/srv/formula_metadata/${formula}/${file}`;
    await server.run(`mkdir -p /srv/formula_metadata/${formula}`);
    // File injection not possible
    throw new Error('This step requires file injection which cannot be performed.');
});

When(/^I migrate "([^"]*)" from salt-minion to venv-salt-minion$/, async function (host) {
    const server = await getTarget('server');
    const systemName = (await getTarget(host)).fullHostname;
    const migrate = `salt ${systemName} state.apply util.mgr_switch_to_venv_minion`;
    await server.run(migrate, {checkErrors: true, verbose: true});
});

When(/^I purge salt-minion on "([^"]*)" after a migration$/, async function (host) {
    const server = await getTarget('server');
    const systemName = (await getTarget(host)).fullHostname;
    const cleanup = `salt ${systemName} state.apply util.mgr_switch_to_venv_minion pillar='{"mgr_purge_non_venv_salt_files": True, "mgr_purge_non_venv_salt": True}'`;
    await server.run(cleanup, {checkErrors: true, verbose: true});
});

When(/^I apply highstate on "([^"]*)"$/, async function (host) {
    const systemName = getSystemName(host);
    let cmd = 'salt';
    if (host.includes('ssh_minion')) {
        cmd = 'mgr-salt-ssh';
    } else if (host.includes('minion') || host.includes('build') || host.includes('proxy')) {
        cmd = 'salt';
    }
    console.log(`Salt command: ${cmd} ${systemName} state.highstate`);
    await (await getTarget('server')).runUntilOk(`${cmd} ${systemName} state.highstate`);
});
