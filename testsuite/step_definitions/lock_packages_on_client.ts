import { Given, When, Then } from '@cucumber/cucumber';
// Central helpers (browser, page, utilities)
import * as Helpers from '../helpers';

Then(/^"(.*?)" is (locked|unlocked) on "(.*?)"$/, async function (pkg, action, system) {
    const node = await Helpers.getTarget(system);
    const command = `zypper locks --solvables | grep ${pkg}`;
    if (action === 'locked') {
        await node.run(command, { timeout: 600 });
    } else {
        await node.run(command, { checkErrors: false, timeout: 600 });
    }
});

Then(/^package "(.*?)" is reported as locked$/, async function (pkg) {
    const { page } = Helpers.getBrowserInstances();
    await page.locator(`xpath=(//a[text()='${pkg}'])[1]`).waitFor({ state: 'visible' });
    const lockedPkgs = await page.locator('xpath=//i[@class=\'fa fa-lock\']/../a').all();
    if (lockedPkgs.length === 0) {
        throw new Error('No packages locked');
    }
    const isPkgLocked = lockedPkgs.some(async (el) => (await el.textContent() || '').startsWith(pkg));
    if (!isPkgLocked) {
        throw new Error(`Package ${pkg} not found as locked`);
    }
});

Then(/^package "(.*?)" is reported as unlocked$/, async function (pkg) {
    const { page } = Helpers.getBrowserInstances();
    await page.locator(`xpath=(//a[text()='${pkg}'])[1]`).waitFor({ state: 'visible' });
    const lockedPkgs = await page.locator('xpath=//i[@class=\'fa fa-lock\']/../a').all();
    const isPkgLocked = lockedPkgs.some(async (el) => (await el.textContent() || '').startsWith(pkg));
    if (isPkgLocked) {
        throw new Error(`Package ${pkg} found as locked`);
    }
});

Then(/^the package scheduled is "(.*?)"$/, async function (pkg) {
    const { page } = Helpers.getBrowserInstances();
    const match = page.locator('xpath=//li[@class=\'list-group-item\']//li').first();
    await match.waitFor({ state: 'visible' });
    const text = await match.textContent();
    if (!text) {
        throw new Error('List of packages not found');
    }
    if (!text.startsWith(pkg)) {
        throw new Error(`Package ${pkg} not found`);
    }
});

Then(/^the action status is "(.*?)"$/, async function (status) {
    await (this as any).runStep(`I should see a "This action's status is: ${status}" text`);
});

Then(/^package "(.*?)" is reported as pending to be locked$/, async function (pkg) {
    const { page } = Helpers.getBrowserInstances();
    const xpathQuery = `//td[a[text()='${pkg}'] and i[@class='fa fa-clock-o'] and span[@class='label label-info' and contains(text(), 'Locking...')]]`;
    await page.locator(`xpath=${xpathQuery}`).waitFor({ state: 'visible' });
});

Then(/^package "(.*?)" is reported as pending to be unlocked$/, async function (pkg) {
    const { page } = Helpers.getBrowserInstances();
    const xpathQuery = `//td[a[text()='${pkg}'] and i[@class='fa fa-clock-o'] and span[@class='label label-info' and contains(text(), 'Unlocking...')]]`;
    await page.locator(`xpath=${xpathQuery}`).waitFor({ state: 'visible' });
});

Then(/^package "(.*?)" cannot be selected$/, async function (pkg) {
    const { page } = Helpers.getBrowserInstances();
    const xpathQuery = `//tr[td[input[@type='checkbox' and @disabled]] and td[ a[text()='${pkg}'] and i[@class='fa fa-clock-o'] and span[@class='label label-info']]]`;
    await page.locator(`xpath=${xpathQuery}`).waitFor({ state: 'visible' });
});

Then(/^only packages "(.*?)" are reported as pending to be unlocked$/, async function (pkgs) {
    const { page } = Helpers.getBrowserInstances();
    const packages = pkgs.split(',').map(s => s.trim());
    for (const pkg of packages) {
        const xpathQuery = `//td[a[text()='${pkg}'] and i[@class='fa fa-clock-o'] and span[@class='label label-info' and contains(text(), 'Unlocking...')]]`;
        await page.locator(`xpath=${xpathQuery}`).waitFor({ state: 'visible' });
    }
    const matches = await page.locator(`xpath=//td[i[@class='fa fa-clock-o'] and span[@class='label label-info' and contains(text(), 'Unlocking...')]]`).all();
    if (matches.length !== packages.length) {
        throw new Error(`Matches count ${matches.length} is different than packages count ${packages.length}`);
    }
});