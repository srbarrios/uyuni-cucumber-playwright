import {
    followLeftMenu,
    followSystemLink,
    shouldSeeText,
    waitUntilSeeSystemRefreshingPage
} from './embedded_steps/navigation_helper.js';
import {waitUntilEventIsCompleted} from './embedded_steps/common_helper.js';

export async function waitUntilOnboardingCompleted(seconds: number, host: string) {
    const finalTimeout = Number(seconds);
    const stepTimeout = 180;
    await followLeftMenu('Systems > System List > All');
    await waitUntilSeeSystemRefreshingPage(host);
    await followSystemLink(host);
    await shouldSeeText('System Status');
    await waitUntilEventIsCompleted(stepTimeout, finalTimeout, 'Apply states');
    await waitUntilEventIsCompleted(stepTimeout, finalTimeout, 'Hardware List Refresh');
    await waitUntilEventIsCompleted(stepTimeout, finalTimeout, 'Package List Refresh');
}
