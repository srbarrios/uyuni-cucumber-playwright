import {When} from '@cucumber/cucumber';
import * as Monitoring from '../helpers/system/system_monitoring.js';
import {envConfig, getCurrentPage, globalVars} from "../helpers/index.js";
import {expect} from "@playwright/test";

When(/^I report the bootstrap duration for "([^"]*)"$/, async function (host) {
    if (!envConfig.qualityIntelligenceMode) return;
    const duration = await Monitoring.getLastBootstrapDuration(host);
    await globalVars.qualityIntelligence!.pushBootstrapDuration(host, duration);
});

When(/^I report the onboarding duration for "([^"]*)"$/, async function (host) {
    if (!envConfig.qualityIntelligenceMode) return;
    const duration = await Monitoring.getLastOnboardingDuration(host);
    await globalVars.qualityIntelligence!.pushOnboardingDuration(host, duration);
});

When(/^I report the synchronization duration for "([^"]*)"$/, async function (product) {
    if (!envConfig.qualityIntelligenceMode) return;
    const duration = await Monitoring.getProductSynchronizationDuration(product);
    await globalVars.qualityIntelligence!.pushSynchronizationDuration(product, duration);
});

When(/^I check "([^"]*)" exporter$/, async function (exporter_type) {
    const checkbox = getCurrentPage().locator(`exporters#${exporter_type}_exporter#enabled`);
    await checkbox.check();
    await expect(checkbox).toBeChecked();
});
