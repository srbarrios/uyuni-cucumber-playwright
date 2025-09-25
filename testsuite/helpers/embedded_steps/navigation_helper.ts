import {
    getBrowserInstances,
    refreshPage,
    repeatUntilTimeout,
    TIMEOUTS,
    getAppHost,
    getSystemName,
    getSystemId,
    addContext,
    getContext,
    getTarget,
    globalVars,
    BASE_CHANNEL_BY_CLIENT,
    PACKAGE_BY_CLIENT,
    PKGARCH_BY_CLIENT,
    envConfig,
    clickButtonAndWait,
    clickLinkAndWait,
    getFutureTime,
    timeouts
} from '../index.js';
import { expect } from '@playwright/test';

// Helper functions for navigation embedded_steps

export async function waitUntilSeeSystemRefreshingPage(systemName: string) {
    const { page } = getBrowserInstances();
    await repeatUntilTimeout(async () => {
        if (await page.getByText(systemName).isVisible({ timeout: 3000 })) return true;
        await refreshPage(page);
        return false;
    }, { message: `Couldn't find the system name of "${systemName}"` });
}

export async function waitUntilDoNotSeeTextRefreshingPage(text: string) {
    const { page } = getBrowserInstances();
    await repeatUntilTimeout(async () => {
        if (!await page.getByText(text).isVisible({ timeout: 3000 })) return true;
        await refreshPage(page);
        return false;
    }, { message: `Text '${text}' is still visible` });
}

export async function selectOptionFromField(option: string, field: string) {
    const { page } = getBrowserInstances();
    try {
        await page.locator(`select#${field}`).selectOption(option);
    } catch (e) {
        await page.locator(`div[data-testid="${field}-child__control"]`).click();
        await page.locator(`div[data-testid="${field}-child__option"]`).filter({ hasText: option }).first().click();
    }
}

export async function waitUntilDoNotSeeLoadingTexts() {
    const { page } = getBrowserInstances();
    await expect(page.getByText('Loading...')).not.toBeVisible();
    await expect(page.getByText('Loading child channels..')).not.toBeVisible();
    await expect(page.getByText('Loading dependencies..')).not.toBeVisible();
}

export async function enterTextAsField(text: string, field: string) {
    const { page } = getBrowserInstances();
    await page.locator(`input#${field}`).fill(text);
}

export async function clickOnTextAndConfirm(text: string) {
    const { page } = getBrowserInstances();
    page.on('dialog', async dialog => {
        await dialog.accept();
    });
    await clickButtonAndWait(page, text);
}

export async function authorizeUser(user: string, password_str: string) {
    const { page } = getBrowserInstances();
    addContext('user', user);
    addContext('password', password_str);
    try {
        await page.goto(getAppHost());
    } catch (e: Error | any) {
        console.log(`The browser session could not be cleaned because there is no browser available: ${e.message}`);
    }
    const logoutLink = page.getByRole('button', { name: 'Sign Out' });
    if (await logoutLink.isVisible()) {
        await logoutLink.click();
    }
    await page.goto(getAppHost());
    await page.locator('#username-field').fill(user);
    await page.locator('#password-field').fill(password_str);
    await page.getByRole('button', { name: 'Sign In' }).click();
    await shouldBeLoggedIn();
}

export async function shouldBeLoggedIn() {
    const { page } = getBrowserInstances();
    const logoutLink = page.getByRole('button', { name: 'Sign Out' });
    await expect(logoutLink).toBeVisible();
}

export async function navigateToSystemsOverviewPage(host: string) {
    const { page } = getBrowserInstances();
    const node = await getTarget(host);
    const systemId = await getSystemId(node);
    const overviewPage = `/rhn/systems/details/Overview.do?sid=${systemId}`;
    await page.goto(`${getAppHost()}${overviewPage}`);
}

export async function navigateToSystemsPageAndSearch(systemName: string) {
    const { page } = getBrowserInstances();
    await page.getByRole('link', { name: 'Systems' }).click();
    await page.getByRole('link', { name: 'System List' }).click();
    await page.getByRole('link', { name: 'All' }).click();
    await expect(page.getByText('Loading...')).not.toBeVisible();
    await enterTextAsField(systemName, 'criteria');
    await expect(page.getByText('Loading...')).not.toBeVisible();
    await clickLinkAndWait(page, undefined, systemName);
    await expect(page.getByText('System Status')).toBeVisible();
}

export async function followLinkInContentArea(pageName: string) {
    const { page } = getBrowserInstances();
    const contentArea = page.locator('section');
    await clickLinkAndWait(page, contentArea, pageName);
}

export async function followSystemLink(host: string) {
    const { page } = getBrowserInstances();
    const systemName = await getSystemName(host);
    await clickLinkAndWait(page, undefined, systemName);
}

export async function waitUntilTableRowContainsButton(timeout: number, text: string, button: string) {
    const { page } = getBrowserInstances();
    const rowLocator = page.getByRole('row', { name: text });
    const buttonLocator = rowLocator.getByRole('button', { name: button });
    await expect(buttonLocator).toBeVisible({ timeout: Number(timeout) * 1000 });
}

export async function enterFilteredPackageName(packageName: string) {
    const { page } = getBrowserInstances();
    await page.locator("input[placeholder*='Filter by Package Name']").fill(packageName);
}

export async function shouldSeeText(text: string) {
    const { page } = getBrowserInstances();
    await expect(page.getByText(text)).toBeVisible();
}

export async function enterValueAsProperty(value: string, prop: string) {
    const { page } = getBrowserInstances();
    await page.locator(`input[name="${prop}"]`).fill(value);
}

export async function clickUpdateProperties() {
    const { page } = getBrowserInstances();
    await clickButtonAndWait(page, 'Update Properties');
}

export async function shouldSeeSystemPropertiesChangedText() {
    const { page } = getBrowserInstances();
    await expect(page.getByText('System properties changed')).toBeVisible();
}

export async function followLeftMenu(menuPath: string) {
    const { page } = getBrowserInstances();
    const menuLevels = menuPath.split('>').map((s: string) => s.trim());
    let currentLocator = page.locator('aside #nav nav');
    for (const menuLevel of menuLevels) {
        const linkLocator = currentLocator.locator(`ul > li > div > a:has-text("${menuLevel}")`);
        await linkLocator.click();
        currentLocator = linkLocator.locator('..').locator('..');
    }
}
