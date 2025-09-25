import {Given, Then, When, World} from '@cucumber/cucumber';
import {
    envConfig,
    getSystemName,
    getTarget,
    globalVars,
    refreshPage,
    repeatUntilTimeout,
    TIMEOUTS
} from '../helpers/index.js';
import {getBrowserInstances, getSccCredentials} from '../helpers/index.js';
import {expect} from "@playwright/test";

Then(/^HTTP proxy verification should have succeeded$/, async function (...args: any[]) {
    const {page} = getBrowserInstances();
    if (!page) throw new Error('No page instance');
    const alert = page.locator('div.alert-success').first();
    await expect(alert).toBeVisible();
});

When(/^I enter the address of the HTTP proxy as "([^"]*)"$/, async function (hostnameField: string) {
    const {page} = getBrowserInstances();
    if (!page) throw new Error('No page instance');
    const value = globalVars.serverHttpProxy || '';
    const byLabel = page.getByLabel(hostnameField);
    if (await byLabel.isVisible()) {
        await byLabel.fill(value);
    } else {
        const input = page.locator(`#${hostnameField}, [name="${hostnameField}"]`).first();
        await input.fill(value);
    }
});

When(/^I ask to add new credentials$/, async function () {
    const {page} = getBrowserInstances();
    if (!page) throw new Error('No page instance');
    const plus = page.locator('i.fa-plus-circle').first();
    await expect(plus).toBeVisible();
    await plus.click();
});

When(/^I enter the SCC credentials$/, async function () {
    const {page} = getBrowserInstances();
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
    const {page} = getBrowserInstances();
    if (!page) throw new Error('No page instance');
    const creds = getSccCredentials();
    if (!creds?.username) throw new Error('Missing SCC username to validate');
    const userPanel = page.getByRole('region', {name: creds.username});
    const successIcon = userPanel.locator('i.text-success').first();
    await expect(successIcon).toBeVisible({timeout: 30000});
});

Then(/^the credentials for "([^"]*)" should be invalid$/, async function (user) {
    const {page} = getBrowserInstances();
    if (!page) throw new Error('No page instance');
    const userPanel = page.getByRole('region', {name: user});
    const failureIcon = userPanel.locator('i.text-danger').first();
    await expect(failureIcon).toBeVisible();
});

When(/^I make the credentials for "([^"]*)" primary$/, async function (user) {
    const {page} = getBrowserInstances();
    if (!page) throw new Error('No page instance');
    const userPanel = page.getByRole('region', {name: user});
    const starIcon = userPanel.locator('i.fa-star-o').first();
    await expect(starIcon).toBeVisible();
    await starIcon.click();
});

Then(/^the credentials for "([^"]*)" should be primary$/, async function (user) {
    const {page} = getBrowserInstances();
    if (!page) throw new Error('No page instance');
    const userPanel = page.getByRole('region', {name: user});
    const starIcon = userPanel.locator('i.fa-star').first();
    await expect(starIcon).toBeVisible();
});

When(/^I wait for the trash icon to appear for "([^"]*)"$/, async function (user) {
    const {page} = getBrowserInstances();
    if (!page) throw new Error('No page instance');
    const userPanel = page.getByRole('region', {name: user});
    const trashIcon = userPanel.locator('i.fa-trash-o').first();
    await expect(trashIcon).not.toHaveAttribute('style', /not-allowed/);
});

When(/^I ask to edit the credentials for "([^"]*)"$/, async function (user) {
    const {page} = getBrowserInstances();
    if (!page) throw new Error('No page instance');
    const userPanel = page.getByRole('region', {name: user});
    const pencilIcon = userPanel.locator('i.fa-pencil').first();
    await expect(pencilIcon).toBeVisible();
    await pencilIcon.click();
});

When(/^I ask to delete the credentials for "([^"]*)"$/, async function (user) {
    const {page} = getBrowserInstances();
    if (!page) throw new Error('No page instance');
    const userPanel = page.getByRole('region', {name: user});
    const trashIcon = userPanel.locator('i.fa-trash-o').first();
    await expect(trashIcon).toBeVisible();
    await trashIcon.click();
});

When(/^I view the subscription list for "([^"]*)"$/, async function (user) {
    const {page} = getBrowserInstances();
    if (!page) throw new Error('No page instance');
    const userPanel = page.getByRole('region', {name: user});
    const listIcon = userPanel.locator('i.fa-th-list').first();
    await expect(listIcon).toBeVisible();
    await listIcon.click();
});

When(/^I (deselect|select) "([^"]*)" as a product$/, async function (action, product) {
    const {page} = getBrowserInstances();
    if (!page) throw new Error('No page instance');
    const productWrapper = page.locator('.product-details-wrapper', {hasText: product});
    const checkbox = productWrapper.getByRole('checkbox').first();
    if (action === 'select') {
        await checkbox.check();
    } else {
        await checkbox.uncheck();
    }
});

When(/^I select or deselect "([^"]*)" beta client tools$/, async function (channel) {
    const {page} = getBrowserInstances();
    if (!page) throw new Error('No page instance');
    const productWrapper = page.locator('.product-details-wrapper', {hasText: channel});
    const checkbox = productWrapper.getByRole('checkbox').first();
    if (await checkbox.isVisible()) {
        if (envConfig.betaEnabled) {
            await checkbox.check();
        } else {
            await checkbox.uncheck();
        }
    } else {
        console.warn(`${channel} beta client tools checkbox not found`);
    }
});

When(/^I wait at most (\d+) seconds until the tree item "([^"]+)" has no sub-list$/, async function (timeout, item) {
    const {page} = getBrowserInstances();
    if (!page) throw new Error('No page instance');
    const productWrapper = page.locator('.product-details-wrapper', {hasText: item});
    const sublistIcon = productWrapper.locator('i.fa-angle-');
    await expect(sublistIcon).not.toBeVisible({timeout: Number(timeout) * 1000});
});

When(/^I wait at most (\d+) seconds until the tree item "([^"]+)" contains "([^"]+)" text$/, async function (timeout, item, text) {
    const {page} = getBrowserInstances();
    if (!page) throw new Error('No page instance');
    const itemPanel = page.locator('.product-details-wrapper', {hasText: item});
    await expect(itemPanel.getByText(text)).toBeVisible({timeout: Number(timeout) * 1000});
});

When(/^I wait at most (\d+) seconds until the tree item "([^"]+)" contains "([^"]+)" button$/, async function (timeout, item, button) {
    const {page} = getBrowserInstances();
    if (!page) throw new Error('No page instance');
    const itemPanel = page.locator('.product-details-wrapper', {hasText: item});
    const buttonLocator = itemPanel.getByRole('button', {name: button});
    await expect(buttonLocator).toBeVisible({timeout: Number(timeout) * 1000});
});

When(/^I open the sub-list of the product "(.*?)"((?: if present)?)$/, async function (product, ifPresent) {
    const {page} = getBrowserInstances();
    if (!page) throw new Error('No page instance');
    const productWrapper = page.locator('.product-details-wrapper', {hasText: product});
    const sublistIcon = productWrapper.locator('i.fa-angle-right').first();
    if (await sublistIcon.isVisible()) {
        await sublistIcon.click();
    } else if (ifPresent.trim() === '') {
        throw new Error(`Sublist icon for product ${product} not found`);
    }
});

When(/^I select the addon "(.*?)"$/, async function (addon) {
    const {page} = getBrowserInstances();
    if (!page) throw new Error('No page instance');
    const productWrapper = page.locator('.product-details-wrapper', {hasText: addon});
    const checkbox = productWrapper.getByRole('checkbox').first();
    await checkbox.check();
});

Then(/^I should see that the "(.*?)" product is "(.*?)"$/, async function (product, recommended) {
    const {page} = getBrowserInstances();
    if (!page) throw new Error('No page instance');
    const productElement = page.locator('.product-details-wrapper', {hasText: globalVars.product});
    const recommendedElement = productElement.getByText(recommended);
    await expect(recommendedElement).toBeVisible();
});

Then(/^I should see the "(.*?)" selected$/, async function (product) {
    const {page} = getBrowserInstances();
    if (!page) throw new Error('No page instance');
    const productWrapper = page.locator('.product-details-wrapper', {hasText: product});
    const checkbox = productWrapper.getByRole('checkbox').first();
    await expect(checkbox).toBeChecked();
});

When(/^I wait until I see "(.*?)" product has been added$/, async function (product) {
    const {page} = getBrowserInstances();
    if (!page) throw new Error('No page instance');
    const productWrapper = page.locator('.product-details-wrapper', {hasText: product});
    await expect(productWrapper).toHaveClass(/product-installed/);
});

When(/^I click the Add Product button$/, async function () {
    const {page} = getBrowserInstances();
    if (!page) throw new Error('No page instance');
    const addButton = page.getByRole('button', {name: 'Add Product'});
    await addButton.click();
});

Then(/^the SLE15 (SP3|SP4|SP5) product should be added$/, async function (spVersion) {
    const server = await getTarget('server');
    const {stdout} = await server.run('echo -e "admin\\nadmin\\n" | mgr-sync list channels', {
        checkErrors: false,
        bufferSize: 1000000
    });
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
    const {page} = getBrowserInstances();
    if (!page) throw new Error('No page instance');
    const productWrapper = page.locator('.product-details-wrapper', {hasText: product});
    const button = productWrapper.getByRole('button', {name: 'Show Channels'}).first();
    await button.click();
});

Then(/^I should see a table line with "([^"]*)", "([^"]*)", "([^"]*)"$/, async function (text1, text2, text3) {
    const {page} = getBrowserInstances();
    if (!page) throw new Error('No page instance');
    const rowLocator = page.getByRole('row', {name: text1});
    await expect(rowLocator.getByRole('link', {name: text2})).toBeVisible();
    await expect(rowLocator.getByRole('link', {name: text3})).toBeVisible();
});

Then(/^I should see a table line with "([^"]*)", "([^"]*)"$/, async function (text1, text2) {
    const {page} = getBrowserInstances();
    if (!page) throw new Error('No page instance');
    const rowLocator = page.getByRole('row', {name: text1});
    await expect(rowLocator.getByRole('link', {name: text2})).toBeVisible();
});

Then(/^a table line should contain system "([^"]*)", "([^"]*)"$/, async function (host, text) {
    const {page} = getBrowserInstances();
    if (!page) throw new Error('No page instance');
    const systemName = await getSystemName(host);
    const rowLocator = page.getByRole('row', {name: systemName});
    await expect(rowLocator.getByText(text)).toBeVisible();
});

When(/^I wait at most (\d+) seconds until I see the name of "([^"]*)", refreshing the page$/, async function (seconds, host) {
    const {page} = getBrowserInstances();
    if (!page) throw new Error('No page instance');
    const systemName = await getSystemName(host);
    await repeatUntilTimeout(async () => {
        await expect(page.getByText('Loading...')).not.toBeVisible();
        if (await page.getByText(systemName, {exact: false}).isVisible({timeout: 3000})) {
            return true;
        }
        await refreshPage(page);
        return false;
    }, {message: `I can't see the system '${systemName}'`, timeout: Number(seconds)});
});

When(/^I wait at most (\d+) seconds until onboarding is completed for "([^"]*)"$/, async function (seconds, host) {
    const finalTimeout = Number(seconds);
    const stepTimeout = 180;
    await this.runStep('When I follow the left menu "Systems > System List > All"');
    await this.runStep(`And I wait until I see the name of "${host}", refreshing the page`);
    await this.runStep(`And I follow this "${host}" link`);
    await this.runStep('And I wait until I see "System Status" text');
    await this.runStep(`And I wait ${stepTimeout} seconds until the event is picked up and ${finalTimeout} seconds until the event "Apply states" is completed`);
    await this.runStep(`And I wait ${stepTimeout} seconds until the event is picked up and ${finalTimeout} seconds until the event "Hardware List Refresh" is completed`);
    await this.runStep(`And I wait ${stepTimeout} seconds until the event is picked up and ${finalTimeout} seconds until the event "Package List Refresh" is completed`);
});

When(/^I wait until onboarding is completed for "([^"]*)"$/, async function (host) {
    await this.runStep(`I wait at most ${TIMEOUTS.long} seconds until onboarding is completed for "${host}"`);
});

Then(/^I should see "([^"]*)" via spacecmd$/, async function (host) {
    const server = await getTarget('server');
    if (!server) throw new Error('No server instance');
    const command = 'spacecmd -u admin -p admin system_list';
    const systemName = await getSystemName(host);
    await repeatUntilTimeout(async () => {
        await server.run('spacecmd -u admin -p admin clear_caches');
        const {stdout} = await server.run(command, {checkErrors: false, verbose: true});
        return stdout.includes(systemName);
    }, {message: `system ${systemName} is not in the list yet`});
});

Then(/^I should see "([^"]*)" as link$/, async function (host) {
    const {page} = getBrowserInstances();
    if (!page) throw new Error('No page instance');
    const systemName = await getSystemName(host);
    await expect(page.getByRole('link', {name: systemName})).toBeVisible();
});

When(/^I remember when I scheduled an action$/, async function () {
    globalVars.moments.set('schedule_action', new Date());
});

Then(/^I should see "([^"]*)" at least (\d+) minutes after I scheduled an action$/, async function (text, minutes) {
    const {page} = getBrowserInstances();

    const elements = await page.locator('div', {hasText: text}).all();
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
    if (!globalVars.moments || !globalVars.moments.get('schedule_action')) {
        throw new Error('Time the action was scheduled not found in memory');
    }
    const initial = globalVars.moments.get('schedule_action') as Date;
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
    const {page} = getBrowserInstances();
    if (!page) throw new Error('No page instance');
    let toggler;
    switch (targetStatus) {
        case 'enabled':
            toggler = page.locator('i.fa-toggle-on');
            break;
        case 'disabled':
            toggler = page.locator('i.fa-toggle-off');
            break;
        default:
            throw new Error('Invalid target status.');
    }
    await expect(toggler).toBeVisible();
});

When(/^I click on the "([^"]*)" toggler$/, async function (targetStatus) {
    const {page} = getBrowserInstances();
    if (!page) throw new Error('No page instance');
    let toggler;
    switch (targetStatus) {
        case 'enabled':
            toggler = page.locator('i.fa-toggle-on');
            break;
        case 'disabled':
            toggler = page.locator('i.fa-toggle-off');
            break;
        default:
            throw new Error('Invalid target status.');
    }
    await toggler.click();
});

Then(/^I should see the child channel "([^"]*)" "([^"]*)"$/, async function (targetChannel, targetStatus) {
    const {page} = getBrowserInstances();
    if (!page) throw new Error('No page instance');
    await expect(page.getByText(targetChannel)).toBeVisible();
    const label = page.locator(`label:has-text("${targetChannel}")`);
    const channelCheckboxId = await label.getAttribute('for');
    const checkbox = page.locator(`input#${channelCheckboxId}`);
    if (targetStatus === 'selected') {
        await expect(checkbox).toBeChecked();
    } else if (targetStatus === 'unselected') {
        await expect(checkbox).not.toBeChecked();
    }
});

Then(/^I should see the child channel "([^"]*)" "([^"]*)" and "([^"]*)"$/, async function (targetChannel, targetStatus, isDisabled) {
    const {page} = getBrowserInstances();
    if (!page) throw new Error('No page instance');
    await expect(page.getByText(targetChannel)).toBeVisible();
    const label = page.locator(`label:has-text("${targetChannel}")`);
    const channelCheckboxId = await label.getAttribute('for');
    const checkbox = page.locator(`input#${channelCheckboxId}`);
    if (isDisabled !== 'disabled') {
        throw new Error('Invalid disabled flag value');
    }
    if (targetStatus === 'selected') {
        await expect(checkbox).toBeChecked();
    } else if (targetStatus === 'unselected') {
        await expect(checkbox).not.toBeChecked();
    }
});

When(/^I select the child channel "([^"]*)"$/, async function (targetChannel) {
    const {page} = getBrowserInstances();
    if (!page) throw new Error('No page instance');
    await expect(page.getByText(targetChannel)).toBeVisible();
    const label = page.locator(`label:has-text("${targetChannel}")`);
    const channelCheckboxId = await label.getAttribute('for');
    const checkbox = page.locator(`input#${channelCheckboxId}`);
    await expect(checkbox).not.toBeChecked();
    await checkbox.click();
});

Then(/^I should see "([^"]*)" "([^"]*)" for the "([^"]*)" channel$/, async function (targetRadio, targetStatus, targetChannel) {
    const {page} = getBrowserInstances();
    if (!page) throw new Error('No page instance');
    const link = page.locator(`a:has-text("${targetChannel}")`);
    const channelId = await link.getAttribute('href').then(href => href?.split('?')[1].split('=')[1]);
    let radio;
    switch (targetRadio) {
        case 'No change':
            radio = page.locator(`input[type='radio'][name='ch_action_${channelId}'][value='NO_CHANGE']`);
            break;
        case 'Subscribe':
            radio = page.locator(`input[type='radio'][name='ch_action_${channelId}'][value='SUBSCRIBE']`);
            break;
        case 'Unsubscribe':
            radio = page.locator(`input[type='radio'][name='ch_action_${channelId}'][value='UNSUBSCRIBE']`);
            break;
        default:
            throw new Error(`Target Radio ${targetRadio} not supported`);
    }
    if (targetStatus === 'selected') {
        await expect(radio).toBeChecked();
    } else if (targetStatus === 'unselected') {
        await expect(radio).not.toBeChecked();
    }
});

Then(/^the notification badge and the table should count the same amount of messages$/, async function () {
    const {page} = getBrowserInstances();
    if (!page) throw new Error('No page instance');
    // This step relies on `count_table_items` which is not provided.
    throw new Error('This step requires `count_table_items` helper which is not provided.');
});

When(/^I wait until radio button "([^"]*)" is checked, refreshing the page$/, async function (arg1) {
    const {page} = getBrowserInstances();
    if (!page) throw new Error('No page instance');
    const radio = page.locator(`input[type="radio"][id="${arg1}"]`);
    await expect(radio).toBeChecked();
});

When(/^I wait until "([^"]*)" has been checked$/, async function (text) {
    const {page} = getBrowserInstances();
    if (!page) throw new Error('No page instance');
    const checkbox = page.getByLabel(text);
    await expect(checkbox).toBeChecked();
});

Then(/^I check the first notification message$/, async function () {
    const {page} = getBrowserInstances();
    if (!page) throw new Error('No page instance');
    // This step relies on `count_table_items` which is not provided.
    throw new Error('This step requires `count_table_items` helper which is not provided.');
});

When(/^I delete it via the "([^"]*)" button$/, async function (targetButton) {
    const {page} = getBrowserInstances();
    if (!page) throw new Error('No page instance');
    // This step relies on `count_table_items` which is not provided.
    throw new Error('This step requires `count_table_items` helper which is not provided.');
});

When(/^I mark as read it via the "([^"]*)" button$/, async function (targetButton) {
    const {page} = getBrowserInstances();
    if (!page) throw new Error('No page instance');
    // This step relies on `count_table_items` which is not provided.
    throw new Error('This step requires `count_table_items` helper which is not provided.');
});

When(/^I check for failed events on history event page$/, async function () {
    const {page} = getBrowserInstances();
    if (!page) throw new Error('No page instance');
    await this.runStep('When I follow "Events" in the content area');
    await this.runStep('And I follow "History" in the content area');
    await this.runStep('Then I should see a "System History" text');
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
    const {page} = getBrowserInstances();
    if (!page) throw new Error('No page instance');
    const bulletStyles: Record<string, string> = {
        'success': 'fa-check-circle',
        'failing': 'fa-times-circle',
        'warning': 'fa-exclamation-triangle',
        'pending': 'fa-clock-o',
        'refreshing': 'fa-spinner'
    };
    const listItem = page.locator('ul li', {hasText: text});
    const bulletIcon = listItem.locator(`i.${bulletStyles[bulletType]}`);
    await expect(bulletIcon).toBeVisible();
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
