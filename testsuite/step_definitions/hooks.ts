import { BeforeAll, AfterAll } from '@cucumber/cucumber';
import { initializeBrowser, closeBrowser } from '../helpers/core/env';

BeforeAll(async function () {
    await initializeBrowser();
});

AfterAll(async function () {
    await closeBrowser();
});