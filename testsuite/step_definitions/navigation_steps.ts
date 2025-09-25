import {Given, Then, When, World} from '@cucumber/cucumber';

import {
    addContext,
    BASE_CHANNEL_BY_CLIENT,
    clickButtonAndWait,
    clickLinkAndWait,
    envConfig, getContext, getFutureTime, getSystemId,
    getTarget,
    globalVars, PACKAGE_BY_CLIENT, PKGARCH_BY_CLIENT, repeatUntilTimeout, timeouts
} from '../helpers/index.js';
import {getAppHost, getBrowserInstances, getSystemName, refreshPage} from '../helpers/index.js';
import {toggleCheckboxInList} from "../helpers/core/navigation_helper.js";
import {expect} from "@playwright/test";
import {
    waitUntilSeeSystemRefreshingPage,
    waitUntilDoNotSeeTextRefreshingPage,
    selectOptionFromField,
    waitUntilDoNotSeeLoadingTexts,
    enterTextAsField,
    clickOnTextAndConfirm,
    authorizeUser,
    shouldBeLoggedIn,
    navigateToSystemsOverviewPage,
    navigateToSystemsPageAndSearch,
    followLinkInContentArea,
    followSystemLink,
    waitUntilTableRowContainsButton,
    enterFilteredPackageName,
    shouldSeeText,
    enterValueAsProperty,
    clickUpdateProperties,
    shouldSeeSystemPropertiesChangedText
} from '../helpers/embedded_steps/navigation_helper.js';
import {
    navigateToSystemsPage,
    waitUntilDoNotSeeLoadingText
} from '../helpers/embedded_steps/common_helper.js';

Then(/^I should see a "(.*)" text in the content area$/, async function (text) {
    const {page} = getBrowserInstances();
    const contentArea = page.locator('section');
    await expect(contentArea.getByText(text)).toBeVisible();
});

Then(/^I should not see a "(.*)" text in the content area$/, async function (text) {
    const {page} = getBrowserInstances();
    const contentArea = page.locator('section');
    await expect(contentArea.getByText(text)).not.toBeVisible();
});

When(/^I click on "([^"]+)" in row "([^"]+)"$/, async function (link, item) {
    const {page} = getBrowserInstances();
    const rowLocator = page.getByRole('row', {name: item});
    await rowLocator.getByRole('link', {name: link}).click();
});

When(/^I click on "([^"]+)" in tree item "(.*?)"$/, async function (button, item) {
    const {page} = getBrowserInstances();
    const itemLocator = page.locator('.product-details-wrapper', {hasText: item});
    await itemLocator.getByRole('button', {name: button}).click();
});

Then(/^the current path is "([^"]*)"$/, async function (path) {
    const {page} = getBrowserInstances();
    if (page.url() !== `${getAppHost()}${path}`) {
        throw new Error(`Path ${page.url()} different than ${path}`);
    }
});

When(/^I wait until I see "([^"]*)" text$/, async function (text) {
    const {page} = getBrowserInstances();
    await expect(page.getByText(text)).toBeVisible();
});

When(/^I wait until I do not see "([^"]*)" text$/, async function (text) {
    const {page} = getBrowserInstances();
    await expect(page.getByText(text)).not.toBeVisible();
});

When(/^I wait at most (\d+) seconds until I see "([^"]*)" text$/, async function (seconds, text) {
    const {page} = getBrowserInstances();
    await expect(page.getByText(text)).toBeVisible({timeout: Number(seconds) * 1000});
});

When(/^I wait until I see "([^"]*)" text or "([^"]*)" text$/, async function (text1, text2) {
    const {page} = getBrowserInstances();
    const locator1 = page.getByText(text1);
    const locator2 = page.getByText(text2);
    await expect(locator1.or(locator2)).toBeVisible();
});

When(/^I wait until I see "([^"]*)" (text|regex), refreshing the page$/, async function (text, type) {
    const {page} = getBrowserInstances();
    const pattern = type === 'regex' ? new RegExp(text) : text;
    if (await page.getByText(pattern).isVisible({timeout: 3000})) return;
    await repeatUntilTimeout(async () => {
        if (await page.getByText(pattern).isVisible({timeout: 3000})) return true;
        await refreshPage(page);
        return false;
    }, {message: `Couldn't find text '${text}'`});
});

When(/^I wait at most (\d+) seconds until I do not see "([^"]*)" text, refreshing the page$/, async function (seconds, text) {
    const {page} = getBrowserInstances();
    if (!await page.getByText(text).isVisible({timeout: 3000})) return;
    await repeatUntilTimeout(async () => {
        if (!await page.getByText(text).isVisible({timeout: 3000})) return true;
        await refreshPage(page);
        return false;
    }, {message: `I still see text '${text}'`, timeout: Number(seconds)});
});

When(/^I wait at most "([^"]*)" seconds until I do not see "([^"]*)" text$/, async function (seconds, text) {
    const {page} = getBrowserInstances();
    await expect(page.getByText(text)).not.toBeVisible({timeout: Number(seconds) * 1000});
});

When(/^I wait at most (\d+) seconds until the event is completed, refreshing the page$/, async function (timeout) {
    const {page} = getBrowserInstances();
    await repeatUntilTimeout(async () => {
        if (await page.getByText("This action's status is: Completed.", {exact: false}).isVisible({timeout: 3000})) return true;
        if (await page.getByText("This action's status is: Failed.", {exact: false}).isVisible({timeout: 3000})) {
            throw new Error('Event failed');
        }
        await refreshPage(page);
        return false;
    }, {message: 'Event not yet completed', timeout: Number(timeout)});
});

When(/^I wait until I see the name of "([^"]*)", refreshing the page$/, async function (host) {
    const {page} = getBrowserInstances();
    const systemName = await getSystemName(host);
    await repeatUntilTimeout(async () => {
        if (await page.getByText(systemName).isVisible({timeout: 3000})) return true;
        await refreshPage(page);
        return false;
    }, {message: `Couldn't find the system name of "${host}"`});
});

When(/^I wait until I see the "([^"]*)" system, refreshing the page$/, async function (systemName) {
    await waitUntilDoNotSeeLoadingText();
    await waitUntilSeeSystemRefreshingPage(systemName);
});

When(/^I wait until I do not see "([^"]*)" text, refreshing the page$/, async function (text) {
    const {page} = getBrowserInstances();
    await repeatUntilTimeout(async () => {
        if (!await page.getByText(text).isVisible({timeout: 3000})) return true;
        await refreshPage(page);
        return false;
    }, {message: `Text '${text}' is still visible`});
});

When(/^I wait until I do not see the name of "([^"]*)", refreshing the page$/, async function (host) {
    const systemName = await getSystemName(host);
    await waitUntilDoNotSeeTextRefreshingPage(systemName);
});

Then(/^I wait until I see the (VNC|spice) graphical console$/, async function (type) {
    const {page} = getBrowserInstances();
    await repeatUntilTimeout(async () => {
        if (await page.locator('canvas').count() > 0) return true;
        if (await page.getByRole('dialog', {name: 'Failed to connect'}).isVisible()) {
            await refreshPage(page);
        }
        return false;
    }, {message: `The ${type} graphical console didn't load`});
});

When(/^I switch to last opened window$/, async function () {
    const {context} = getBrowserInstances();
    const pages = context.pages();
    await pages[pages.length - 1].bringToFront();
});

When(/^I close the last opened window$/, async function () {
    const {context} = getBrowserInstances();
    const pages = context.pages();
    if (pages.length > 1) {
        await pages[pages.length - 1].close();
        await pages[pages.length - 2].bringToFront();
    }
});

When(/^I check "([^"]*)"$/, async function (identifier) {
    const {page} = getBrowserInstances();
    const checkbox = page.locator(`#${identifier}`);
    await checkbox.check();
    await expect(checkbox).toBeChecked();
});

When(/^I uncheck "([^"]*)"$/, async function (identifier) {
    const {page} = getBrowserInstances();
    const checkbox = page.locator(`#${identifier}`);
    await checkbox.uncheck();
    await expect(checkbox).not.toBeChecked();
});

When(/^I (check|uncheck) "([^"]*)" by label$/, async function (action, label) {
    const {page} = getBrowserInstances();
    const checkbox = page.getByLabel(label);
    if (action === 'check') {
        await checkbox.check();
        await expect(checkbox).toBeChecked();
    } else {
        await checkbox.uncheck();
        await expect(checkbox).not.toBeChecked();
    }
});

When(/^I select "([^"]*)" from "([^"]*)"$/, async function (option, field) {
    const {page} = getBrowserInstances();
    try {
        await page.locator(`select[name="${field}"]`).selectOption(option);
    } catch (e) {
        await page.locator(`div[data-testid="${field}-child__control"]`).click();
        await page.locator(`div[data-testid="${field}-child__option"]`).filter({hasText: option}).first().click();
    }
});

When(/^I select the parent channel for the "([^"]*)" from "([^"]*)"$/, async function (client, from) {
    const clientName = client === 'proxy' && !envConfig.isTransactionalServer ? 'proxy_nontransactional' : client;
    const channel = BASE_CHANNEL_BY_CLIENT[globalVars.product][clientName];
    await selectOptionFromField(channel, from);
});

When(/^I select "([^"]*)" from drop-down in table line with "([^"]*)"$/, async function (value, line) {
    const {page} = getBrowserInstances();
    const rowLocator = page.getByRole('row', {name: line});
    await rowLocator.getByRole('combobox').selectOption(value);
});

When(/^I choose radio button "([^"]*)" for child channel "([^"]*)"$/, async function (radio, channel) {
    const {page} = getBrowserInstances();
    const channelLocator = page.locator('dt', {hasText: channel});
    await channelLocator.getByLabel(radio).check();
});

When(/^I wait for child channels to appear$/, async function () {
    await waitUntilDoNotSeeLoadingTexts();
});

When(/^I (include|exclude) the recommended child channels$/, async function (action) {
    const {page} = getBrowserInstances();
    const toggle = page.locator('span.pointer');
    await page.getByText('include recommended').waitFor({timeout: 10000});
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
    const {page} = getBrowserInstances();
    await page.locator(`input[type="radio"][value="${value}"]`).check();
});

When(/^I enter "([^"]*)" as "([^"]*)"$/, async function (text, field) {
    const {page} = getBrowserInstances();
    await page.locator(`input#${field}`).fill(text);
});

When(/^I enter "([^"]*)" in the placeholder "([^"]*)"$/, async function (text, placeholder) {
    const {page} = getBrowserInstances();
    await page.locator(`input[placeholder="${placeholder}"]`).fill(text);
});

When(/^I enter (\d+) minutes from now as "([^"]*)"$/, async function (minutesToAdd, field) {
    const {page} = getBrowserInstances();
    const futureTime = getFutureTime(Number(minutesToAdd));
    await page.locator(`input#${field}`).fill(futureTime);
});

When(/^I enter "([^"]*)" as "([^"]*)" text area$/, async function (text, field) {
    const {page} = getBrowserInstances();
    await page.locator(`textarea[name="${field}"]`).fill(text);
});

When(/^I enter "(.*?)" as "(.*?)" in the content area$/, async function (text, field) {
    const {page} = getBrowserInstances();
    const contentArea = page.locator('section');
    await contentArea.locator(`input[name="${field}"]`).fill(text);
});

When(/^I enter the URI of the registry as "([^"]*)"$/, async function (field) {
    const {page} = getBrowserInstances();
    if (globalVars.noAuthRegistry != null) {
        await page.locator(`input#${field}`).fill(globalVars.noAuthRegistry);
    }
});

When(/^I enter "([^"]*)" on the search field$/, async function (searchText) {
    await enterTextAsField(searchText, 'search_string');
});

When(/^I go back$/, async function () {
    const {page} = getBrowserInstances();
    await page.goBack();
});

When(/^I click on "([^"]*)"$/, async function (text) {
    const {page} = getBrowserInstances();
    await clickButtonAndWait(page, text);
});

When(/^I click on a button within the item containing "([^"]*)"$/, async function (textInItem) {
    const {page} = getBrowserInstances();
    await page.locator(`li:has-text("${textInItem}") button`).click();
});

When(/^I click on "([^"]*)" in element "([^"]*)"$/, async function (text, elementId) {
    const {page} = getBrowserInstances();
    await clickButtonAndWait(page, `div#${elementId}, div.${elementId}`);
});

When(/^I click on "([^"]*)" and confirm$/, async function (text) {
    await clickOnTextAndConfirm(text);
});

When(/^I click on "([^"]*)" and confirm alert box$/, async function (text) {
    const {page} = getBrowserInstances();
    page.on('dialog', async dialog => {
        await dialog.accept();
    });
    await page.getByRole('button', {name: text}).click();
});

When(/^I follow "([^"]*)"$/, async function (text) {
    const {page} = getBrowserInstances();
    await clickLinkAndWait(page, text);
});

When(/^I follow first "([^"]*)"$/, async function (text) {
    const {page} = getBrowserInstances();
    await clickLinkAndWait(page, text);
});

When(/^I follow "([^"]*)" in the (.+)$/, async function (text, context) {
    const {page} = getBrowserInstances();
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
    await clickLinkAndWait(page, contextLocator, text);
});

When(/^I follow first "([^"]*)" in the (.+)$/, async function (text, context) {
    const {page} = getBrowserInstances();
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
    await clickLinkAndWait(page, contextLocator, text);
});

When(/^I follow "([^"]*)" on "(.*?)" row$/, async function (text, host) {
    const {page} = getBrowserInstances();
    const systemName = await getSystemName(host);
    const rowLocator = page.getByRole('row', {name: systemName});
    await rowLocator.getByRole('link', {name: text}).click();
});

When(/^I enter "(.*?)" in the editor$/, async function (text) {
    const {page} = getBrowserInstances();
    await page.locator('.ace_editor').click();
    await page.keyboard.insertText(text);
});

When(/^I follow the left menu "([^"]*)"$/, async function (menuPath) {
    const {page} = getBrowserInstances();
    const menuLevels = menuPath.split('>').map((s: string) => s.trim());
    let currentLocator = page.locator('aside #nav nav');
    for (const menuLevel of menuLevels) {
        const linkLocator = currentLocator.locator(`ul > li > div > a:has-text("${menuLevel}")`);
        await linkLocator.click();
        currentLocator = linkLocator.locator('..').locator('..');
    }
});

Given(/^I am not authorized$/, async function () {
    const {page} = getBrowserInstances();
    try {
        const logoutLink = page.getByRole('link', {name: 'Logout'});
        if (await logoutLink.isVisible()) {
            await logoutLink.click();
        }
    } catch (e) {
        console.log('The browser session could not be cleaned.');
    }
    await page.goto(getAppHost());
    const signInButton = page.getByRole('button', {name: 'Sign In'});
    await expect(signInButton).toBeVisible();
});

When(/^I go to the home page$/, async function () {
    const {page} = getBrowserInstances();
    await page.goto(getAppHost());
});

Given(/^I access the host the first time$/, async function () {
    const {page} = getBrowserInstances();
    await page.goto(getAppHost());
    const textLocator = page.getByText(`Create ${globalVars.product} Administrator`);
    if (!await textLocator.isVisible()) {
        throw new Error(`Text 'Create ${globalVars.product} Administrator' not found`);
    }
});

Given(/^I am authorized for the "([^"]*)" section$/i, async function (section) {
    switch (section) {
        case 'Admin':
            await authorizeUser('admin', 'admin');
            break;
        case 'Images':
            await authorizeUser('kiwikiwi', 'kiwiwi');
            break;
        case 'Docker':
            await authorizeUser('docker', 'docker');
            break;
        default:
            throw new Error(`Section ${section} not supported`);
    }
});

Given(/^I am on the Systems overview page of this "([^"]*)"$/, async function (host) {
    const {page} = getBrowserInstances();
    const node = await getTarget(host);
    const systemId = await getSystemId(node);
    const overviewPage = `/rhn/systems/details/Overview.do?sid=${systemId}`;
    await page.goto(`${getAppHost()}${overviewPage}`);
});

Given(/^I navigate to the Systems overview page of this "([^"]*)"$/, async function (host) {
    const systemName = await getSystemName(host);
    await navigateToSystemsPageAndSearch(systemName);
});

Given(/^I am on the "([^"]*)" page of this "([^"]*)"$/, async function (pageName, host) {
    await navigateToSystemsOverviewPage(host);
    await followLinkInContentArea(pageName);
});

When(/^I enter the hostname of "([^"]*)" as "([^"]*)"$/, async function (host, field) {
    const {page} = getBrowserInstances();
    const systemName = await getSystemName(host);
    await page.locator(`input[name="${field}"]`).fill(systemName);
});

When(/^I select the hostname of "([^"]*)" from "([^"]*)"( if present)?$/, async function (host, field, ifPresent) {
    try {
        const systemName = await getSystemName(host);
        await selectOptionFromField(systemName, field);
    } catch (e) {
        if (!ifPresent) {
            throw e;
        }
    }
});

When(/^I follow this "([^"]*)" link$/, async function (host) {
    await followSystemLink(host);
});

When(/^I check the "([^"]*)" client$/, async function (host) {
    const systemName = await getSystemName(host);
    const {page} = getBrowserInstances();
    await toggleCheckboxInList(page, 'check', systemName);
});

Then(/^table row for "([^"]*)" should contain "([^"]*)"$/, async function (rowText, content) {
    const {page} = getBrowserInstances();
    const rowLocator = page.getByRole('row', {name: rowText});
    await expect(rowLocator.getByText(content)).toBeVisible();
});

Then(/^I wait until table row for "([^"]*)" contains "([^"]*)"$/, async function (rowText, content) {
    const {page} = getBrowserInstances();
    const rowLocator = page.getByRole('row', {name: rowText});
    await expect(rowLocator.getByText(content)).toBeVisible();
});

Then(/^the table row for "([^"]*)" should( not)? contain "([^"]*)" icon$/, async function (row, shouldNot, icon) {
    const {page} = getBrowserInstances();
    let contentSelector = '';
    switch (icon) {
        case 'retracted':
            contentSelector = 'i[class*=\'errata-retracted\']';
            break;
        default:
            throw new Error(`Unsupported icon '${icon}' in the step definition`);
    }
    const rowLocator = page.getByRole('row', {name: row});
    const iconLocator = rowLocator.locator(contentSelector);
    if (shouldNot) {
        await expect(iconLocator).not.toBeVisible();
    } else {
        await expect(iconLocator).toBeVisible();
    }
});

When(/^I wait at most ([0-9]+) seconds until table row for "([^"]*)" contains button "([^"]*)"$/, async function (timeout, text, button) {
    const {page} = getBrowserInstances();
    const rowLocator = page.getByRole('row', {name: text});
    const buttonLocator = rowLocator.getByRole('button', {name: button});
    await expect(buttonLocator).toBeVisible({timeout: Number(timeout) * 1000});
});

When(/^I wait until table row for "([^"]*)" contains button "([^"]*)"$/, async function (text, button) {
    await waitUntilTableRowContainsButton(timeouts.long, text, button);
});

When(/^I wait until table row contains a "([^"]*)" text$/, async function (text) {
    const {page} = getBrowserInstances();
    const rowLocator = page.getByRole('row', {name: text});
    await expect(rowLocator).toBeVisible();
});

When(/^I wait until button "([^"]*)" becomes enabled$/, async function (text) {
    const {page} = getBrowserInstances();
    const buttonLocator = page.getByRole('button', {name: text, exact: false});
    await buttonLocator.waitFor({state: 'visible', timeout: timeouts.long * 1000});
});

Given(/^I am authorized as "([^"]*)" with password "([^"]*)"$/, async function (user, password) {
    await authorizeUser(user, password);
});

Given(/^I am authorized$/, async function () {
    const user = getContext('user') || 'admin';
    const password = getContext('password') || 'admin';
    await authorizeUser(user, password);
});

When(/^I sign out$/, async function () {
    const {page} = getBrowserInstances();
    await page.getByRole('link', {name: 'Logout'}).click();
});

Then(/^I should not be authorized$/, async function () {
    const {page} = getBrowserInstances();
    const logoutLink = page.getByRole('link', {name: 'Logout'});
    await expect(logoutLink).not.toBeVisible();
});

Then(/^I should be logged in$/, async function () {
    const {page} = getBrowserInstances();
    const logoutLink = page.getByRole('link', {name: 'Logout'});
    await expect(logoutLink).toBeVisible();
});

Then(/^I am logged in$/, async function () {
    const {page} = getBrowserInstances();
    const logoutLink = page.getByRole('link', {name: 'Logout'});
    await expect(logoutLink).toBeVisible();
});

Then(/^I should see an update in the list$/, async function () {
    const {page} = getBrowserInstances();
    const updateLocator = page.locator('.table-responsive table tbody tr td a');
    await expect(updateLocator).toBeVisible();
});

When(/^I check test channel$/, async function () {
    const {page} = getBrowserInstances();
    await toggleCheckboxInList(page, 'check', 'Fake-Base-Channel-SUSE-like');
});

When(/^I check "([^"]*)" patch$/, async function (patch) {
    const {page} = getBrowserInstances();
    await toggleCheckboxInList(page, 'check', patch);
});

Then(/^I should see "([^"]*)" systems selected for SSM$/, async function (count) {
    const {page} = getBrowserInstances();
    const counterLocator = page.locator('#spacewalk-set-system_list-counter');
    await expect(counterLocator).toHaveText(count);
});

Then(/^I should see a "([^"]*)" text$/, async function (text) {
    const {page} = getBrowserInstances();
    await expect(page.getByText(text)).toBeVisible();
});

Then(/^I should see a "([^"]*)" text or "([^"]*)" text$/, async function (text1, text2) {
    const {page} = getBrowserInstances();
    const locator1 = page.getByText(text1);
    const locator2 = page.getByText(text2);
    await expect(locator1.or(locator2)).toBeVisible();
});

Then(/^I should see "([^"]*)" short hostname$/, async function (host) {
    const {page} = getBrowserInstances();
    const systemName = await getSystemName(host);
    const shortName = systemName.split('.')[0];
    await expect(page.getByText(shortName)).toBeVisible();
});

Then(/^I should see "([^"]*)" hostname$/, async function (host) {
    const {page} = getBrowserInstances();
    const systemName = await getSystemName(host);
    await expect(page.getByText(systemName)).toBeVisible();
});

Then(/^I should not see "([^"]*)" hostname$/, async function (host) {
    const {page} = getBrowserInstances();
    const systemName = await getSystemName(host);
    await expect(page.getByText(systemName)).not.toBeVisible();
});

Then(/^I should see "([^"]*)" in the textarea$/, async function (text) {
    const {page} = getBrowserInstances();
    const textarea = page.locator('textarea').first();
    await expect(textarea).toHaveValue(text);
});

Then(/^I should see "([^"]*)" or "([^"]*)" in the textarea$/, async function (text1, text2) {
    const {page} = getBrowserInstances();
    const textarea = page.locator('textarea').first();
    const value = await textarea.inputValue();
    expect(value.includes(text1) || value.includes(text2)).toBeTruthy();
});

Then(/^I should see "([^"]*)" in the ([^ ]+) textarea$/, async function (text, id) {
    const {page} = getBrowserInstances();
    const textarea = page.locator(`textarea[data-testid="${id}"]`).first();
    await expect(textarea).toHaveValue(text);
});

Then(/^I should see "([^"]*)" or "([^"]*)" in the ([^ ]+) textarea$/, async function (text1, text2, id) {
    const {page} = getBrowserInstances();
    const textarea = page.locator(`textarea[data-testid="${id}"]`).first();
    const value = await textarea.inputValue();
    expect(value.includes(text1) || value.includes(text2)).toBeTruthy();
});

Then('the {string} checkbox should be disabled', async function (arg1: string) {
    const {page} = getBrowserInstances();
    const checkbox = page.locator(`#${arg1}`);
    await expect(checkbox).toBeDisabled();
});

Then(/^I should see a text like "([^"]*)"$/, async function (text) {
    const {page} = getBrowserInstances();
    await expect(page.getByText(new RegExp(text))).toBeVisible();
});

Then(/^I should not see a "([^"]*)" text$/, async function (text) {
    const {page} = getBrowserInstances();
    await expect(page.getByText(text)).not.toBeVisible();
});

Then(/^I should see a "([^"]*)" link$/, async function (text) {
    const {page} = getBrowserInstances();
    await expect(page.getByRole('link', {name: text, exact: false})).toBeVisible();
});

Then(/^I should not see a "([^"]*)" link$/, async function (text) {
    const {page} = getBrowserInstances();
    await expect(page.getByRole('link', {name: text, exact: false})).not.toBeVisible();
});

Then(/^I should see a "([^"]*)" button$/, async function (text) {
    const {page} = getBrowserInstances();
    await expect(page.getByRole('button', {name: text, exact: false})).toBeVisible();
});

Then(/^I should see a "([^"]*)" text in element "([^"]*)"$/, async function (text, element) {
    const {page} = getBrowserInstances();
    const elementLocator = page.locator(`div#${element}, div.${element}`);
    await expect(elementLocator.getByText(text)).toBeVisible();
});

Then(/^I should not see a "([^"]*)" text in element "([^"]*)"$/, async function (text, element) {
    const {page} = getBrowserInstances();
    const elementLocator = page.locator(`div#${element}, div.${element}`);
    await expect(elementLocator.getByText(text)).not.toBeVisible();
});

Then(/^I should see a "([^"]*)" link in the (left menu|tab bar|tabs|content area)$/, async function (link, area) {
    const {page} = getBrowserInstances();
    let selector = '';
    switch (area) {
        case 'left menu':
            selector = 'aside';
            break;
        case 'tab bar':
        case 'tabs':
            selector = 'header';
            break;
        case 'content area':
            selector = 'section';
            break;
        default:
            throw new Error(`Unknown element with description: ${area}`);
    }
    const contextLocator = page.locator(selector);
    await expect(contextLocator.getByRole('link', {name: link})).toBeVisible();
});

Then(/^option "([^"]*)" is selected as "([^"]*)"$/, async function (option, field) {
    const {page} = getBrowserInstances();
    // For standard select elements
    const selectLocator = page.locator(`select#${field}`);
    if (await selectLocator.isVisible()) {
        await expect(selectLocator).toHaveValue(option);
        return;
    }
    // For custom React-select elements
    const customSelectLocator = page.locator(`div[data-testid="${field}-child__value-container"]`);
    await expect(customSelectLocator.getByText(option)).toBeVisible();
});

Then(/^radio button "([^"]*)" should be checked$/, async function (label) {
    const {page} = getBrowserInstances();
    await expect(page.getByLabel(label)).toBeChecked();
});

Then(/^I should see "([^"]*)" as checked$/, async function (identifier) {
    const {page} = getBrowserInstances();
    // Try by ID first, then by label
    const locatorById = page.locator(`#${identifier}`);
    if (await locatorById.count() > 0) {
        await expect(locatorById).toBeChecked();
    } else {
        await expect(page.getByLabel(identifier)).toBeChecked();
    }
});

Then(/^I should see "([^"]*)" as unchecked$/, async function (identifier) {
    const {page} = getBrowserInstances();
    const locatorById = page.locator(`#${identifier}`);
    if (await locatorById.count() > 0) {
        await expect(locatorById).not.toBeChecked();
    } else {
        await expect(page.getByLabel(identifier)).not.toBeChecked();
    }
});

Then(/^the "([^"]*)" field should be disabled$/, async function (identifier) {
    const {page} = getBrowserInstances();
    await expect(page.locator(`#${identifier}`)).toBeDisabled();
});

Then(/^I should land on system's overview page$/, async function () {
    await shouldSeeText('System Status');
    await shouldSeeText('System Info');
    await shouldSeeText('System Events');
});

When(/^I wait until the table contains "FINISHED" or "SKIPPED" followed by "FINISHED" in its first rows$/, async function () {
    const {page} = getBrowserInstances();
    await repeatUntilTimeout(async () => {
        await refreshPage(page);
        const statusHeader = page.getByRole('columnheader', {name: 'Status'});
        const headers = await page.locator('th').allInnerTexts();
        const statusIndex = headers.findIndex(h => h.trim() === 'Status');
        if (statusIndex === -1) return false; // Status column not found, retry

        const rows = await page.locator('tbody tr').all();
        for (const row of rows) {
            const statusCell = row.locator('td').nth(statusIndex);
            const statusText = (await statusCell.innerText()).trim();

            // The first non-skipped, non-interrupted task must be FINISHED
            if (statusText === 'SKIPPED' || statusText === 'INTERRUPTED') {
                continue;
            }
            if (statusText === 'FINISHED') {
                return true;
            }
            if (statusText === 'FAILED') {
                throw new Error('Taskomatic task failed');
            }
            // Still running or picked, continue waiting
            return false;
        }
        return false;
    }, {timeout: 800, message: 'Task does not look FINISHED yet'});
});

When(/^I click on the red confirmation button$/, async function () {
    const {page} = getBrowserInstances();
    await page.locator('button.btn-danger').click();
});

When(/^I click on the clear SSM button$/, async function () {
    const {page} = getBrowserInstances();
    await page.locator('#clear-ssm').click();
});

When(/^I wait until option "([^"]*)" appears in list "([^"]*)"$/, async function (option, field) {
    const {page} = getBrowserInstances();
    const selectLocator = page.locator(`select#${field}`);
    if (await selectLocator.isVisible()) {
        await expect(selectLocator.locator(`option:has-text("${option}")`)).toBeVisible();
    } else {
        // For custom React-select which loads options dynamically
        await page.locator(`div[data-testid="${field}-child__control"]`).click();
        await expect(page.locator(`div[data-testid="${field}-child__option"]`).filter({hasText: option})).toBeVisible();
        await page.keyboard.press('Escape'); // close dropdown
    }
});

When(/^I clear browser cookies$/, async function () {
    const {context} = getBrowserInstances();
    await context.clearCookies();
});

When(/^I refresh the page$/, async function () {
    const {page} = getBrowserInstances();
    await refreshPage(page);
});

When(/^I click on the filter button$/, async function () {
    const {page} = getBrowserInstances();
    await page.locator('button.spacewalk-button-filter').click();
    await expect(page.getByText('is filtered')).toBeVisible({timeout: 10000});
});

When(/^I enter the hostname of "([^"]*)" as the filtered system name$/, async function (host) {
    const {page} = getBrowserInstances();
    const systemName = await getSystemName(host);
    await page.locator("input[placeholder*='Filter by System Name']").fill(systemName);
});

When(/^I enter "([^"]*)" as the filtered package name$/, async function (input) {
    const {page} = getBrowserInstances();
    await page.locator("input[placeholder*='Filter by Package Name']").fill(input);
});

When(/^I enter "([^"]*)" as the filtered synopsis$/, async function (input) {
    const {page} = getBrowserInstances();
    await page.locator("input[placeholder*='Filter by Synopsis']").fill(input);
});

When(/^I enter the package for "([^"]*)" as the filtered package name$/, async function (host) {
    const packageName = PACKAGE_BY_CLIENT[host];
    if (!packageName) {
        throw new Error(`Package for client '${host}' not found in PACKAGE_BY_CLIENT helper.`);
    }
    await enterFilteredPackageName(packageName);
});

Then(/^I check the row with the "([^"]*)" link$/, async function (text) {
    const {page} = getBrowserInstances();
    const row = page.locator('tr', {has: page.getByRole('link', {name: text})});
    await row.locator('input[type="checkbox"]').first().check();
});

Then(/^I check the row with the "([^"]*)" text$/, async function (text) {
    const {page} = getBrowserInstances();
    await toggleCheckboxInList(page, 'check', text);
});

When(/^I check row with "([^"]*)" and arch of "([^"]*)"$/, async function (text, client) {
    const {page} = getBrowserInstances();
    const arch = PKGARCH_BY_CLIENT[client];
    const row = page.locator('tr', {hasText: text}).filter({hasText: arch});
    await row.locator('input[type="checkbox"]').first().check();
});

// #####################################################################################
// ## Modal Dialogs
// #####################################################################################

When(/^I click on "([^"]*)" in "([^"]*)" modal$/, async function (button, title) {
    const {page} = getBrowserInstances();
    const modal = page.getByRole('dialog', {name: title});
    await expect(modal).toBeVisible();
    await modal.getByRole('button', {name: button}).click();
    await expect(modal).not.toBeVisible();
});

When(/^I wait at most (\d+) seconds until I see modal containing "([^"]*)" text$/, async function (timeout, text) {
    const {page} = getBrowserInstances();
    const modalContent = page.locator('.modal-content', {hasText: text});
    await expect(modalContent).toBeVisible({timeout: Number(timeout) * 1000});
});

When(/^I close the modal dialog$/, async function () {
    const {page} = getBrowserInstances();
    // A standard bootstrap modal close button
    await page.locator('.modal-header button.close, .modal-header button[aria-label="Close"]').click();
});

Given(/^I have a property "([^"]*)" with value "([^"]*)" on "([^"]*)"$/, async function (prop, value, host) {
    await navigateToSystemsOverviewPage(host);
    await followLinkInContentArea('Properties');
    await enterValueAsProperty(value, prop);
    await clickUpdateProperties();
    await shouldSeeSystemPropertiesChangedText();
});


When(/^I visit "([^"]*)" endpoint of this "([^"]*)"$/, async function (service, host) {
    const node = await getTarget(host);
    const systemName = await getSystemName(host);
    const osFamily = node.osFamily;
    let port: number, protocol: string, path: string, text: string;
    switch (service) {
        case 'Proxy':
            [port, protocol, path, text] = [443, 'https', '/pub/', 'Index of /pub'];
            break;
        case 'Prometheus':
            [port, protocol, path, text] = [9090, 'http', '', 'graph'];
            break;
        case 'Prometheus node exporter':
            [port, protocol, path, text] = [9100, 'http', '', 'Node Exporter'];
            break;
        case 'Prometheus apache exporter':
            [port, protocol, path, text] = [9117, 'http', '', 'Apache Exporter'];
            break;
        case 'Prometheus postgres exporter':
            [port, protocol, path, text] = [9187, 'http', '', 'Postgres Exporter'];
            break;
        case 'Grafana':
            [port, protocol, path, text] = [3000, 'http', '', 'Grafana Labs'];
            break;
        default:
            throw new Error(`Unknown port for service ${service}`);
    }
    if (osFamily!.includes('debian') || osFamily!.includes('ubuntu')) {
        await node.runUntilOk(`wget --no-check-certificate -qO- ${protocol}://${systemName}:${port}${path} | grep -i '${text}'`);
    } else {
        await node.runUntilOk(`curl -s -k ${protocol}://${systemName}:${port}${path} | grep -i '${text}'`);
    }
});

When(/^I set the minimum password length to "([^"]*)"$/, async function (minLength) {
    const {page} = getBrowserInstances();
    await page.locator('#minLength').fill(minLength);
});

When(/^I set the maximum password length to "([^"]*)"$/, async function (maxLength) {
    const {page} = getBrowserInstances();
    await page.locator('#maxLength').fill(maxLength);
});

When(/^I set the special characters list to "([^"]*)"$/, async function (chars) {
    const {page} = getBrowserInstances();
    await page.locator('#specialChars').fill(chars);
});

When(/^I set the maximum allowed occurrence of any character to "([^"]*)"$/, async function (max) {
    const {page} = getBrowserInstances();
    await page.locator('#maxCharacterOccurrence').fill(max);
});

When(/^I (enable|disable) the following restrictions:$/, async function (action, dataTable) {
    const {page} = getBrowserInstances();
    const restrictions = dataTable.raw().flat();
    const shouldCheck = action === 'enable';

    const restrictionMap = {
        'Require Digits': 'digitFlag',
        'Require Lowercase Characters': 'lowerCharFlag',
        'Require Uppercase Characters': 'upperCharFlag',
        'Require Special Characters': 'specialCharFlag',
        'Restrict Characters Occurrences': 'restrictedOccurrenceFlag',
        'Restrict Consecutive Characters': 'consecutiveCharsFlag'
    };

    for (const restriction of restrictions) {
        const checkboxId = restrictionMap[restriction as keyof typeof restrictionMap];
        if (!checkboxId) throw new Error(`Unknown restriction: ${restriction}`);
        const checkbox = page.locator(`#${checkboxId}`);
        if (shouldCheck) {
            await checkbox.check();
        } else {
            await checkbox.uncheck();
        }
    }
});

Then(/^the following restrictions should be (enabled|disabled):$/, async function (state, dataTable) {
    const {page} = getBrowserInstances();
    const restrictions = dataTable.raw().flat();
    const shouldBeChecked = state === 'enabled';

    const restrictionMap = {
        'Require Digits': 'digitFlag',
        'Require Lowercase Characters': 'lowerCharFlag',
        'Require Uppercase Characters': 'upperCharFlag',
        'Require Special Characters': 'specialCharFlag',
        'Restrict Characters Occurrences': 'restrictedOccurrenceFlag',
        'Restrict Consecutive Characters': 'consecutiveCharsFlag'
    };

    for (const restriction of restrictions) {
        const checkboxId = restrictionMap[restriction as keyof typeof restrictionMap];
        if (!checkboxId) throw new Error(`Unknown restriction: ${restriction}`);
        const checkbox = page.locator(`#${checkboxId}`);
        if (shouldBeChecked) {
            await expect(checkbox).toBeChecked();
        } else {
            await expect(checkbox).not.toBeChecked();
        }
    }
});
