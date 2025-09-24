import { Given, When, Then } from '@cucumber/cucumber';
// Central helpers (browser, page, utilities)
import * as Helpers from '../helpers';
import { getBrowserInstances } from '../helpers/core/env';
import { checkTextAndCatchRequestTimeoutPopup, refreshPage } from '../helpers/core/commonlib';
import { getSystemName } from '../helpers/core/commonlib';

When(/^I click the environment build button$/, async function (...args: any[]) {
    const { page } = getBrowserInstances();
    const buildButton = page.getByRole('button', { name: 'Build' }).first();
    await buildButton.waitFor({ state: 'enabled', timeout: Helpers.timeouts.default * 1000 });
    await buildButton.click();
});

When(/^I click promote from Development to QA$/, async function () {
    const { page } = getBrowserInstances();
    const promoteButton = page.locator('xpath=//button[contains(., \'Promote\')]').first();
    await promoteButton.click();
});

When(/^I click promote from QA to Production$/, async function () {
    const { page } = getBrowserInstances();
    const promoteButton = page.locator('xpath=(//button[contains(., \'Promote\')])[2]').first();
    await promoteButton.click();
});

Then(/^I should see a "([^"]*)" text in the environment "([^"]*)"$/, async function (text, env) {
    const { page } = getBrowserInstances();
    const envLocator = page.locator(`xpath=//h3[text()='${env}']/../..`).first();
    if (!(await checkTextAndCatchRequestTimeoutPopup(envLocator, text))) {
        throw new Error(`Text "${text}" not found in environment "${env}"`);
    }
});

When(/^I wait at most (\d+) seconds until I see "([^"]*)" text in the environment "([^"]*)"$/, async function (seconds, text, env) {
    const { page } = getBrowserInstances();
    const envLocator = page.locator(`xpath=//h3[text()='${env}']/../..`).first();
    if (!(await checkTextAndCatchRequestTimeoutPopup(envLocator, text, { timeoutMs: Number(seconds) * 1000 }))) {
        throw new Error(`Text "${text}" not found in environment "${env}"`);
    }
});

When(/^I wait until I see "([^"]*)" text in the environment "([^"]*)"$/, async function (text, env) {
    const { page } = getBrowserInstances();
    const envLocator = page.locator(`xpath=//h3[text()='${env}']/../..`).first();
    if (!(await checkTextAndCatchRequestTimeoutPopup(envLocator, text, { timeoutMs: Helpers.timeouts.default * 1000 }))) {
        throw new Error(`Text "${text}" not found in environment "${env}"`);
    }
});

When(/^I add the "([^"]*)" channel to sources$/, async function (channel) {
    const { page } = getBrowserInstances();
    const checkbox = page.locator(`xpath=//mark[text()='${channel}']/../../..//input[@type="checkbox"]`);
    await checkbox.check();
});

When(/^I click the "([^"]*)" item (.*?) button$/, async function (name, action) {
    const { page } = getBrowserInstances();
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
    const itemLocator = page.locator(`xpath=//td[contains(text(), '${name}')]/ancestor::tr`);
    await itemLocator.locator(`button/${buttonSelector}`).first().click();
});

When(/^I click the "([^"]*)" item (.*?) button if exists$/, async function (name, action) {
    const { page } = getBrowserInstances();
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
    const itemLocator = page.locator(`xpath=//td[contains(text(), '${name}')]/ancestor::tr`);
    const buttonLocator = itemLocator.locator(`button/${buttonSelector}`);
    if (await buttonLocator.count() > 0) {
        await buttonLocator.first().click();
    } else {
        // Ignored, element not found
    }
});

When(/^I backup the SSH authorized_keys file of host "([^"]*)"$/, async function (host) {
    const target = await Helpers.getTarget(host);
    const authKeysPath = '/root/.ssh/authorized_keys';
    const authKeysSavPath = '/root/.ssh/authorized_keys.sav';
    const { returnCode } = await target.run(`cp ${authKeysPath} ${authKeysSavPath}`);
    if (returnCode !== 0) {
        throw new Error('error backing up authorized_keys on host');
    }
});

When(/^I add pre-generated SSH public key to authorized_keys of host "([^"]*)"$/, async function (host) {
    const keyFilename = 'id_rsa_bootstrap-passphrase_linux.pub';
    const target = await Helpers.getTarget(host);
    // File injection cannot be performed
    throw new Error('This step requires file injection which cannot be performed.');
});

When(/^I restore the SSH authorized_keys file of host "([^"]*)"$/, async function (host) {
    const target = await Helpers.getTarget(host);
    const authKeysPath = '/root/.ssh/authorized_keys';
    const authKeysSavPath = '/root/.ssh/authorized_keys.sav';
    await target.run(`cp ${authKeysSavPath} ${authKeysPath}`);
    await target.run(`rm ${authKeysSavPath}`);
});

When(/^I add "([^"]*)" calendar file as url$/, async function (file) {
    const { page } = getBrowserInstances();
    const server = await Helpers.getTarget('server');
    // File injection cannot be performed
    throw new Error('This step requires file injection which cannot be performed.');
});

When(/^I deploy testing playbooks and inventory files to "([^"]*)"$/, async function (host) {
    // File injection cannot be performed
    throw new Error('This step requires file injection which cannot be performed.');
});

When(/^I enter the reactivation key of "([^"]*)"$/, async function (host) {
    const systemName = Helpers.getSystemName(host);
    const nodeId = await Helpers.apiTest.system.retrieveServerId(systemName);
    const reactKey = await Helpers.apiTest.system.obtainReactivationKey(nodeId);
    await (this as any).runStep(`I enter "${reactKey}" as "reactivationKey"`);
});