import { Given, When, Then } from '@cucumber/cucumber';
import { Page, Browser, chromium, expect } from '@playwright/test';

let browser: Browser;
let page: Page;

Given('I am on the login page', async function () {
  browser = await chromium.launch({ headless: true });
  page = await browser.newPage();
  await page.goto('https://oubiti.com/login.html');
});

When('I enter valid credentials', async function () {
  await page.getByLabel('Username').fill('testuser');
  await page.getByLabel('Password').fill('testpass');
});

When('I click the login button', async function () {
  await page.getByRole('button', { name: 'Login' }).click();
});

Then('I should be redirected to a login success page', async function () {
  // Use modern Playwright expect assertions for auto-waiting and clarity
  await expect(page).toHaveURL('https://oubiti.com/login-success.html');
  await expect(page.getByText('You have successfully logged in.')).toBeVisible();
  await browser.close();
});
