import { Given, When, Then } from '@cucumber/cucumber';
// Central helpers (browser, page, utilities)
import * as Monitoring from '../helpers/system/system_monitoring';
import {QualityIntelligence} from "../helpers";

When(/^I report the bootstrap duration for "([^"]*)"$/, async function (host) {
    if (!Helpers.qualityIntelligenceMode) return;
    const duration = await Monitoring.getLastBootstrapDuration(host);
    await QualityIntelligence.pushBootstrapDuration(host, duration);
});

When(/^I report the onboarding duration for "([^"]*)"$/, async function (host) {
    if (!Helpers.qualityIntelligenceMode) return;
    const duration = await Monitoring.getLastOnboardingDuration(host);
    await QualityIntelligence.pushOnboardingDuration(host, duration);
});

When(/^I report the synchronization duration for "([^"]*)"$/, async function (product) {
    if (!Helpers.qualityIntelligenceMode) return;
    const duration = await Monitoring.getProductSynchronizationDuration(product);
    await QualityIntelligence.pushSynchronizationDuration(product, duration);
});