import {
    addContext,
    getApiTest,
    getAppHost,
    getCurrentPage,
    getSystemId,
    getSystemName,
    getTarget,
    refreshPage,
    repeatUntilTimeout
} from '../index.js';
import {expect} from '@playwright/test';

// Helper functions for navigation embedded_steps

export async function waitUntilSeeSystemRefreshingPage(systemName: string) {
    await repeatUntilTimeout(async () => {
        if (await getCurrentPage().getByText(systemName).isVisible({timeout: 3000})) return true;
        await refreshPage(getCurrentPage());
        return false;
    }, {message: `Couldn't find the system name of "${systemName}"`});
}

export async function waitUntilDoNotSeeTextRefreshingPage(text: string) {
    await repeatUntilTimeout(async () => {
        if (!await getCurrentPage().getByText(text).isVisible({timeout: 3000})) return true;
        await refreshPage(getCurrentPage());
        return false;
    }, {message: `Text '${text}' is still visible`});
}

export async function selectOptionFromField(option: string, field: string) {
    const locators = [
        getCurrentPage().locator(`select#${field}, select[name="${field}"]`),
        getCurrentPage().getByRole('combobox', {name: field}),
        getCurrentPage().getByLabel(field),
    ];

    for (const locator of locators) {
        try {
            await locator.selectOption(option);
            console.debug(`Input field "${field}" located through: ${locator}`)
            return; // stop at first success
        } catch {
            // ignore error and try next locator.
        }
    }

    throw new Error(`Could not find a visible input field for "${field}"`);
}

export async function waitUntilDoNotSeeLoadingTexts() {
    await expect(getCurrentPage().getByText('Loading')).not.toBeVisible();
    await expect(getCurrentPage().getByText('Loading child channels')).not.toBeVisible();
    await expect(getCurrentPage().getByText('Loading dependencies')).not.toBeVisible();
}

export async function enterTextAsField(text: string, field: string) {
    await getCurrentPage().locator(`input#${field}`).fill(text);
}

export async function clickOnTextAndConfirm(text: string) {
    getCurrentPage().on('dialog', async dialog => {
        await dialog.accept();
    });
    await getCurrentPage().getByRole('button', {name: text}).click();
}

export async function authorizeUser(user: string, password_str: string) {
    addContext('user', user);
    addContext('password', password_str);

    try {
        await getCurrentPage().goto(getAppHost(), {waitUntil: "domcontentloaded"});
    } catch (e: Error | any) {
        console.error(`The browser session could not be cleaned because there is no browser available: ${e.message}`);
    }

    try {
        const logoutButton = getCurrentPage().locator('a[href="/rhn/Logout.do"]');
        if (await logoutButton.isVisible()) {
            await logoutButton.click();
        }
    } catch (e: Error | any) {
    }

    await getCurrentPage().locator('#username-field').fill(user);
    await getCurrentPage().locator('#password-field').fill(password_str);
    await getCurrentPage().getByRole('button', {name: 'Sign In'}).click();
    await shouldBeLoggedIn();
}

export async function createUser(user: string, password: string) {
    const users = await getApiTest().user.listUsers();
    if (users.toString().includes(user)) {
        return;
    }

    await getApiTest().user.create(
        user,
        password,
        user,
        user,
        'galaxy-noise@localhost'
    );
    const roles = [
        'org_admin',
        'channel_admin',
        'config_admin',
        'system_group_admin',
        'activation_key_admin',
        'image_admin'
    ];
    for (const role of roles) {
        await getApiTest().user.addRole(user, role);
    }
}

export async function shouldBeLoggedIn() {
    const signOutButton = getCurrentPage().locator('a[href="/rhn/Logout.do"]');
    await expect(signOutButton).toBeVisible();
}

export async function navigateToSystemsOverviewPage(host: string) {
    const node = await getTarget(host);
    const systemId = await getSystemId(node);
    const overviewPage = `/rhn/systems/details/Overview.do?sid=${systemId}`;
    await getCurrentPage().goto(`${getAppHost()}${overviewPage}`);
}

export async function navigateToSystemsPageAndSearch(systemName: string) {
    await getCurrentPage().getByRole('link', {name: 'Systems'}).click();
    await getCurrentPage().getByRole('link', {name: 'System List'}).click();
    await getCurrentPage().getByRole('link', {name: 'All'}).click();
    await expect(getCurrentPage().getByText('Loading...')).not.toBeVisible();
    await enterTextAsField(systemName, 'criteria');
    await expect(getCurrentPage().getByText('Loading...')).not.toBeVisible();
    await getCurrentPage().getByRole('link', {name: systemName}).click();
    await expect(getCurrentPage().getByText('System Status')).toBeVisible();
}

export async function followLinkInContentArea(pageName: string) {
    const contentArea = getCurrentPage().locator('section');
    await contentArea.getByRole('link', {name: pageName}).click();
}

export async function followSystemLink(host: string) {
    const systemName = await getSystemName(host);
    await getCurrentPage().getByRole('link', {name: systemName}).click();
}

export async function waitUntilTableRowContainsButton(timeout: number, text: string, button: string) {
    const rowLocator = getCurrentPage().getByRole('row', {name: text});
    const buttonLocator = rowLocator.getByRole('button', {name: button});
    await expect(buttonLocator).toBeVisible({timeout: Number(timeout) * 1000});
}

export async function enterFilteredPackageName(packageName: string) {
    await getCurrentPage().locator("input[placeholder*='Filter by Package Name']").fill(packageName);
}

export async function shouldSeeText(text: string) {
    await expect(getCurrentPage().getByText(text)).toBeVisible();
}

export async function enterValueAsProperty(value: string, prop: string) {
    await getCurrentPage().locator(`input[name="${prop}"]`).fill(value);
}

export async function clickUpdateProperties() {
    await getCurrentPage().getByRole('button', {name: 'Update Properties'}).click();
}

export async function shouldSeeSystemPropertiesChangedText() {
    await expect(getCurrentPage().getByText('System properties changed')).toBeVisible();
}

export async function followLeftMenu(menuPath: string) {
    const menuLevels = menuPath.split('>').map((s: string) => s.trim());
    let currentLocator = getCurrentPage().locator('aside #nav nav');
    for (const menuLevel of menuLevels) {
        const linkLocator = currentLocator.locator(`ul > li > div > a:has-text("${menuLevel}")`).first();
        await linkLocator.click();
        currentLocator = linkLocator.locator('..').locator('..');
    }
}
