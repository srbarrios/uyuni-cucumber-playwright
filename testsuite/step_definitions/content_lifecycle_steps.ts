import {Then, When} from '@cucumber/cucumber';

import {
    checkTextAndCatchRequestTimeoutPopup, fileInject,
    getApiTest,
    getCurrentPage,
    getSystemName,
    getTarget,
    timeouts,
    TIMEOUTS
} from '../helpers/index.js';
import {enterTextAsField} from '../helpers/embedded_steps/navigation_helper.js';
import * as path from "path";
import {dirname} from "path";
import {fileURLToPath} from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

When(/^I click the environment build button$/, async function (...args: any[]) {
    const buildButton = getCurrentPage().getByRole('button', {name: 'Build'}).first();
    await buildButton.waitFor({state: 'visible', timeout: timeouts.long * 1000});
    await buildButton.click();
});

When(/^I click promote from Development to QA$/, async function () {
    const promoteButton = getCurrentPage().locator('xpath=//button[contains(., \'Promote\')]').first();
    await promoteButton.click();
});

When(/^I click promote from QA to Production$/, async function () {
    const promoteButton = getCurrentPage().locator('xpath=(//button[contains(., \'Promote\')])[2]').first();
    await promoteButton.click();
});

Then(/^I should see a "([^"]*)" text in the environment "([^"]*)"$/, async function (text, env) {
    const envLocator = getCurrentPage().locator(`xpath=//h3[text()='${env}']/../..`).first();
    if (!(await checkTextAndCatchRequestTimeoutPopup(getCurrentPage(), envLocator, text))) {
        throw new Error(`Text "${text}" not found in environment "${env}"`);
    }
});

When(/^I wait at most (\d+) seconds until I see "([^"]*)" text in the environment "([^"]*)"$/, async function (seconds, text, env) {
    const envLocator = getCurrentPage().locator(`xpath=//h3[text()='${env}']/../..`).first();
    if (!(await checkTextAndCatchRequestTimeoutPopup(getCurrentPage(), envLocator, text, undefined, Number(seconds) * 1000))) {
        throw new Error(`Text "${text}" not found in environment "${env}"`);
    }
});

When(/^I wait until I see "([^"]*)" text in the environment "([^"]*)"$/, async function (text, env) {
    const envLocator = getCurrentPage().locator(`xpath=//h3[text()='${env}']/../..`).first();
    if (!(await checkTextAndCatchRequestTimeoutPopup(getCurrentPage(), envLocator, text, undefined, TIMEOUTS.long * 1000))) {
        throw new Error(`Text "${text}" not found in environment "${env}"`);
    }
});

When(/^I add the "([^"]*)" channel to sources$/, async function (channel) {
    const checkbox = getCurrentPage().locator(`xpath=//mark[text()='${channel}']/../../..//input[@type="checkbox"]`);
    await checkbox.check();
});

When(/^I click the "([^"]*)" item (.*?) button$/, async function (name, action) {
    let buttonSelector = '';
    switch (action) {
        case 'details':
            buttonSelector = 'i[contains(@class, \'fa-list\')]';
            break;
        case 'edit':
            buttonSelector = 'i[contains(@class, \'fa-edit\')]';
            break;
        case 'delete':
            buttonSelector = 'i[contains(@class, \'fa-trash\')]';
            break;
        default:
            throw new Error(`Unknown action: ${action}`);
    }
    const itemLocator = getCurrentPage().locator(`xpath=//td[contains(text(), '${name}')]/ancestor::tr`);
    await itemLocator.locator(`button/${buttonSelector}`).first().click();
});

When(/^I click the "([^"]*)" item (.*?) button if exists$/, async function (name, action) {
    let buttonSelector = '';
    switch (action) {
        case 'details':
            buttonSelector = 'i[contains(@class, \'fa-list\')]';
            break;
        case 'edit':
            buttonSelector = 'i[contains(@class, \'fa-edit\')]';
            break;
        case 'delete':
            buttonSelector = 'i[contains(@class, \'fa-trash\')]';
            break;
        default:
            throw new Error(`Unknown action: ${action}`);
    }
    const itemLocator = getCurrentPage().locator(`xpath=//td[contains(text(), '${name}')]/ancestor::tr`);
    const buttonLocator = itemLocator.locator(`button/${buttonSelector}`);
    if (await buttonLocator.count() > 0) {
        await buttonLocator.first().click();
    } else {
        // Ignored, element not found
    }
});

When(/^I backup the SSH authorized_keys file of host "([^"]*)"$/, async function (host) {
    const target = await getTarget(host);
    const authKeysPath = '/root/.ssh/authorized_keys';
    const authKeysSavPath = '/root/.ssh/authorized_keys.sav';
    const {returnCode} = await target.run(`cp ${authKeysPath} ${authKeysSavPath}`);
    if (returnCode !== 0) {
        throw new Error('error backing up authorized_keys on host');
    }
});

When(/^I add pre-generated SSH public key to authorized_keys of host "([^"]*)"$/, async function (host) {
    const keyFilename = 'id_rsa_bootstrap-passphrase_linux.pub';
    const target = await getTarget(host);
    // File injection cannot be performed
    throw new Error('This step requires file injection which cannot be performed.');
});

When(/^I add pre-generated SSH public key to authorized_keys of host "([^"]*)"$/, async function (host) {
    const keyFilename = 'id_rsa_bootstrap-passphrase_linux.pub';
    const target = await getTarget(host);
    const source = path.join(__dirname, `../upload_files/ssh_keypair/${keyFilename}`);
    const dest = `/tmp/${keyFilename}`;
    const success = await fileInject(target, source, dest);
    if (!success) throw new Error('File injection failed');
    await target.run(`cat /tmp/${keyFilename} >> /root/.ssh/authorized_keys`, {timeout: 500});
});

When(/^I restore the SSH authorized_keys file of host "([^"]*)"$/, async function (host) {
    const target = await getTarget(host);
    const authKeysPath = '/root/.ssh/authorized_keys';
    const authKeysSavPath = '/root/.ssh/authorized_keys.sav';
    await target.run(`cp ${authKeysSavPath} ${authKeysPath}`);
    await target.run(`rm ${authKeysSavPath}`);
});

When(/^I add "([^"]*)" calendar file as url$/, async function (file) {
    const server = await getTarget('server');
    // File injection cannot be performed
    throw new Error('This step requires file injection which cannot be performed.');
});

When(/^I add "([^"]*)" calendar file as url$/, async function (file) {
    const server = await getTarget('server');
    const source = path.join(__dirname, `../upload_files/${file}`);
    const dest = `/srv/www/htdocs/pub/${file}`;
    const success = await fileInject(server, source, dest);
    if (!success) throw new Error('File injection failed');

    await server.run(`chmod 644 ${dest}`);
    const url = `https://${(await getTarget('server')).fullHostname}/pub/${file}`;
    console.log(`URL: ${url}`);
    await enterTextAsField(url, 'calendar-data-text');
});

When(/^I deploy testing playbooks and inventory files to "([^"]*)"$/, async function (host) {
    // File injection cannot be performed
    throw new Error('This step requires file injection which cannot be performed.');
});

When(/^I deploy testing playbooks and inventory files to "([^"]*)"$/, async function (host) {
    const target = await getTarget(host);
    const dest = '/srv/playbooks/orion_dummy/';
    await target.run(`mkdir -p ${dest}`);
    const baseDir = path.join(__dirname, '../upload_files/ansible/playbooks/orion_dummy/');

    const filesToInject = [
        {src: 'playbook_orion_dummy.yml', dest: `${dest}playbook_orion_dummy.yml`},
        {src: 'hosts', dest: `${dest}hosts`},
        {src: 'file.txt', dest: `${dest}file.txt`},
    ];

    for (const file of filesToInject) {
        const success = await fileInject(target, path.join(baseDir, file.src), file.dest);
        if (!success) throw new Error(`File injection failed for ${file.src}`);
    }

    const playbookPingSource = path.join(__dirname, '../upload_files/ansible/playbooks/playbook_ping.yml');
    const playbookPingDest = '/srv/playbooks/playbook_ping.yml';
    const successPing = await fileInject(target, playbookPingSource, playbookPingDest);
    if (!successPing) throw new Error('File injection failed for playbook_ping.yml');
});

When(/^I enter the reactivation key of "([^"]*)"$/, async function (host) {
    const systemName = await getSystemName(host);
    const nodeId = await getApiTest().system.retrieveServerId(systemName);
    if (!nodeId) throw new Error(`Cannot find node ID for system ${systemName}`);
    const reactKey = await getApiTest().system.obtainReactivationKey(nodeId);
    await enterTextAsField(reactKey, 'reactivationKey');
});

When(/^I check the "remove fonts packages" CLM filter$/, async function () {
    await getCurrentPage().locator('input[name="remove_fonts_packages"]').check();
});
