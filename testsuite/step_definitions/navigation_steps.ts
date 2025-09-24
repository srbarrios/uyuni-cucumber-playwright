import { Given, When, Then } from '@cucumber/cucumber';
// Central helpers (browser, page, utilities)
import * as Helpers from '../helpers';
import { getBrowserInstances } from '../helpers/core/env';
import { checkTextAndCatchRequestTimeoutPopup, refreshPage, getSystemName } from '../helpers/core/commonlib';
import { getAppHost } from '../helpers/core/env';

Then(/^I should see a "(.*)" text in the content area$/, async function (text) {
    const { page } = getBrowserInstances();
    const contentArea = page.locator('section');
    if (!(await checkTextAndCatchRequestTimeoutPopup(contentArea, text))) {
        throw new Error(`Text '${text}' not found in the content area`);
    }
});

Then(/^I should not see a "(.*)" text in the content area$/, async function (text) {
    const { page } = getBrowserInstances();
    const contentArea = page.locator('section');
    const hasText = await contentArea.locator(`text=${text}`).isVisible().catch(() => false);
    if (hasText) {
        throw new Error(`Text '${text}' found in the content area`);
    }
});

When(/^I click on "([^"]+)" in row "([^"]+)"$/, async function (link, item) {
    const { page } = getBrowserInstances();
    const rowLocator = page.locator(`xpath=//tr[td[contains(.,'${item}')]]`);
    await Helpers.clickLinkOrButtonAndWait(rowLocator, link);
});

When(/^I click on "([^"]+)" in tree item "(.*?)"$/, async function (button, item) {
    const { page } = getBrowserInstances();
    const itemLocator = page.locator(`xpath=//span[contains(text(), '${item}')]/ancestor::div[contains(@class, 'product-details-wrapper')]`);
    await Helpers.clickLinkOrButtonAndWait(itemLocator, button);
});

Then(/^the current path is "([^"]*)"$/, async function (path) {
    const { page } = getBrowserInstances();
    if (page.url() !== `${getAppHost()}${path}`) {
        throw new Error(`Path ${page.url()} different than ${path}`);
    }
});

When(/^I wait until I see "([^"]*)" text$/, async function (text) {
    const { page } = getBrowserInstances();
    if (!(await checkTextAndCatchRequestTimeoutPopup(page, text, { timeoutMs: Helpers.timeouts.default * 1000 }))) {
        throw new Error(`Text '${text}' not found`);
    }
});

When(/^I wait until I do not see "([^"]*)" text$/, async function (text) {
    const { page } = getBrowserInstances();
    const textLocator = page.getByText(text, { exact: false });
    await textLocator.waitFor({ state: 'hidden', timeout: Helpers.timeouts.default * 1000 });
});

When(/^I wait at most (\d+) seconds until I see "([^"]*)" text$/, async function (seconds, text) {
    const { page } = getBrowserInstances();
    if (!(await checkTextAndCatchRequestTimeoutPopup(page, text, { timeoutMs: Number(seconds) * 1000 }))) {
        throw new Error(`Text '${text}' not found`);
    }
});

When(/^I wait until I see "([^"]*)" text or "([^"]*)" text$/, async function (text1, text2) {
    const { page } = getBrowserInstances();
    if (!(await checkTextAndCatchRequestTimeoutPopup(page, text1, { text2, timeoutMs: Helpers.timeouts.default * 1000 }))) {
        throw new Error(`Text '${text1}' or '${text2}' not found`);
    }
});

When(/^I wait until I see "([^"]*)" (text|regex), refreshing the page$/, async function (text, type) {
    const { page } = getBrowserInstances();
    const pattern = type === 'regex' ? new RegExp(text) : text;
    if (await page.getByText(pattern).isVisible({ timeout: 3000 })) return;
    await Helpers.repeatUntilTimeout(async () => {
        if (await page.getByText(pattern).isVisible({ timeout: 3000 })) return true;
        await refreshPage(page);
        return false;
    }, `Couldn't find text '${text}'`);
});

When(/^I wait at most (\d+) seconds until I do not see "([^"]*)" text, refreshing the page$/, async function (seconds, text) {
    const { page } = getBrowserInstances();
    if (!await page.getByText(text).isVisible({ timeout: 3000 })) return;
    await Helpers.repeatUntilTimeout(async () => {
        if (!await page.getByText(text).isVisible({ timeout: 3000 })) return true;
        await refreshPage(page);
        return false;
    }, `I still see text '${text}'`, { timeout: Number(seconds) });
});

When(/^I wait at most "([^"]*)" seconds until I do not see "([^"]*)" text$/, async function (seconds, text) {
    const { page } = getBrowserInstances();
    await page.getByText(text).waitFor({ state: 'hidden', timeout: Number(seconds) * 1000 });
});

When(/^I wait at most (\d+) seconds until the event is completed, refreshing the page$/, async function (timeout) {
    const { page } = getBrowserInstances();
    await Helpers.repeatUntilTimeout(async () => {
        if (await page.getByText("This action's status is: Completed.", { exact: false }).isVisible({ timeout: 3000 })) return true;
        if (await page.getByText("This action's status is: Failed.", { exact: false }).isVisible({ timeout: 3000 })) {
            throw new Error('Event failed');
        }
        await refreshPage(page);
        return false;
    }, 'Event not yet completed', { timeout: Number(timeout) });
});

When(/^I wait until I see the name of "([^"]*)", refreshing the page$/, async function (host) {
    const { page } = getBrowserInstances();
    const systemName = await getSystemName(host);
    await Helpers.repeatUntilTimeout(async () => {
        if (await page.getByText(systemName).isVisible({ timeout: 3000 })) return true;
        await refreshPage(page);
        return false;
    }, `Couldn't find the system name of "${host}"`);
});

When(/^I wait until I see the "([^"]*)" system, refreshing the page$/, async function (systemName) {
    await (this as any).runStep('I wait until I do not see "Loading..." text');
    await (this as any).runStep(`I wait until I see "${systemName}" text, refreshing the page`);
});

When(/^I wait until I do not see "([^"]*)" text, refreshing the page$/, async function (text) {
    const { page } = getBrowserInstances();
    await Helpers.repeatUntilTimeout(async () => {
        if (!await page.getByText(text).isVisible({ timeout: 3000 })) return true;
        await refreshPage(page);
        return false;
    }, `Text '${text}' is still visible`);
});

When(/^I wait until I do not see the name of "([^"]*)", refreshing the page$/, async function (host) {
    const systemName = await getSystemName(host);
    await (this as any).runStep(`I wait until I do not see "${systemName}" text, refreshing the page`);
});

Then(/^I wait until I see the (VNC|spice) graphical console$/, async function (type) {
    const { page } = getBrowserInstances();
    await Helpers.repeatUntilTimeout(async () => {
        if (await page.locator('canvas').count() > 0) return true;
        if (await page.getByRole('dialog', { name: 'Failed to connect' }).isVisible()) {
            await refreshPage(page);
        }
        return false;
    }, `The ${type} graphical console didn't load`);
});

When(/^I switch to last opened window$/, async function () {
    const { context } = getBrowserInstances();
    const pages = context.pages();
    await pages[pages.length - 1].bringToFront();
});

When(/^I close the last opened window$/, async function () {
    const { context } = getBrowserInstances();
    const pages = context.pages();
    if (pages.length > 1) {
        await pages[pages.length - 1].close();
        await pages[pages.length - 2].bringToFront();
    }
});

When(/^I check "([^"]*)"$/, async function (identifier) {
    const { page } = getBrowserInstances();
    const checkbox = page.locator(`input#${identifier}`);
    await checkbox.check();
    if (!await checkbox.isChecked()) {
        throw new Error(`Checkbox ${identifier} not checked.`);
    }
});

When(/^I uncheck "([^"]*)"$/, async function (identifier) {
    const { page } = getBrowserInstances();
    const checkbox = page.locator(`input#${identifier}`);
    await checkbox.uncheck();
    if (await checkbox.isChecked()) {
        throw new Error(`Checkbox ${identifier} not unchecked.`);
    }
});

When(/^I (check|uncheck) "([^"]*)" by label$/, async function (action, label) {
    const { page } = getBrowserInstances();
    const checkbox = page.locator(`label:has-text("${label}")`).locator('..').locator('input[type="checkbox"]');
    if (action === 'check') {
        await checkbox.check();
        if (!await checkbox.isChecked()) {
            throw new Error(`Checkbox ${label} not checked.`);
        }
    } else {
        await checkbox.uncheck();
        if (await checkbox.isChecked()) {
            throw new Error(`Checkbox ${label} not unchecked.`);
        }
    }
});

When(/^I select "([^"]*)" from "([^"]*)"$/, async function (option, field) {
    const { page } = getBrowserInstances();
    try {
        await page.locator(`select#${field}`).selectOption(option);
    } catch (e) {
        await page.locator(`div[data-testid="${field}-child__control"]`).click();
        await page.locator(`div[data-testid="${field}-child__option"]`).filter({ hasText: option }).first().click();
    }
});

When(/^I select the parent channel for the "([^"]*)" from "([^"]*)"$/, async function (client, from) {
    const clientName = client === 'proxy' && !Helpers.isTransactionalServer ? 'proxy_nontransactional' : client;
    const channel = Helpers.BASE_CHANNEL_BY_CLIENT[Helpers.product][clientName];
    await (this as any).runStep(`I select "${channel}" from "${from}"`);
});

When(/^I select "([^"]*)" from drop-down in table line with "([^"]*)"$/, async function (value, line) {
    const { page } = getBrowserInstances();
    const select = page.locator(`xpath=.//div[@class='table-responsive']/table/tbody/tr[contains(td/a,'${line}')]//select`);
    await select.selectOption(value);
});

When(/^I choose radio button "([^"]*)" for child channel "([^"]*)"$/, async function (radio, channel) {
    const { page } = getBrowserInstances();
    const label = page.locator(`label:has-text("${radio}")`);
    const radioId = await label.getAttribute('for');
    const channelLocator = page.locator(`//dt[contains(.//div, '${channel}')]//input[@id='${radioId}']`);
    await channelLocator.check();
});

When(/^I wait for child channels to appear$/, async function () {
    await (this as any).runStep('I wait until I do not see "Loading..." text');
    await (this as any).runStep('I wait until I do not see "Loading child channels.." text');
    await (this as any).runStep('I wait until I do not see "Loading dependencies.." text');
});

When(/^I (include|exclude) the recommended child channels$/, async function (action) {
    const { page } = getBrowserInstances();
    const toggle = page.locator('span.pointer');
    await page.getByText('include recommended').waitFor({ timeout: 10000 });
    if (action === 'include') {
        const toggleOff = page.locator('i.fa-toggle-off');
        if (await toggleOff.isVisible()) {
            await toggle.click();
        }
    } else {
        const toggleOn = page.locator('i.fa-toggle-on');
        if (await toggleOn.isVisible()) {
            await toggle.click();
        }
    }
});

When(/^I choose "([^"]*)"$/, async function (value) {
    const { page } = getBrowserInstances();
    await page.locator(`input[type="radio"][value="${value}"]`).check();
});

When(/^I enter "([^"]*)" as "([^"]*)"$/, async function (text, field) {
    const { page } = getBrowserInstances();
    await page.locator(`input#${field}`).fill(text);
});

When(/^I enter "([^"]*)" in the placeholder "([^"]*)"$/, async function (text, placeholder) {
    const { page } = getBrowserInstances();
    await page.locator(`input[placeholder="${placeholder}"]`).fill(text);
});

When(/^I enter (\d+) minutes from now as "([^"]*)"$/, async function (minutesToAdd, field) {
    const { page } = getBrowserInstances();
    const futureTime = Helpers.getFutureTime(Number(minutesToAdd));
    await page.locator(`input#${field}`).fill(futureTime);
});

When(/^I enter "([^"]*)" as "([^"]*)" text area$/, async function (text, field) {
    const { page } = getBrowserInstances();
    await page.locator(`textarea[name="${field}"]`).fill(text);
});

When(/^I enter "(.*?)" as "(.*?)" in the content area$/, async function (text, field) {
    const { page } = getBrowserInstances();
    const contentArea = page.locator('section');
    await contentArea.locator(`input[name="${field}"]`).fill(text);
});

When(/^I enter the URI of the registry as "([^"]*)"$/, async function (field) {
    const { page } = getBrowserInstances();
    await page.locator(`input#${field}`).fill(Helpers.globalVars.noAuthRegistry);
});

When(/^I enter "([^"]*)" on the search field$/, async function (searchText) {
    await (this as any).runStep(`I enter "${searchText}" as "search_string"`);
});

When(/^I go back$/, async function () {
    const { page } = getBrowserInstances();
    await page.goBack();
});

When(/^I click on "([^"]*)"$/, async function (text) {
    const { page } = getBrowserInstances();
    await Helpers.clickButtonAndWait(page, text);
});

When(/^I click on a button within the item containing "([^"]*)"$/, async function (textInItem) {
    const { page } = getBrowserInstances();
    await page.locator(`li:has-text("${textInItem}") button`).click();
});

When(/^I click on "([^"]*)" in element "([^"]*)"$/, async function (text, elementId) {
    const { page } = getBrowserInstances();
    const element = page.locator(`div#${elementId}, div.${elementId}`);
    await Helpers.clickButtonAndWait(element, text);
});

When(/^I click on "([^"]*)" and confirm$/, async function (text) {
    const { page } = getBrowserInstances();
    page.on('dialog', async dialog => {
        await dialog.accept();
    });
    await (this as any).runStep(`I click on "${text}"`);
});

When(/^I click on "([^"]*)" and confirm alert box$/, async function (text) {
    const { page } = getBrowserInstances();
    page.on('dialog', async dialog => {
        await dialog.accept();
    });
    await page.getByRole('button', { name: text }).click();
});

When(/^I follow "([^"]*)"$/, async function (text) {
    const { page } = getBrowserInstances();
    await Helpers.clickLinkAndWait(page, text);
});

When(/^I follow first "([^"]*)"$/, async function (text) {
    const { page } = getBrowserInstances();
    await Helpers.clickLinkAndWait(page, text);
});

When(/^I follow "([^"]*)" in the (.+)$/, async function (text, context) {
    const { page } = getBrowserInstances();
    let selector = '';
    switch (context) {
        case 'tab bar':
        case 'tabs':
            selector = 'header';
            break;
        case 'content area':
            selector = 'section';
            break;
        default:
            throw new Error(`Unknown element with description: ${context}`);
    }
    const contextLocator = page.locator(selector);
    await Helpers.clickLinkAndWait(contextLocator, text);
});

When(/^I follow first "([^"]*)" in the (.+)$/, async function (text, context) {
    const { page } = getBrowserInstances();
    let selector = '';
    switch (context) {
        case 'tab bar':
        case 'tabs':
            selector = 'header';
            break;
        case 'content area':
            selector = 'section';
            break;
        default:
            throw new Error(`Unknown element with description: ${context}`);
    }
    const contextLocator = page.locator(selector);
    await Helpers.clickLinkAndWait(contextLocator, text);
});

When(/^I follow "([^"]*)" on "(.*?)" row$/, async function (text, host) {
    const { page } = getBrowserInstances();
    const systemName = await getSystemName(host);
    const rowLocator = page.locator(`xpath=//tr[td[contains(.,'${systemName}')]]`);
    await rowLocator.locator(`a:has-text("${text}")`).click();
});

When(/^I enter "(.*?)" in the editor$/, async function (text) {
    const { page } = getBrowserInstances();
    await page.locator('.ace_editor').click();
    await page.keyboard.insertText(text);
});

When(/^I follow the left menu "([^"]*)"$/, async function (menuPath) {
    const { page } = getBrowserInstances();
    const menuLevels = menuPath.split('>').map(s => s.trim());
    let currentLocator = page.locator('aside #nav nav');
    for (const menuLevel of menuLevels) {
        const linkLocator = currentLocator.locator(`ul > li > div > a:has-text("${menuLevel}")`);
        await linkLocator.click();
        currentLocator = linkLocator.locator('..').locator('..');
    }
});

Given(/^I am not authorized$/, async function () {
    const { page } = getBrowserInstances();
    try {
        const logoutLink = page.locator('xpath=//a[@href=\'/rhn/Logout.do\']');
        if (await logoutLink.count() > 0) {
            await logoutLink.click();
        }
    } catch (e) {
        console.log('The browser session could not be cleaned.');
    }
    await page.goto(getAppHost());
    const signInButton = page.getByRole('button', { name: 'Sign In' });
    if (!await signInButton.isVisible()) {
        throw new Error("Button 'Sign In' not visible");
    }
});

When(/^I go to the home page$/, async function () {
    const { page } = getBrowserInstances();
    await page.goto(getAppHost());
});

Given(/^I access the host the first time$/, async function () {
    const { page } = getBrowserInstances();
    await page.goto(getAppHost());
    const textLocator = page.getByText(`Create ${Helpers.product} Administrator`);
    if (!await textLocator.isVisible()) {
        throw new Error(`Text 'Create ${Helpers.product} Administrator' not found`);
    }
});

Given(/^I am authorized for the "([^"]*)" section$/i, async function (section) {
    switch (section) {
        case 'Admin':
            await (this as any).runStep('I am authorized as "admin" with password "admin"');
            break;
        case 'Images':
            await (this as any).runStep('I am authorized as "kiwikiwi" with password "kiwiwi"');
            break;
        case 'Docker':
            await (this as any).runStep('I am authorized as "docker" with password "docker"');
            break;
        default:
            throw new Error(`Section ${section} not supported`);
    }
});

Given(/^I am on the Systems overview page of this "([^"]*)"$/, async function (host) {
    const { page } = getBrowserInstances();
    const node = await Helpers.getTarget(host);
    const systemId = await Helpers.getSystemId(node);
    const overviewPage = `/rhn/systems/details/Overview.do?sid=${systemId}`;
    await page.goto(`${getAppHost()}${overviewPage}`);
});

Given(/^I navigate to the Systems overview page of this "([^"]*)"$/, async function (host) {
    const systemName = await getSystemName(host);
    await (this as any).runStep('Given I am on the Systems page');
    await (this as any).runStep(`When I enter "${systemName}" as "criteria"`);
    await (this as any).runStep('And I wait until I do not see "Loading..." text');
    await (this as any).runStep(`And I follow "${systemName}"`);
    await (this as any).runStep('And I wait until I see "System Status" text');
});

Given(/^I am on the "([^"]*)" page of this "([^"]*)"$/, async function (pageName, host) {
    await (this as any).runStep(`Given I am on the Systems overview page of this "${host}"`);
    await (this as any).runStep(`And I follow "${pageName}" in the content area`);
});

When(/^I enter the hostname of "([^"]*)" as "([^"]*)"$/, async function (host, field) {
    const { page } = getBrowserInstances();
    const systemName = await getSystemName(host);
    await page.locator(`input[name="${field}"]`).fill(systemName);
});

When(/^I select the hostname of "([^"]*)" from "([^"]*)"( if present)?$/, async function (host, field, ifPresent) {
    try {
        const systemName = await getSystemName(host);
        await (this as any).runStep(`I select "${systemName}" from "${field}"`);
    } catch (e) {
        if (!ifPresent) {
            throw e;
        }
    }
});

When(/^I follow this "([^"]*)" link$/, async function (host) {
    const systemName = await getSystemName(host);
    await (this as any).runStep(`I follow "${systemName}"`);
});

When(/^I check the "([^"]*)" client$/, async function (host) {
    const systemName = await getSystemName(host);
    await Helpers.toggleCheckboxInList('check', systemName);
});

Then(/^table row for "([^"]*)" should contain "([^"]*)"$/, async function (rowText, content) {
    await (this as any).runStep(`I wait until table row for "${rowText}" contains "${content}"`);
});

Then(/^I wait until table row for "([^"]*)" contains "([^"]*)"$/, async function (rowText, content) {
    const { page } = getBrowserInstances();
    const rowLocator = page.locator(`xpath=//div[@class=\"table-responsive\"]/table/tbody/tr[.//td[contains(.,'${rowText}')]]`);
    if (!await checkTextAndCatchRequestTimeoutPopup(rowLocator, content, { timeoutMs: Helpers.timeouts.default * 1000 })) {
        throw new Error(`xpath: ${rowLocator} has no content ${content}`);
    }
});

Then(/^the table row for "([^"]*)" should( not)? contain "([^"]*)" icon$/, async function (row, shouldNot, icon) {
    const { page } = getBrowserInstances();
    let contentSelector = '';
    switch (icon) {
        case 'retracted':
            contentSelector = 'i[class*=\'errata-retracted\']';
            break;
        default:
            throw new Error(`Unsupported icon '${icon}' in the step definition`);
    }
    const rowLocator = page.locator(`xpath=//div[@class=\"table-responsive\"]/table/tbody/tr[.//*[contains(.,'${row}')]]`);
    const iconLocator = rowLocator.locator(contentSelector);
    if (shouldNot) {
        if (await iconLocator.count() > 0) {
            throw new Error(`xpath: ${rowLocator} has icon ${icon}`);
        }
    } else {
        if (await iconLocator.count() === 0) {
            throw new Error(`xpath: ${rowLocator} has no icon ${icon}`);
        }
    }
});

When(/^I wait at most ([0-9]+) seconds until table row for "([^"]*)" contains button "([^"]*)"$/, async function (timeout, text, button) {
    const { page } = getBrowserInstances();
    const buttonLocator = page.locator(`xpath=//tr[td[contains(., '${text}')]]/td/descendant::*[self::a or self::button][@title='${button}']`);
    await buttonLocator.waitFor({ state: 'visible', timeout: Number(timeout) * 1000 });
});

When(/^I wait until table row for "([^"]*)" contains button "([^"]*)"$/, async function (text, button) {
    await (this as any).runStep(`I wait at most ${Helpers.timeouts.default} seconds until table row for "${text}" contains button "${button}"`);
});

When(/^I wait until table row contains a "([^"]*)" text$/, async function (text) {
    const { page } = getBrowserInstances();
    const rowLocator = page.locator(`xpath=//div[@class="table-responsive"]/table/tbody/tr[.//td[contains(.,'${text}')]]`);
    await rowLocator.waitFor({ state: 'visible', timeout: Helpers.timeouts.default * 1000 });
});

When(/^I wait until button "([^"]*)" becomes enabled$/, async function (text) {
    const { page } = getBrowserInstances();
    const buttonLocator = page.getByRole('button', { name: text, exact: false });
    await buttonLocator.waitFor({ state: 'enabled', timeout: Helpers.timeouts.default * 1000 });
});

Given(/^I am authorized as "([^"]*)" with password "([^"]*)"$/, async function (user, password) {
    const { page } = getBrowserInstances();
    Helpers.setContext('user', user);
    Helpers.setContext('password', password);
    try {
        await page.goto(getAppHost());
    } catch (e) {
        console.log(`The browser session could not be cleaned because there is no browser available: ${e.message}`);
    }
    const logoutLink = page.locator('a[href=\'/rhn/Logout.do\']');
    if (await logoutLink.isVisible({ timeout: 1000 })) {
        await logoutLink.click();
    }
    await page.goto(getAppHost());
    await page.locator('#username').fill(user);
    await page.locator('#password').fill(password);
    await page.getByRole('button', { name: 'Sign In' }).click();
    await (this as any).runStep('I should be logged in');
});

Given(/^I am authorized$/, async function () {
    const user = Helpers.getContext('user') || 'admin';
    const password = Helpers.getContext('password') || 'admin';
    await (this as any).runStep(`I am authorized as "${user}" with password "${password}"`);
});

When(/^I sign out$/, async function () {
    const { page } = getBrowserInstances();
    await page.locator('a[href=\'/rhn/Logout.do\']').click();
});

Then(/^I should not be authorized$/, async function () {
    const { page } = getBrowserInstances();
    const logoutLink = page.locator('a[href=\'/rhn/Logout.do\']');
    if (await logoutLink.count() > 0) {
        throw new Error('User is authorized');
    }
});

Then(/^I should be logged in$/, async function () {
    const { page } = getBrowserInstances();
    const logoutLink = page.locator('a[href=\'/rhn/Logout.do\']');
    await logoutLink.waitFor({ state: 'visible', timeout: Helpers.timeouts.default * 3000 });
});

Then(/^I am logged in$/, async function () {
    const { page } = getBrowserInstances();
    const logoutLink = page.locator('a[href=\'/rhn/Logout.do\']');
    if (!await logoutLink.isVisible()) {
        throw new Error('User is not logged in');
    }
});

Then(/^I should see an update in the list$/, async function () {
    const { page } = getBrowserInstances();
    const updateLocator = page.locator('xpath=//div[@class="table-responsive"]/table/tbody/tr/td/a');
    if (await updateLocator.count() === 0) {
        throw new Error('Update not found in the list');
    }
});

When(/^I check test channel$/, async function () {
    await Helpers.toggleCheckboxInList('check', 'Fake-Base-Channel-SUSE-like');
});

When(/^I check "([^"]*)" patch$/, async function (patch) {
    await Helpers.toggleCheckboxInList('check', patch);
});

Then(/^I should see "([^"]*)" systems selected for SSM$/, async function (count) {
    const { page } = getBrowserInstances();
    const counterLocator = page.locator('#spacewalk-set-system_list-counter');
    if (!await checkTextAndCatchRequestTimeoutPopup(counterLocator, count)) {
        throw new Error(`There are not ${count} systems selected`);
    }
});

Then(/^I should see a "([^"]*)" text$/, async function (text) {
    const { page } = getBrowserInstances();
    if (!await checkTextAndCatchRequestTimeoutPopup(page, text)) {
        throw new Error(`Text '${text}' not found`);
    }
});

Then(/^I should see a "([^"]*)" text or "([^"]*)" text$/, async function (text1, text2) {
    const { page } = getBrowserInstances();
    if (!await checkTextAndCatchRequestTimeoutPopup(page, text1, { text2 })) {
        throw new Error(`Text '${text1}' and '${text2}' not found`);
    }
});

Then(/^I should see "([^"]*)" short hostname$/, async function (host) {
    const { page } = getBrowserInstances();
    const systemName = await getSystemName(host);
    const shortName = systemName.split('.')[0];
    if (!await checkTextAndCatchRequestTimeoutPopup(page, shortName)) {
        throw new Error(`Hostname ${shortName} is not present`);
    }
});

Then(/^I should see "([^"]*)" hostname$/, async function (host) {
    const { page } = getBrowserInstances();
    const systemName = await getSystemName(host);
    if (!await checkTextAndCatchRequestTimeoutPopup(page, systemName)) {
        throw new Error(`Hostname ${systemName} is not present`);
    }
});

Then(/^I should not see "([^"]*)" hostname$/, async function (host) {
    const { page } = getBrowserInstances();
    const systemName = await getSystemName(host);
    const hasText = await page.getByText(systemName).isVisible();
    if (hasText) {
        throw new Error(`Hostname ${systemName} is present`);
    }
});

Then(/^I should see "([^"]*)" in the textarea$/, async function (text) {
    const { page } = getBrowserInstances();
    const textarea = page.locator('textarea').first();
    if (!(await checkTextAndCatchRequestTimeoutPopup(textarea, text))) {
        throw new Error(`Text '${text}' not found in the textarea`);
    }
});

Then(/^I should see "([^"]*)" or "([^"]*)" in the textarea$/, async function (text1, text2) {
    const { page } = getBrowserInstances();
    const textarea = page.locator('textarea').first();
    if (!(await checkTextAndCatchRequestTimeoutPopup(textarea, text1, { text2 }))) {
        throw new Error(`Text '${text1}' and '${text2}' not found in the textarea`);
    }
});

Then(/^I should see "([^"]*)" in the ([^ ]+) textarea$/, async function (text, id) {
    const { page } = getBrowserInstances();
    const textarea = page.locator(`textarea[data-testid="${id}"]`).first();
    if (!(await checkTextAndCatchRequestTimeoutPopup(textarea, text))) {
        throw new Error(`Text '${text}' not found in the ${id} textarea`);
    }
});

Then(/^I should see "([^"]*)" or "([^"]*)" in the ([^ ]+) textarea$/, async function (text1, text2, id) {
    const { page } = getBrowserInstances();
    const textarea = page.locator(`textarea[data-testid="${id}"]`).first();
    if (!(await checkTextAndCatchRequestTimeoutPopup(textarea, text1, { text2 }))) {
        throw new Error(`Text '${text1}' and '${text2}' not found in the ${id} textarea`);
    }
});
