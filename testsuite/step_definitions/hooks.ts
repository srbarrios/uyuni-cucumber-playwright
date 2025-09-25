import {AfterAll, BeforeAll, setDefaultTimeout} from '@cucumber/cucumber';
import {closeBrowser, initializeBrowser} from '../helpers/index.js';

setDefaultTimeout(10 * 1000);

BeforeAll(async function () {
    await initializeBrowser();
});

AfterAll(async function () {
    await closeBrowser();
});
