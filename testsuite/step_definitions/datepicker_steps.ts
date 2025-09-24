import { Given, When, Then } from '@cucumber/cucumber';
import { getBrowserInstances } from '../helpers/core/env';

Given(/^I pick "([^"]*)" as date$/, async function (desiredDate) {
    const { page } = getBrowserInstances();
    const dateInput = page.locator('input[data-testid="date-picker"]');
    await dateInput.click();
    await dateInput.fill(desiredDate);
    await page.keyboard.press('Enter');
});

Then(/^the date field should be set to "([^"]*)"$/, async function (expectedDate) {
    const { page } = getBrowserInstances();
    const value = new Date(expectedDate);
    const day = await page.locator('input#date_day').inputValue();
    const month = await page.locator('input#date_month').inputValue();
    const year = await page.locator('input#date_year').inputValue();
    if (parseInt(day) !== value.getUTCDate()) {
        throw new Error(`Day value is incorrect. Expected: ${value.getUTCDate()}, Got: ${day}`);
    }
    if (parseInt(month) !== value.getUTCMonth()) {
        throw new Error(`Month value is incorrect. Expected: ${value.getUTCMonth()}, Got: ${month}`);
    }
    if (parseInt(year) !== value.getUTCFullYear()) {
        throw new Error(`Year value is incorrect. Expected: ${value.getUTCFullYear()}, Got: ${year}`);
    }
});

Given(/^I open the date picker$/, async function () {
    const { page } = getBrowserInstances();
    await page.locator('input[data-testid="date-picker"]').click();
});

Then(/^the date picker should be closed$/, async function () {
    const { page } = getBrowserInstances();
    if (await page.locator('.date-time-picker-popup').isVisible()) {
        throw new Error('The date picker is not closed');
    }
});

Then(/^the date picker title should be the current month and year$/, async function () {
    const { page } = getBrowserInstances();
    const now = new Date().toLocaleString('default', { month: 'long', year: 'numeric' });
    await (this as any).runStep(`the date picker title should be "${now}"`);
});

Then(/^the date picker title should be "([^"]*)"$/, async function (title) {
    const { page } = getBrowserInstances();
    const datePickerTitle = page.locator('.react-datepicker__current-month');
    if (!await datePickerTitle.isVisible()) {
        await (this as any).runStep('I open the date picker');
    }
    const text = await datePickerTitle.textContent();
    if (text !== title) {
        throw new Error('The date picker title has a different value or it can\'t be found');
    }
});

Given(/^I pick "([^"]*)" as time$/, async function (desiredTime) {
    const { page } = getBrowserInstances();
    await page.locator('input[data-testid="time-picker"]').click();
    await page.locator(`ul.react-datepicker__time-list >> text="${desiredTime}"`).click();
});

When(/^I pick "([^"]*)" as time from "([^"]*)"$/, async function (desiredTime, elementId) {
    const { page } = getBrowserInstances();
    await page.locator(`input[data-testid="time-picker"][id="${elementId}"]`).click();
    await page.locator(`ul.react-datepicker__time-list >> text="${desiredTime}"`).click();
});

When(/^I pick (\d+) minutes from now as schedule time$/, async function (minutes) {
    const { page } = getBrowserInstances();
    const futureTime = (await import('../helpers')).getFutureTime(Number(minutes));
    await page.locator('#date_timepicker_widget_input').fill(futureTime);
});

When(/^I schedule action to (\d+) minutes from now$/, async function (minutes) {
    const { page } = getBrowserInstances();
    const now = new Date();
    const futureTime = new Date(now.getTime() + Number(minutes) * 60000 + 59000);
    const actionDate = futureTime.toISOString().split('T')[0];
    const actionTime = futureTime.toTimeString().substring(0, 5);

    const dateInput = page.locator('input[data-testid="date-picker"]');
    await dateInput.click();
    await dateInput.fill(actionDate);
    await page.keyboard.press('Enter');

    const timeInput = page.locator('input[data-testid="time-picker"]');
    await timeInput.click();
    await timeInput.fill(actionTime);
    await page.keyboard.press('Enter');
});

Then(/^the time field should be set to "([^"]*)"$/, async function (expectedTime) {
    const { page } = getBrowserInstances();
    const [h, m] = expectedTime.split(':').map(Number);
    const hour = await page.locator('input#date_hour').inputValue();
    const minute = await page.locator('input#date_minute').inputValue();
    const ampm = await page.locator('input#date_am_pm').inputValue();
    const hourValue = parseInt(hour, 10);
    const minuteValue = parseInt(minute, 10);
    const ampmValue = parseInt(ampm, 10);

    if (hourValue !== (h % 12 === 0 ? 12 : h % 12)) {
        throw new Error('invalid hidden hour');
    }
    if (minuteValue !== m) {
        throw new Error('invalid hidden minute');
    }
    if (ampmValue !== (h >= 12 ? 1 : 0)) {
        throw new Error('invalid hidden AM/PM');
    }
});