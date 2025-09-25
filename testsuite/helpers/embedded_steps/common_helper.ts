import { getBrowserInstances, refreshPage, repeatUntilTimeout, TIMEOUTS, getTarget, globalVars, getApiTest, getSystemName, getUptimeFromHost, getValidUptimeMessages, envConfig, isBuildValidation, getProductVersionFull, BASE_CHANNEL_BY_CLIENT, getChecksumPath, validateChecksumWithFile, getContext } from '../index.js';
import { expect } from '@playwright/test';
import * as path from 'path';
import { dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Helper functions for common embedded_steps
export async function waitForEventCompletion(event: string, timeout: number = TIMEOUTS.long) {
    // This function will encapsulate the logic for 'I wait at most {int} seconds until event "{event}" is completed'
    // For now, it will contain the nested embedded_steps.
    // The actual implementation will be extracted from the step definition.
    await followEvents();
    await waitUntilSeeText('Pending Events');
    await followPending();
    await waitUntilSeeText('Pending Events');
    await waitUntilDoNotSeeTextRefreshingPage(event, timeout);
    await followHistory();
    await waitUntilSeeText('System History');
    await waitUntilSeeTextRefreshingPage(event);
    await followFirstEvent(event);
    await waitUntilSeeText('This action will be executed after');
    await waitUntilSeeText(event);
    await waitUntilEventIsCompletedRefreshingPage(timeout);
}

export async function followEvents() {
    const { page } = getBrowserInstances();
    await page.getByRole('link', { name: 'Events' }).click();
}

export async function waitUntilSeeText(text: string) {
    const { page } = getBrowserInstances();
    await expect(page.getByText(text)).toBeVisible();
}

export async function followPending() {
    const { page } = getBrowserInstances();
    await page.getByRole('link', { name: 'Pending' }).click();
}

export async function waitUntilDoNotSeeTextRefreshingPage(text: string, timeout: number) {
    const { page } = getBrowserInstances();
    await repeatUntilTimeout(async () => {
        if (await page.getByText(text).isVisible({ timeout: 1000 })) {
            await refreshPage(page);
            return false;
        }
        return true;
    }, { message: `Text "${text}" is still visible after ${timeout} seconds` });
}

export async function followHistory() {
    const { page } = getBrowserInstances();
    await page.getByRole('link', { name: 'History' }).click();
}

export async function waitUntilSeeTextRefreshingPage(text: string) {
    const { page } = getBrowserInstances();
    await repeatUntilTimeout(async () => {
        if (await page.getByText(text).isVisible({ timeout: 1000 })) {
            return true;
        }
        await refreshPage(page);
        return false;
    }, { message: `Text "${text}" is not visible after timeout` });
}

export async function followFirstEvent(event: string) {
    const { page } = getBrowserInstances();
    await page.locator(`//a[text()="${event}"]`).first().click();
}

export async function waitUntilEventIsCompletedRefreshingPage(timeout: number) {
    const { page } = getBrowserInstances();
    await repeatUntilTimeout(async () => {
        const status = await page.locator('//td[text()="Status:"]/following-sibling::td').textContent();
        if (status?.includes('Completed') || status?.includes('Failed')) {
            return true;
        }
        await refreshPage(page);
        return false;
    }, { message: `Event not completed after ${timeout} seconds` });
}

export async function navigateToSystemsPage() {
    const { page } = getBrowserInstances();
    await page.getByRole('link', { name: 'Systems' }).click();
    await page.getByRole('link', { name: 'System List' }).click();
    await page.getByRole('link', { name: 'All' }).click();
    await waitUntilDoNotSeeLoadingText();
}

export async function waitUntilDoNotSeeLoadingText() {
    const { page } = getBrowserInstances();
    await expect(page.getByText('Loading...')).not.toBeVisible();
}

export async function waitUntilDoNotSeeText(text: string) {
    const { page } = getBrowserInstances();
    await expect(page.getByText(text)).not.toBeVisible();
}

export async function navigateToChannelPackages(channel: string) {
    const { page } = getBrowserInstances();
    await page.getByRole('link', { name: 'Software' }).click();
    await page.getByRole('link', { name: 'Channel List' }).click();
    await page.getByRole('link', { name: 'All' }).click();
    await page.getByRole('link', { name: channel }).click();
    await page.getByRole('link', { name: 'Packages' }).click();
}

export async function checkPackageVisibility(pkg: string) {
    const { page } = getBrowserInstances();
    await expect(page.getByText(pkg)).toBeVisible();
}

export async function scheduleReportDBUpdate() {
    const { page } = getBrowserInstances();
    await page.getByRole('link', { name: 'Admin' }).click();
    await page.getByRole('link', { name: 'Task Schedules' }).click();
    await page.getByRole('link', { name: 'update-reporting-default' }).click();
    await page.getByRole('link', { name: 'mgr-update-reporting-bunch' }).click();
    await page.getByRole('button', { name: 'Single Run Schedule' }).click();
    await expect(page.getByText('bunch was scheduled')).toBeVisible();
    await waitUntilTableContainsFinishedOrSkipped();
}

export async function waitUntilTableContainsFinishedOrSkipped() {
    const { page } = getBrowserInstances();
    await repeatUntilTimeout(async () => {
        const tableContent = await page.locator('table').textContent();
        return tableContent?.includes('FINISHED') || tableContent?.includes('SKIPPED');
    }, { message: 'Table did not contain "FINISHED" or "SKIPPED" in its first rows' });
}
