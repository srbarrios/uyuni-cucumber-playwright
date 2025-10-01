import {
    addContext,
    clickButtonAndWait,
    clickLinkAndWait, getApiTest,
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
    try {
        await getCurrentPage().locator(`select#${field}`).selectOption(option);
    } catch (e) {
        await getCurrentPage().locator(`div[data-testid="${field}-child__control"]`).click();
        await getCurrentPage().locator(`div[data-testid="${field}-child__option"]`).filter({hasText: option}).first().click();
    }
}

export async function waitUntilDoNotSeeLoadingTexts() {
    await expect(getCurrentPage().getByText('Loading...')).not.toBeVisible();
    await expect(getCurrentPage().getByText('Loading child channels..')).not.toBeVisible();
    await expect(getCurrentPage().getByText('Loading dependencies..')).not.toBeVisible();
}

export async function enterTextAsField(text: string, field: string) {
    await getCurrentPage().locator(`input#${field}`).fill(text);
}

export async function clickOnTextAndConfirm(text: string) {
    getCurrentPage().on('dialog', async dialog => {
        await dialog.accept();
    });
    await clickButtonAndWait(getCurrentPage(), text);
}

export async function authorizeUser(user: string, password_str: string) {
    addContext('user', user);
    addContext('password', password_str);
    try {
        await getCurrentPage().goto(getAppHost());
    } catch (e: Error | any) {
        console.log(`The browser session could not be cleaned because there is no browser available: ${e.message}`);
    }
    await getCurrentPage().waitForLoadState('networkidle');
    const logoutButton = await getCurrentPage().getByRole('button', {name: 'Sign Out'});
    if (await logoutButton.isVisible()) {
        await logoutButton.click();
    }

    await getCurrentPage().goto(getAppHost());
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
    await getCurrentPage().waitForLoadState('networkidle');
    const signOutButton = await getCurrentPage().getByRole('button', {name: 'Sign Out'});
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
    await clickLinkAndWait(getCurrentPage(), undefined, systemName);
    await expect(getCurrentPage().getByText('System Status')).toBeVisible();
}

export async function followLinkInContentArea(pageName: string) {
    const contentArea = getCurrentPage().locator('section');
    await clickLinkAndWait(getCurrentPage(), contentArea, pageName);
}

export async function followSystemLink(host: string) {
    const systemName = await getSystemName(host);
    await clickLinkAndWait(getCurrentPage(), undefined, systemName);
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
    await clickButtonAndWait(getCurrentPage(), 'Update Properties');
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
