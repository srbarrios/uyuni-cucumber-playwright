import {getCurrentPage, refreshPage, repeatUntilTimeout, TIMEOUTS} from '../index.js';
import {expect} from '@playwright/test';

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
    await getCurrentPage().getByRole('link', {name: 'Events'}).click();
}

export async function waitUntilSeeText(text: string) {
    await expect(getCurrentPage().getByText(text)).toBeVisible();
}

export async function followPending() {
    await getCurrentPage().getByRole('link', {name: 'Pending'}).click();
}

export async function waitUntilDoNotSeeTextRefreshingPage(text: string, timeout: number) {
    await repeatUntilTimeout(async () => {
        if (await getCurrentPage().getByText(text).isVisible({timeout: 1000})) {
            await refreshPage(getCurrentPage());
            return false;
        }
        return true;
    }, {message: `Text "${text}" is still visible after ${timeout} seconds`});
}

export async function followHistory() {
    await getCurrentPage().getByRole('link', {name: 'History'}).click();
}

export async function waitUntilSeeTextRefreshingPage(text: string) {
    await repeatUntilTimeout(async () => {
        if (await getCurrentPage().getByText(text).isVisible({timeout: 1000})) {
            return true;
        }
        await refreshPage(getCurrentPage());
        return false;
    }, {message: `Text "${text}" is not visible after timeout`});
}

export async function followFirstEvent(event: string) {
    await getCurrentPage().locator(`//a[text()="${event}"]`).first().click();
}

export async function waitUntilEventIsCompletedRefreshingPage(timeout: number) {
    await repeatUntilTimeout(async () => {
        const status = await getCurrentPage().locator('//td[text()="Status:"]/following-sibling::td').textContent();
        if (status?.includes('Completed') || status?.includes('Failed')) {
            return true;
        }
        await refreshPage(getCurrentPage());
        return false;
    }, {message: `Event not completed after ${timeout} seconds`});
}

export async function navigateToSystemsPage() {
    await getCurrentPage().getByRole('link', {name: 'Systems'}).click();
    await getCurrentPage().getByRole('link', {name: 'System List'}).click();
    await getCurrentPage().getByRole('link', {name: 'All'}).click();
    await waitUntilDoNotSeeLoadingText();
}

export async function waitUntilDoNotSeeLoadingText() {
    await expect(getCurrentPage().getByText('Loading...')).not.toBeVisible();
}

export async function waitUntilDoNotSeeText(text: string) {
    await expect(getCurrentPage().getByText(text)).not.toBeVisible();
}

export async function navigateToChannelPackages(channel: string) {
    await getCurrentPage().getByRole('link', {name: 'Software'}).click();
    await getCurrentPage().getByRole('link', {name: 'Channel List'}).click();
    await getCurrentPage().getByRole('link', {name: 'All'}).click();
    await getCurrentPage().getByRole('link', {name: channel}).click();
    await getCurrentPage().getByRole('link', {name: 'Packages'}).click();
}

export async function checkPackageVisibility(pkg: string) {
    await expect(getCurrentPage().getByText(pkg)).toBeVisible();
}

export async function scheduleReportDBUpdate() {
    await getCurrentPage().getByRole('link', {name: 'Admin'}).click();
    await getCurrentPage().getByRole('link', {name: 'Task Schedules'}).click();
    await getCurrentPage().getByRole('link', {name: 'update-reporting-default'}).click();
    await getCurrentPage().getByRole('link', {name: 'mgr-update-reporting-bunch'}).click();
    await getCurrentPage().getByRole('button', {name: 'Single Run Schedule'}).click();
    await expect(getCurrentPage().getByText('bunch was scheduled')).toBeVisible();
    await waitUntilTableContainsFinishedOrSkipped();
}

export async function waitUntilTableContainsFinishedOrSkipped() {
    await repeatUntilTimeout(async () => {
        const tableContent = await getCurrentPage().locator('table').textContent();
        return tableContent?.includes('FINISHED') || tableContent?.includes('SKIPPED');
    }, {message: 'Table did not contain "FINISHED" or "SKIPPED" in its first rows'});
}

export async function waitUntilEventIsCompleted(pickupTimeout: number, completeTimeout: number, event: string) {
    await followEvents();
    await waitUntilSeeText('Pending Events');
    await followPending();
    await waitUntilSeeText('Pending Events');
    await waitUntilDoNotSeeTextRefreshingPage(event, pickupTimeout);
    await followHistory();
    await waitUntilSeeText('System History');
    await waitUntilSeeTextRefreshingPage(event);
    await followFirstEvent(event);
    await waitUntilSeeText('This action will be executed after');
    await waitUntilSeeText(event);
    await waitUntilEventIsCompletedRefreshingPage(completeTimeout);
}

export async function checkTextInField(text: string, field: string) {
    await expect(getCurrentPage().locator(`//label[text()='${field}']/following-sibling::input`)).toHaveValue(text);
}
