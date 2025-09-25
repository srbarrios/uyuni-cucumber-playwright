import { getBrowserInstances } from '../index.js';

export async function checkDatePickerTitle(title: string) {
    const { page } = getBrowserInstances();
    const datePickerTitle = page.locator('.react-datepicker__current-month');
    const text = await datePickerTitle.textContent();
    if (text !== title) {
        throw new Error('The date picker title has a different value or it can\'t be found');
    }
}

export async function openDatePicker() {
    const { page } = getBrowserInstances();
    await page.locator('input[data-testid="date-picker"]').click();
}
