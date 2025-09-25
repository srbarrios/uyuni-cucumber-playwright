import {Given, Then, When} from '@cucumber/cucumber';
import {getCurrentPage, getFutureTime} from '../helpers/index.js';
import {checkDatePickerTitle, openDatePicker} from '../helpers/embedded_steps/datepicker_helper.js';

Given(/^I pick "([^"]*)" as date$/, async function (desiredDate) {
    const dateInput = getCurrentPage().locator('input[data-testid="date-picker"]');
    await dateInput.click();
    await dateInput.fill(desiredDate);
    await getCurrentPage().keyboard.press('Enter');
});

Then(/^the date field should be set to "([^"]*)"$/, async function (expectedDate) {
    const value = new Date(expectedDate);
    const day = await getCurrentPage().locator('input#date_day').inputValue();
    const month = await getCurrentPage().locator('input#date_month').inputValue();
    const year = await getCurrentPage().locator('input#date_year').inputValue();
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
    await getCurrentPage().locator('input[data-testid="date-picker"]').click();
});

Then(/^the date picker should be closed$/, async function () {
    if (await getCurrentPage().locator('.date-time-picker-popup').isVisible()) {
        throw new Error('The date picker is not closed');
    }
});

Then(/^the date picker title should be the current month and year$/, async function () {
    const now = new Date().toLocaleString('default', {month: 'long', year: 'numeric'});
    await checkDatePickerTitle(now);
});

Then(/^the date picker title should be "([^"]*)"$/, async function (title) {
    const datePickerTitle = getCurrentPage().locator('.react-datepicker__current-month');
    if (!await datePickerTitle.isVisible()) {
        await openDatePicker();
    }
    const text = await datePickerTitle.textContent();
    if (text !== title) {
        throw new Error('The date picker title has a different value or it can\'t be found');
    }
});

Given(/^I pick "([^"]*)" as time$/, async function (desiredTime) {
    await getCurrentPage().locator('input[data-testid="time-picker"]').click();
    await getCurrentPage().locator(`ul.react-datepicker__time-list >> text="${desiredTime}"`).click();
});

When(/^I pick "([^"]*)" as time from "([^"]*)"$/, async function (desiredTime, elementId) {
    await getCurrentPage().locator(`input[data-testid="time-picker"][id="${elementId}"]`).click();
    await getCurrentPage().locator(`ul.react-datepicker__time-list >> text="${desiredTime}"`).click();
});

When(/^I pick (\d+) minutes from now as schedule time$/, async function (minutes) {
    const futureTime = getFutureTime(Number(minutes));
    await getCurrentPage().locator('#date_timepicker_widget_input').fill(futureTime);
});

When(/^I schedule action to (\d+) minutes from now$/, async function (minutes) {
    const now = new Date();
    const futureTime = new Date(now.getTime() + Number(minutes) * 60000 + 59000);
    const actionDate = futureTime.toISOString().split('T')[0];
    const actionTime = futureTime.toTimeString().substring(0, 5);

    const dateInput = getCurrentPage().locator('input[data-testid="date-picker"]');
    await dateInput.click();
    await dateInput.fill(actionDate);
    await getCurrentPage().keyboard.press('Enter');

    const timeInput = getCurrentPage().locator('input[data-testid="time-picker"]');
    await timeInput.click();
    await timeInput.fill(actionTime);
    await getCurrentPage().keyboard.press('Enter');
});

Then(/^the time field should be set to "([^"]*)"$/, async function (expectedTime) {
    const [h, m] = expectedTime.split(':').map(Number);
    const hour = await getCurrentPage().locator('input#date_hour').inputValue();
    const minute = await getCurrentPage().locator('input#date_minute').inputValue();
    const ampm = await getCurrentPage().locator('input#date_am_pm').inputValue();
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
