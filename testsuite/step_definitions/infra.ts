import { Given, When, Then } from '@cucumber/cucumber';
import { getBrowserInstances } from '../helpers/core/env';
import { clickLinkAndWait, clickLinkOrButtonAndWait, checkTextAndCatchRequestTimeoutPopup } from '../helpers/core/commonlib';
import { getTarget } from '../helpers/system/remote_nodes_env';

// UI helpers
When('I follow the left menu {string}', async function (menuPath: string) {
    const { page } = getBrowserInstances();
    const last = String(menuPath).split('>').map((s) => s.trim()).pop() as string;
    await clickLinkAndWait(page, `a:has-text("${last}")`);
});

Then('I should see a {string} link', async function (text: string) {
    const { page } = getBrowserInstances();
    const visible = await page.getByRole('link', { name: text }).isVisible().catch(() => false);
    if (!visible) throw new Error(`Link ${text} is not visible`);
});

When('I follow {string}', async function (text: string) {
    const { page } = getBrowserInstances();
    await clickLinkAndWait(page, `a:has-text("${text}")`);
});

When('I click on {string}', async function (text: string) {
    const { page } = getBrowserInstances();
    // Try button first, fall back to link
    const button = page.getByRole('button', { name: text });
    if (await button.isVisible().catch(() => false)) {
        await clickLinkOrButtonAndWait(page, `button:has-text("${text}")`);
    } else {
        await clickLinkOrButtonAndWait(page, `a:has-text("${text}")`);
    }
});

When('I enter {string} as {string}', async function (value: string, field: string) {
    const { page } = getBrowserInstances();
    // Prefer label, fallback to id/name
    const byLabel = page.getByLabel(field);
    if (await byLabel.isVisible().catch(() => false)) {
        await byLabel.fill(value);
    } else {
        const input = page.locator(`#${field}, [name="${field}"]`).first();
        await input.fill(value);
    }
});

Then('I should see a {string} text', async function (text: string) {
    const { page } = getBrowserInstances();
    const ok = await checkTextAndCatchRequestTimeoutPopup(page, text);
    if (!ok) throw new Error(`Text '${text}' not found`);
});

When('I follow {string} in the content area', async function (link: string) {
    const { page } = getBrowserInstances();
    await clickLinkAndWait(page, `section >> a:has-text("${link}")`);
});

When('I check {string}', async function (id: string) {
    const { page } = getBrowserInstances();
    const cb = page.locator(`#${id}`);
    if (await cb.count() === 0) throw new Error(`Checkbox #${id} not found`);
    if (!(await cb.isChecked())) {
        try {
            await cb.check();
        } catch {
            await cb.click().catch(() => {});
        }
    }
    if (!(await cb.isChecked())) throw new Error(`Checkbox ${id} not checked.`);
});

// Remote/system helpers
Then('service {string} is enabled on {string}', async function (service: string, host: string) {
    const node = await getTarget(host);
    const { stdout } = await node.run(`systemctl is-enabled '${service}'`, { checkErrors: false });
    const status = (stdout || '').trim().split(/\n+/).pop();
    if (status !== 'enabled') throw new Error(`Service ${service} not enabled on ${host} (got: ${status})`);
});

Then('service {string} is active on {string}', async function (service: string, host: string) {
    const node = await getTarget(host);
    const { stdout } = await node.run(`systemctl is-active '${service}'`, { checkErrors: false });
    const status = (stdout || '').trim().split(/\n+/).pop();
    if (status !== 'active') throw new Error(`Service ${service} not active on ${host} (got: ${status})`);
});

Then('socket {string} is enabled on {string}', async function (socket: string, host: string) {
    const node = await getTarget(host);
    const { stdout } = await node.run(`systemctl is-enabled '${socket}.socket'`, { checkErrors: false });
    const status = (stdout || '').trim().split(/\n+/).pop();
    if (status !== 'enabled') throw new Error(`Socket ${socket} not enabled on ${host} (got: ${status})`);
});

Then('socket {string} is active on {string}', async function (socket: string, host: string) {
    const node = await getTarget(host);
    const { stdout } = await node.run(`systemctl is-active '${socket}.socket'`, { checkErrors: false });
    const status = (stdout || '').trim().split(/\n+/).pop();
    if (status !== 'active') throw new Error(`Socket ${socket} not active on ${host} (got: ${status})`);
});

Then('reverse resolution should work for {string}', async function (host: string) {
    const node = await getTarget(host);
    const { stdout: result, returnCode } = await node.run(`date +%s; getent hosts ${node.fullHostname}; date +%s`, { checkErrors: false });
    if (returnCode !== 0) throw new Error('cannot do reverse resolution');
    const lines = (result || '').split('\n');
    const initial = parseInt(lines[0] || '0', 10);
    const out = String(lines[1] || '');
    const end = parseInt(lines[2] || '0', 10);
    const elapsed = end - initial;
    if (elapsed > 2) throw new Error(`reverse resolution took too long (${elapsed} seconds)`);
    if (!out.includes(node.fullHostname)) throw new Error(`reverse resolution returned ${out}, expected to see ${node.fullHostname}`);
});

Then('{string} should communicate with the server using public interface', async function (host: string) {
    // Simple connectivity check to server's public hostname over HTTPS
    const server = await getTarget('server');
    const target = await getTarget(host);
    const serverName = server.fullHostname;
    const { returnCode } = await target.run(`curl -s -k --connect-timeout 10 https://${serverName}/ -o /dev/null`, { checkErrors: false });
    if (returnCode !== 0) throw new Error(`${host} cannot communicate with server ${serverName} on HTTPS`);
});

Then('the clock from {string} should be exact', async function (host: string) {
    const node = await getTarget(host);
    const { stdout: clockNode } = await node.run("date +'%s'");
    const controller = Math.floor(Date.now() / 1000);
    const diff = parseInt(String(clockNode).trim(), 10) - controller;
    if (Math.abs(diff) >= 2) throw new Error(`clocks differ by ${diff} seconds`);
});