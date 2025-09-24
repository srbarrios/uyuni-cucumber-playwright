import { Given, When, Then } from '@cucumber/cucumber';
// Central helpers (browser, page, utilities)
import * as Helpers from '../helpers';
import { getBrowserInstances } from '../helpers/core/env';
import { getSccCredentials } from '../helpers/system/remote_nodes_env';

Then(/^HTTP proxy verification should have succeeded$/, async function (...args: any[]) {
    const { page } = getBrowserInstances();
    const alert = page.locator('div.alert-success').first();
    await alert.waitFor({ state: 'visible', timeout: Helpers.DEFAULT_TIMEOUT * 1000 });
});

When(/^I enter the address of the HTTP proxy as "([^"]*)"$/, async function (hostnameField: string) {
    const { page } = getBrowserInstances();
    if (!page) throw new Error('No page instance');
    const value = Helpers.globalVars.serverHttpProxy || '';
    const byLabel = page.getByLabel(hostnameField);
    if (await byLabel.isVisible().catch(() => false)) {
        await byLabel.fill(value);
    } else {
        const input = page.locator(`#${hostnameField}, [name="${hostnameField}"]`).first();
        await input.fill(value);
    }
});

When(/^I ask to add new credentials$/, async function () {
    const { page } = getBrowserInstances();
    if (!page) throw new Error('No page instance');
    const plus = page.locator('i.fa-plus-circle').first();
    if (!(await plus.count())) throw new Error('Plus icon not found');
    await plus.click();
});

When(/^I enter the SCC credentials$/, async function () {
    const { page } = getBrowserInstances();
    if (!page) throw new Error('No page instance');
    const creds = getSccCredentials();
    if (!creds?.isValid) throw new Error('SCC_CREDENTIALS not set or invalid');
    // As in Ruby: enter into edit-user and edit-password
    const userField = page.locator('#edit-user, [name="edit-user"]').first();
    const passField = page.locator('#edit-password, [name="edit-password"]').first();
    await userField.fill(creds.username);
    await passField.fill(creds.password);
});

When(/^I wait until the SCC credentials are valid$/, async function () {
    const { page } = getBrowserInstances();
    if (!page) throw new Error('No page instance');
    const creds = getSccCredentials();
    if (!creds?.username) throw new Error('Missing SCC username to validate');
    const panelXpath = `//h3[contains(text(), '${creds.username}')]/../..`;
    const successIcon = page.locator(`xpath=${panelXpath}//i[contains(@class,'text-success')]`).first();
    await successIcon.waitFor({ timeout: 30000 });
});

Then(/^the credentials for "([^"]*)" should be invalid$/, async function (user) {
    const { page } = getBrowserInstances();
    const userPanel = page.locator(`xpath=//h3[contains(text(), '${user}')]/../..`);
    const failureIcon = userPanel.locator('i.text-danger').first();
    await failureIcon.waitFor({ state: 'visible', timeout: Helpers.DEFAULT_TIMEOUT * 1000 });
});

When(/^I make the credentials for "([^"]*)" primary$/, async function (user) {
    const { page } = getBrowserInstances();
    const userPanel = page.locator(`xpath=//h3[contains(text(), '${user}')]/../..`);
    const starIcon = userPanel.locator('i.fa-star-o').first();
    if (!await starIcon.isVisible()) throw new Error('Click on star icon failed');
    await starIcon.click();
});

Then(/^the credentials for "([^"]*)" should be primary$/, async function (user) {
    const { page } = getBrowserInstances();
    const userPanel = page.locator(`xpath=//h3[contains(text(), '${user}')]/../..`);
    const starIcon = userPanel.locator('i.fa-star').first();
    await starIcon.waitFor({ state: 'visible' });
});

When(/^I wait for the trash icon to appear for "([^"]*)"$/, async function (user) {
    const { page } = getBrowserInstances();
    const userPanel = page.locator(`xpath=//h3[contains(text(), '${user}')]/../..`);
    const trashIcon = userPanel.locator('i.fa-trash-o').first();
    await Helpers.repeatUntilTimeout(async () => {
        const style = await trashIcon.getAttribute('style');
        return !(style && style.includes('not-allowed'));
    }, 'Trash icon is still greyed out');
});

When(/^I ask to edit the credentials for "([^"]*)"$/, async function (user) {
    const { page } = getBrowserInstances();
    const userPanel = page.locator(`xpath=//h3[contains(text(), '${user}')]/../..`);
    const pencilIcon = userPanel.locator('i.fa-pencil').first();
    if (!await pencilIcon.isVisible()) throw new Error('Click on pencil icon failed');
    await pencilIcon.click();
});

When(/^I ask to delete the credentials for "([^"]*)"$/, async function (user) {
    const { page } = getBrowserInstances();
    const userPanel = page.locator(`xpath=//h3[contains(text(), '${user}')]/../..`);
    const trashIcon = userPanel.locator('i.fa-trash-o').first();
    if (!await trashIcon.isVisible()) throw new Error('Click on trash icon failed');
    await trashIcon.click();
});

When(/^I view the subscription list for "([^"]*)"$/, async function (user) {
    const { page } = getBrowserInstances();
    const userPanel = page.locator(`xpath=//h3[contains(text(), '${user}')]/../..`);
    const listIcon = userPanel.locator('i.fa-th-list').first();
    if (!await listIcon.isVisible()) throw new Error('Click on list icon failed');
    await listIcon.click();
});

When(/^I (deselect|select) "([^"]*)" as a product$/, async function (action, product) {
    const { page } = getBrowserInstances();
    const xpath = `//span[contains(text(), '${globalVars.globalProduct}')]/ancestor::div[contains(@class, 'product-details-wrapper')]/div/input[@type='checkbox']`;
    const checkbox = page.locator(`xpath=${xpath}`).first();
    if (action === 'select') {
        await checkbox.check();
    } else {
        await checkbox.uncheck();
    }
});

When(/^I select or deselect "([^"]*)" beta client tools$/, async function (channel) {
    const { page } = getBrowserInstances();
    const xpath = `//span[contains(text(), '${channel}')]/ancestor::div[contains(@class, 'product-details-wrapper')]/div/input[@type='checkbox']`;
    const checkbox = page.locator(`xpath=${xpath}`).first();
    if (await checkbox.isVisible()) {
        if (Helpers.betaEnabled) {
            await checkbox.check();
        } else {
            await checkbox.uncheck();
        }
    } else {
        console.warn(`${channel} beta client tools checkbox not found`);
    }
});

When(/^I wait at most (\d+) seconds until the tree item "([^"]+)" has no sub-list$/, async function (timeout, item) {
    const { page } = getBrowserInstances();
    await Helpers.repeatUntilTimeout(async () => {
        const xpath = `//span[contains(text(), '${item}')]/ancestor::div[contains(@class, 'product-details-wrapper')]/div/i[contains(@class, 'fa-angle-')]`;
        const sublistIcon = page.locator(`xpath=${xpath}`);
        return await sublistIcon.count() === 0;
    }, `could still find a sub list for tree item ${item}`, { timeout: Number(timeout) });
});

When(/^I wait at most (\d+) seconds until the tree item "([^"]+)" contains "([^"]+)" text$/, async function (timeout, item, text) {
    const { page } = getBrowserInstances();
    const itemPanel = page.locator(`xpath=//span[contains(text(), '${item}')]/ancestor::div[contains(@class, 'product-details-wrapper')]`);
    if (!await Helpers.checkTextAndCatchRequestTimeoutPopup(itemPanel, text, { timeoutMs: Number(timeout) * 1000 })) {
        throw new Error(`could not find text ${text} for tree item ${item}`);
    }
});

When(/^I wait at most (\d+) seconds until the tree item "([^"]+)" contains "([^"]+)" button$/, async function (timeout, item, button) {
    const { page } = getBrowserInstances();
    const xpathQuery = `//span[contains(text(), '${item}')]/ancestor::div[contains(@class, 'product-details-wrapper')]/descendant::*[@title='${button}']`;
    const buttonLocator = page.locator(`xpath=${xpathQuery}`);
    await buttonLocator.waitFor({ state: 'visible', timeout: Number(timeout) * 1000 });
});

When(/^I open the sub-list of the product "(.*?)"((?: if present)?)$/, async function (product, ifPresent) {
    const { page } = getBrowserInstances();
    const xpath = `//span[contains(text(), '${globalVars.globalProduct}')]/ancestor::div[contains(@class, 'product-details-wrapper')]/div/i[contains(@class, 'fa-angle-right')]`;
    const sublistIcon = page.locator(`xpath=${xpath}`).first();
    if (await sublistIcon.count() > 0) {
        await sublistIcon.click();
    } else if (ifPresent.trim() === '') {
        throw new Error(`xpath: ${xpath} not found`);
    }
});

When(/^I select the addon "(.*?)"$/, async function (addon) {
    const { page } = getBrowserInstances();
    const xpath = `//span[contains(text(), '${addon}')]/ancestor::div[contains(@class, 'product-details-wrapper')]/div/input[@type='checkbox']`;
    const checkbox = page.locator(`xpath=${xpath}`).first();
    await checkbox.check();
});

Then(/^I should see that the "(.*?)" product is "(.*?)"$/, async function (product, recommended) {
    const { page } = getBrowserInstances();
    const xpath = `//span[text()[normalize-space(.) = '${globalVars.globalProduct}'] and ./span/text() = '${recommended}']`;
    const element = page.locator(`xpath=${xpath}`);
    await element.waitFor({ state: 'visible' });
});

Then(/^I should see the "(.*?)" selected$/, async function (product) {
    const { page } = getBrowserInstances();
    const xpath = `//span[contains(text(), '${globalVars.globalProduct}')]/ancestor::div[contains(@class, 'product-details-wrapper')]`;
    const checkbox = page.locator(`xpath=${xpath}//input[@type='checkbox']`).first();
    if (!await checkbox.isChecked()) {
        throw new Error(`${await page.locator(`xpath=${xpath}`).getAttribute('data-identifier')} is not checked`);
    }
});

When(/^I wait until I see "(.*?)" product has been added$/, async function (product) {
    const { page } = getBrowserInstances();
    await Helpers.repeatUntilTimeout(async () => {
        const xpath = `//span[contains(text(), '${globalVars.globalProduct}')]/ancestor::div[contains(@class, 'product-details-wrapper')]`;
        const productElement = page.locator(`xpath=${xpath}`).first();
        const productClass = await productElement.getAttribute('class');
        return productClass?.includes('product-installed') === true;
    }, `Couldn't find the installed product ${globalVars.globalProduct} in the list`);
});

When(/^I click the Add Product button$/, async function () {
    const { page } = getBrowserInstances();
    const addButton = page.locator('button#addProducts').first();
    await addButton.click();
});

Then(/^the SLE15 (SP3|SP4|SP5) product should be added$/, async function (spVersion) {
    const server = await Helpers.getTarget('server');
    const { stdout } = await server.run('echo -e "admin\\nadmin\\n" | mgr-sync list channels', { checkErrors: false, bufferSize: 1000000 });
    const lowercaseVersion = spVersion.toLowerCase();
    const matches = [
        `[I] SLE-Product-SLES15-${spVersion}-Pool for x86_64 SUSE Linux Enterprise Server 15 ${spVersion} x86_64 [sle-product-sles15-${lowercaseVersion}-pool-x86_64]`,
        `[I] SLE-Module-Basesystem15-${spVersion}-Updates for x86_64 Basesystem Module 15 ${spVersion} x86_64 [sle-module-basesystem15-${lowercaseVersion}-updates-x86_64]`,
        `[I] SLE-Module-Server-Applications15-${spVersion}-Pool for x86_64 Server Applications Module 15 ${spVersion} x86_64 [sle-module-server-applications15-${lowercaseVersion}-pool-x86_64]`
    ];
    for (const match of matches) {
        if (!stdout.includes(match)) {
            throw new Error(`Not included:\n ${match}`);
        }
    }
});

When(/^I click the channel list of product "(.*?)"$/, async function (product) {
    const { page } = getBrowserInstances();
    const xpath = `//span[contains(text(), '${globalVars.globalProduct}')]/ancestor::div[contains(@class, 'product-details-wrapper')]/div/button[contains(@class, 'showChannels')]`;
    const button = page.locator(`xpath=${xpath}`).first();
    await button.click();
});

Then(/^I should see a table line with "([^"]*)", "([^"]*)", "([^"]*)"$/, async function (text1, text2, text3) {
    const { page } = getBrowserInstances();
    const rowLocator = page.locator(`xpath=//div[@class="table-responsive"]/table/tbody/tr[.//td[contains(.,'${text1}')]]`).first();
    if (!await rowLocator.locator(`a:has-text("${text2}")`).isVisible()) {
        throw new Error(`Link ${text2} not found`);
    }
    if (!await rowLocator.locator(`a:has-text("${text3}")`).isVisible()) {
        throw new Error(`Link ${text3} not found`);
    }
});

Then(/^I should see a table line with "([^"]*)", "([^"]*)"$/, async function (text1, text2) {
    const { page } = getBrowserInstances();
    const rowLocator = page.locator(`xpath=//div[@class="table-responsive"]/table/tbody/tr[.//td[contains(.,'${text1}')]]`).first();
    if (!await rowLocator.locator(`a:has-text("${text2}")`).isVisible()) {
        throw new Error(`Link ${text2} not found`);
    }
});

Then(/^a table line should contain system "([^"]*)", "([^"]*)"$/, async function (host, text) {
    const { page } = getBrowserInstances();
    const systemName = await Helpers.getSystemName(host);
    const rowLocator = page.locator(`xpath=//div[@class="table-responsive"]/table/tbody/tr[.//td[contains(.,'${systemName}')]]`).first();
    if (!await rowLocator.locator(`td:has-text("${text}")`).isVisible()) {
        throw new Error(`Text ${text} not found`);
    }
});

When(/^I wait at most (\d+) seconds until I see the name of "([^"]*)", refreshing the page$/, async function (seconds, host) {
    const { page } = getBrowserInstances();
    const systemName = await Helpers.getSystemName(host);
    await Helpers.repeatUntilTimeout(async () => {
        await (this as any).runStep('I wait until I do not see "Loading..." text');
        if (await page.getByText(systemName, { exact: false }).isVisible({ timeout: 3000 })) {
            return true;
        }
        await Helpers.refreshPage(page);
        return false;
    }, `I can't see the system '${systemName}'`, { timeout: Number(seconds) });
});

When(/^I wait at most (\d+) seconds until onboarding is completed for "([^"]*)"$/, async function (seconds, host) {
    const finalTimeout = Number(seconds);
    const stepTimeout = 180;
    await (this as any).runStep('When I follow the left menu "Systems > System List > All"');
    await (this as any).runStep(`And I wait until I see the name of "${host}", refreshing the page`);
    await (this as any).runStep(`And I follow this "${host}" link`);
    await (this as any).runStep('And I wait until I see "System Status" text');
    await (this as any).runStep(`And I wait ${stepTimeout} seconds until the event is picked up and ${finalTimeout} seconds until the event "Apply states" is completed`);
    await (this as any).runStep(`And I wait ${stepTimeout} seconds until the event is picked up and ${finalTimeout} seconds until the event "Hardware List Refresh" is completed`);
    await (this as any).runStep(`And I wait ${stepTimeout} seconds until the event is picked up and ${finalTimeout} seconds until the event "Package List Refresh" is completed`);
});

When(/^I wait until onboarding is completed for "([^"]*)"$/, async function (host) {
    await (this as any).runStep(`I wait at most ${Helpers.DEFAULT_TIMEOUT} seconds until onboarding is completed for "${host}"`);
});

Then(/^I should see "([^"]*)" via spacecmd$/, async function (host) {
    const server = await Helpers.getTarget('server');
    const command = 'spacecmd -u admin -p admin system_list';
    const systemName = await Helpers.getSystemName(host);
    await Helpers.repeatUntilTimeout(async () => {
        await server.run('spacecmd -u admin -p admin clear_caches');
        const { stdout } = await server.run(command, { checkErrors: false, verbose: true });
        return stdout.includes(systemName);
    }, `system ${systemName} is not in the list yet`);
});

Then(/^I should see "([^"]*)" as link$/, async function (host) {
    const systemName = await Helpers.getSystemName(host);
    await (this as any).runStep(`I should see a "${systemName}" link`);
});

When(/^I remember when I scheduled an action$/, async function () {
    Helpers.globalVars.moments = { schedule_action: new Date() };
});

Then(/^I should see "([^"]*)" at least (\d+) minutes after I scheduled an action$/, async function (text, minutes) {
    const { page } = getBrowserInstances();
    const elements = await page.locator('div', { hasText: text }).all();
    if (elements.length === 0) {
        throw new Error(`Text ${text} not found in the page`);
    }
    const elementText = await elements[0].textContent();
    const regex = new RegExp(`${text}\\s*(\\d+\/\\d+\/\\d+ \\d+:\\d+:\\d+ (AM|PM)+ [^\\s]+)`);
    const match = elementText?.match(regex);
    if (!match) {
        throw new Error(`No element found matching text '${text}'`);
    }
    const textTime = new Date(match[1]);
    if (!Helpers.globalVars.moments || !Helpers.globalVars.moments.schedule_action) {
        throw new Error('Time the action was scheduled not found in memory');
    }
    const initial = Helpers.globalVars.moments.schedule_action;
    const after = new Date(initial.getTime() + Number(minutes) * 60000);
    if (!(textTime.getTime() >= after.getTime())) {
        throw new Error(`${textTime} is not ${minutes} minutes later than '${initial}'`);
    }
});

Given(/^I have a valid token for organization "([^"]*)"$/, async function (org) {
    // This step relies on internal Ruby helpers that are not available.
    throw new Error('This step relies on an internal token helper which cannot be ported.');
});

Given(/^I have an invalid token for organization "([^"]*)"$/, async function (org) {
    // This step relies on internal Ruby helpers that are not available.
    throw new Error('This step relies on an internal token helper which cannot be ported.');
});

Given(/^I have an expired valid token for organization "([^"]*)"$/, async function (org) {
    // This step relies on internal Ruby helpers that are not available.
    throw new Error('This step relies on an internal token helper which cannot be ported.');
});

Given(/^I have a valid token expiring tomorrow for organization "([^"]*)"$/, async function (org) {
    // This step relies on internal Ruby helpers that are not available.
    throw new Error('This step relies on an internal token helper which cannot be ported.');
});

Given(/^I have a not yet usable valid token for organization "([^"]*)"$/, async function (org) {
    // This step relies on internal Ruby helpers that are not available.
    throw new Error('This step relies on an internal token helper which cannot be ported.');
});

Given(/^I have a valid token for organization "(.*?)" and channel "(.*?)"$/, async function (org, channel) {
    // This step relies on internal Ruby helpers that are not available.
    throw new Error('This step relies on an internal token helper which cannot be ported.');
});

Then(/^I should see the toggler "([^"]*)"$/, async function (targetStatus) {
    const { page } = getBrowserInstances();
    let xpath = '';
    switch (targetStatus) {
        case 'enabled':
            xpath = '//i[contains(@class, \'fa-toggle-on\')]';
            break;
        case 'disabled':
            xpath = '//i[contains(@class, \'fa-toggle-off\')]';
            break;
        default:
            throw new Error('Invalid target status.');
    }
    await page.locator(`xpath=${xpath}`).waitFor({ state: 'visible' });
});

When(/^I click on the "([^"]*)" toggler$/, async function (targetStatus) {
    const { page } = getBrowserInstances();
    let xpath = '';
    switch (targetStatus) {
        case 'enabled':
            xpath = '//i[contains(@class, \'fa-toggle-on\')]';
            break;
        case 'disabled':
            xpath = '//i[contains(@class, \'fa-toggle-off\')]';
            break;
        default:
            throw new Error('Invalid target status.');
    }
    await page.locator(`xpath=${xpath}`).click();
});

Then(/^I should see the child channel "([^"]*)" "([^"]*)"$/, async function (targetChannel, targetStatus) {
    const { page } = getBrowserInstances();
    await (this as any).runStep(`I should see a "${targetChannel}" text`);
    const label = page.locator(`label:has-text("${targetChannel}")`);
    const channelCheckboxId = await label.getAttribute('for');
    const checkbox = page.locator(`input#${channelCheckboxId}`);
    if (targetStatus === 'selected' && !await checkbox.isChecked()) {
        throw new Error(`${channelCheckboxId} is not selected`);
    }
    if (targetStatus === 'unselected' && await checkbox.isChecked()) {
        throw new Error(`${channelCheckboxId} is selected`);
    }
});

Then(/^I should see the child channel "([^"]*)" "([^"]*)" and "([^"]*)"$/, async function (targetChannel, targetStatus, isDisabled) {
    const { page } = getBrowserInstances();
    await (this as any).runStep(`I should see a "${targetChannel}" text`);
    const label = page.locator(`label:has-text("${targetChannel}")`);
    const channelCheckboxId = await label.getAttribute('for');
    const checkbox = page.locator(`input#${channelCheckboxId}`);
    if (isDisabled !== 'disabled') {
        throw new Error('Invalid disabled flag value');
    }
    if (targetStatus === 'selected' && !await checkbox.isChecked({ disabled: true })) {
        throw new Error(`${channelCheckboxId} is not selected`);
    }
    if (targetStatus === 'unselected' && await checkbox.isChecked({ disabled: true })) {
        throw new Error(`${channelCheckboxId} is selected`);
    }
});

When(/^I select the child channel "([^"]*)"$/, async function (targetChannel) {
    const { page } = getBrowserInstances();
    await (this as any).runStep(`I should see a "${targetChannel}" text`);
    const label = page.locator(`label:has-text("${targetChannel}")`);
    const channelCheckboxId = await label.getAttribute('for');
    const checkbox = page.locator(`input#${channelCheckboxId}`);
    if (await checkbox.isChecked()) {
        throw new Error(`Field ${channelCheckboxId} is checked`);
    }
    await checkbox.click();
});

Then(/^I should see "([^"]*)" "([^"]*)" for the "([^"]*)" channel$/, async function (targetRadio, targetStatus, targetChannel) {
    const { page } = getBrowserInstances();
    const link = page.locator(`a:has-text("${targetChannel}")`);
    const channelId = await link.getAttribute('href').then(href => href?.split('?')[1].split('=')[1]);
    let xpath = '';
    switch (targetRadio) {
        case 'No change':
            xpath = `//input[@type='radio' and @name='ch_action_${channelId}' and @value='NO_CHANGE']`;
            break;
        case 'Subscribe':
            xpath = `//input[@type='radio' and @name='ch_action_${channelId}' and @value='SUBSCRIBE']`;
            break;
        case 'Unsubscribe':
            xpath = `//input[@type='radio' and @name='ch_action_${channelId}' and @value='UNSUBSCRIBE']`;
            break;
        default:
            throw new Error(`Target Radio ${targetRadio} not supported`);
    }
    const radio = page.locator(`xpath=${xpath}`);
    if (targetStatus === 'selected' && !await radio.isChecked()) {
        throw new Error(`xpath: ${xpath} is not selected`);
    }
    if (targetStatus === 'unselected' && await radio.isChecked()) {
        throw new Error(`xpath: ${xpath} is selected`);
    }
});

Then(/^the notification badge and the table should count the same amount of messages$/, async function () {
    const { page } = getBrowserInstances();
    // This step relies on `count_table_items` which is not provided.
    throw new Error('This step requires `count_table_items` helper which is not provided.');
});

When(/^I wait until radio button "([^"]*)" is checked, refreshing the page$/, async function (arg1) {
    const { page } = getBrowserInstances();
    const radio = page.locator(`input[type="radio"][id="${arg1}"]`);
    await Helpers.repeatUntilTimeout(async () => {
        if (await radio.isChecked()) {
            return true;
        }
        await Helpers.refreshPage(page);
        return false;
    }, `Couldn't find checked radio button ${arg1}`);
});

When(/^I wait until "([^"]*)" has been checked$/, async function (text) {
    const { page } = getBrowserInstances();
    const checkbox = page.getByLabel(text);
    await Helpers.repeatUntilTimeout(async () => {
        return await checkbox.isChecked();
    }, `Couldn't find checked ${text}`, { timeout: 5 });
});

Then(/^I check the first notification message$/, async function () {
    const { page } = getBrowserInstances();
    // This step relies on `count_table_items` which is not provided.
    throw new Error('This step requires `count_table_items` helper which is not provided.');
});

When(/^I delete it via the "([^"]*)" button$/, async function (targetButton) {
    const { page } = getBrowserInstances();
    // This step relies on `count_table_items` which is not provided.
    throw new Error('This step requires `count_table_items` helper which is not provided.');
});

When(/^I mark as read it via the "([^"]*)" button$/, async function (targetButton) {
    const { page } = getBrowserInstances();
    // This step relies on `count_table_items` which is not provided.
    throw new Error('This step requires `count_table_items` helper which is not provided.');
});

When(/^I check for failed events on history event page$/, async function () {
    const { page } = getBrowserInstances();
    await (this as any).runStep('When I follow "Events" in the content area');
    await (this as any).runStep('And I follow "History" in the content area');
    await (this as any).runStep('Then I should see a "System History" text');
    const rows = await page.locator('xpath=//div[@class=\'table-responsive\']/table/tbody/tr').all();
    let failures = '';
    for (const row of rows) {
        if (await row.locator('i.fa.fa-times-circle-o.fa-1-5x.text-danger').count() > 0) {
            failures += `${await row.textContent()}\n`;
        }
    }
    if (failures) {
        throw new Error(`\nFailures in event history found:\n\n${failures}`);
    }
});

Then(/^I should see a list item with text "([^"]*)" and a (success|failing|warning|pending|refreshing) bullet$/, async function (text, bulletType) {
    const { page } = getBrowserInstances();
    const bulletStyles: Record<string, string> = {
        'success': 'fa-check-circle',
        'failing': 'fa-times-circle',
        'warning': 'fa-exclamation-triangle',
        'pending': 'fa-clock-o',
        'refreshing': 'fa-spinner'
    };
    const itemXpath = `//ul/li[text()='${text}']/i[contains(@class, '${bulletStyles[bulletType]}')]`;
    await page.locator(`xpath=${itemXpath}`).waitFor({ state: 'visible' });
});

When(/^I create the MU repositories for "([^"]*)"$/, async function (client) {
    // This step relies on internal Ruby helpers and global state that cannot be ported.
    throw new Error('This step relies on internal helpers which are not available.');
});

When(/^I select the MU repositories for "([^"]*)" from the list$/, async function (client) {
    // This step relies on internal Ruby helpers and global state that cannot be ported.
    throw new Error('This step relies on internal helpers which are not available.');
});

When(/^I prepare the development repositories of "([^"]*)" as part of "([^"]*)" channel$/, async function (host, channelLabel) {
    // This step relies on internal Ruby helpers and global state that cannot be ported.
    throw new Error('This step relies on internal helpers which are not available.');
});