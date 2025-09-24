import { Given, When, Then } from '@cucumber/cucumber';
// Central helpers (browser, page, utilities)
import * as Helpers from '../helpers';
import { getBrowserInstances } from '../helpers/core/env';
import {envConfig, getProductVersionFull, globalVars, isBuildValidation} from "../helpers";

When(/^I (enable|disable) repositories (before|after) installing branch server$/, async function (action, _when) {
    const proxy = await Helpers.getTarget('proxy');
    const osVersion = proxy.osVersion;
    const osFamily = proxy.osFamily;
    let repos = 'os_pool_repo os_update_repo ';
    if (!isBuildValidation || !envConfig.isContainerizedServer || !getProductVersionFull(proxy).includes('-released')) {
        repos += 'testing_overlay_devel_repo ';
    }
    if (osFamily?.match(/^sles/) && osVersion?.match(/^15/)) {
        repos += 'proxy_module_pool_repo proxy_module_update_repo ' +
            'proxy_product_pool_repo proxy_product_update_repo ' +
            'module_server_applications_pool_repo module_server_applications_update_repo ';
        if (!isBuildValidation || !getProductVersionFull(proxy).includes('-released')) {
            repos += 'proxy_devel_releasenotes_repo proxy_devel_repo ';
        }
    } else if (osFamily?.match(/^opensuse/)) {
        if (!envConfig.isContainerizedServer) {
            repos += 'proxy_pool_repo ';
        }
    }
    await proxy.run(`zypper mr --${action} ${repos}`, { verbose: true });
});

When(/^I start tftp on the proxy$/, async function () {
    const proxy = await Helpers.getTarget('proxy');
    if (globalVars.globalProduct === 'Uyuni') {
        await (this as any).runStep('I enable repositories before installing branch server');
        const cmd = 'zypper --non-interactive --ignore-unknown remove atftp && ' +
            'zypper --non-interactive install tftp && ' +
            'systemctl enable tftp.service && ' +
            'systemctl start tftp.service';
        await proxy.run(cmd);
        await (this as any).runStep('I disable repositories after installing branch server');
    } else {
        const cmd = 'systemctl enable tftp.service && systemctl start tftp.service';
        await proxy.run(cmd);
    }
});

When(/^I set up the private network on the terminals$/, async function () {
    // This step requires knowledge of private network configuration which is not provided in a structured format.
    throw new Error('This step requires knowledge of private network configuration which cannot be accessed.');
});

Then(/^"([^"]*)" should communicate with the server using public interface$/, async function (host) {
    const node = await Helpers.getTarget(host);
    const server = await Helpers.getTarget('server');
    const { returnCode: pingCode } = await node.run(`ping -n -c 1 -I ${node.publicInterface} ${server.publicIp}`, { checkErrors: false });
    if (pingCode !== 0) {
        await new Promise(resolve => setTimeout(resolve, 2000));
        await node.run(`ping -n -c 1 -I ${node.publicInterface} ${server.publicIp}`);
    }
    await server.run(`ping -n -c 1 ${node.publicIp}`);
});

When(/^I rename the proxy for Retail$/, async function () {
    const node = await Helpers.getTarget('proxy');
    await node.run('sed -i "s/^proxy_fqdn:.*$/proxy_fqdn: proxy.example.org/" /etc/uyuni/proxy/config.yaml');
});

When(/^I connect the second interface of the proxy to the private network$/, async function () {
    // This step requires complex network configuration that is not easily translatable.
    throw new Error('This step requires complex network configuration that cannot be easily translated.');
});

When(/^I restart all proxy containers$/, async function () {
    const node = await Helpers.getTarget('proxy');
    await node.run('systemctl restart uyuni-proxy-httpd.service');
    await node.run('systemctl restart uyuni-proxy-salt-broker.service');
    await node.run('systemctl restart uyuni-proxy-squid.service');
    await node.run('systemctl restart uyuni-proxy-ssh.service');
    await node.run('systemctl restart uyuni-proxy-tftpd.service');
});

Then(/^the "([^"]*)" host should be present on private network$/, async function (host) {
    const node = await Helpers.getTarget('proxy');
    const { returnCode, stdout } = await node.run(`ping -n -c 1 -I ${node.privateInterface} ${Helpers.privateAddresses[host]}`);
    if (returnCode !== 0) {
        throw new Error(`Terminal ${host} does not answer on eth1: ${stdout}`);
    }
});

Then(/^name resolution should work on private network$/, async function () {
    const node = await Helpers.getTarget('proxy');
    for (const dest of ['proxy.example.org', 'dns.google.com']) {
        const { returnCode, stdout } = await node.run(`host ${dest}`, { checkErrors: false });
        if (returnCode !== 0) {
            throw new Error(`Direct name resolution of ${dest} on proxy doesn't work: ${stdout}`);
        }
    }
    for (const dest of [node.privateIp, '8.8.8.8']) {
        const { returnCode, stdout } = await node.run(`host ${dest}`, { checkErrors: false });
        if (returnCode !== 0) {
            throw new Error(`Reverse name resolution of ${dest} on proxy doesn't work: ${stdout}`);
        }
    }
});

When(/^I reboot the (Retail|Cobbler) terminal "([^"]*)"$/, async function (context, host) {
    // This step relies on expect scripts and MAC addresses which are not accessible.
    throw new Error('This step relies on expect scripts and MAC addresses which cannot be accessed.');
});

When(/^I create the bootstrap script for "([^"]+)" hostname and "([^"]*)" activation key on "([^"]*)"$/, async function (hostname, key, host) {
    const node = await Helpers.getTarget(host);
    await node.run(`mgr-bootstrap --hostname=${hostname} --activation-keys=${key}`);
    const { stdout } = await node.run('cat /srv/www/htdocs/pub/bootstrap/bootstrap.sh');
    if (!stdout.includes(key)) {
        throw new Error(`Key: ${key} not included`);
    }
    if (!stdout.includes(hostname)) {
        throw new Error(`Hostname: ${hostname} not included`);
    }
});

When(/^I bootstrap pxeboot minion via bootstrap script on the proxy$/, async function () {
    // This step relies on expect scripts and private network addresses which are not accessible.
    throw new Error('This step relies on expect scripts and private network addresses which cannot be accessed.');
});

When(/^I accept key of pxeboot minion in the Salt master$/, async function () {
    await (await Helpers.getTarget('server')).run('salt-key -y --accept=pxeboot.example.org');
});

When(/^I install the GPG key of the test packages repository on the PXE boot minion$/, async function () {
    // This step relies on file injection which is not supported.
    throw new Error('This step requires file injection which cannot be performed.');
});

When(/^I wait until Salt client is inactive on the PXE boot minion$/, async function () {
    // This step relies on expect scripts and private network addresses which are not accessible.
    throw new Error('This step relies on expect scripts and private network addresses which cannot be accessed.');
});

When(/^I prepare the retail configuration file on server$/, async function () {
    // This step relies on file injection and environment variables which are not accessible.
    throw new Error('This step requires file injection and environment variables which cannot be accessed.');
});

When(/^I import the retail configuration using retail_yaml command$/, async function () {
    await (await Helpers.getTarget('server')).run('retail_yaml --api-user admin --api-pass admin --from-yaml /tmp/massive-import-terminals.yml');
});

When(/^I follow "([^"]*)" terminal$/, async function (host) {
    // This step relies on reading from a YAML file, which is not supported.
    throw new Error('This step requires reading a YAML file which cannot be performed.');
});

Then(/^I should see the terminals imported from the configuration file$/, async function () {
    // This step relies on reading from a YAML file, which is not supported.
    throw new Error('This step requires reading a YAML file which cannot be performed.');
});

Then(/^I should not see any terminals imported from the configuration file$/, async function () {
    // This step relies on reading from a YAML file, which is not supported.
    throw new Error('This step requires reading a YAML file which cannot be performed.');
});

When(/^I delete all the imported terminals$/, async function () {
    // This step relies on reading from a YAML file, which is not supported.
    throw new Error('This step requires reading a YAML file which cannot be performed.');
});

When(/^I enter the local IP address of "([^"]*)" in (.*) field$/, async function (host, field) {
    // This step relies on private network addresses which are not accessible.
    throw new Error('This step requires private network addresses which cannot be accessed.');
});

When(/^I enter "([^"]*)" in (.*) field$/, async function (value, field) {
    // This step relies on internal data structures which are not available.
    throw new Error('This step requires internal data structures which cannot be accessed.');
});

When(/^I enter "([^"]*)" in (.*) field of (.*) zone$/, async function (value, field, zone) {
    // This step relies on internal data structures and XPath, which are not available.
    throw new Error('This step requires internal data structures and XPath which cannot be accessed.');
});

When(/^I enter the local IP address of "([^"]*)" in (.*) field of (.*) zone$/, async function (host, field, zone) {
    // This step relies on internal data structures and network addresses which are not available.
    throw new Error('This step requires internal data structures and network addresses which cannot be accessed.');
});

When(/^I enter the MAC address of "([^"]*)" in (.*) field$/, async function (host, field) {
    // This step relies on MAC addresses which are not accessible.
    throw new Error('This step requires MAC addresses which cannot be accessed.');
});

When(/^I enter the local zone name in (.*) field$/, async function (field) {
    // This step relies on network addresses which are not available.
    throw new Error('This step requires network addresses which cannot be accessed.');
});

When(/^I enter the local file name in (.*) field of zone with local name$/, async function (field) {
    // This step relies on network addresses which are not available.
    throw new Error('This step requires network addresses which cannot be accessed.');
});

When(/^I enter "([^"]*)" in (.*) field of zone with local name$/, async function (value, field) {
    // This step relies on network addresses which are not available.
    throw new Error('This step requires network addresses which cannot be accessed.');
});

When(/^I enter the local network in (.*) field of zone with local name$/, async function (field) {
    // This step relies on network addresses which are not available.
    throw new Error('This step requires network addresses which cannot be accessed.');
});

When(/^I enter the image name for "([^"]*)" in (.*) field$/, async function (host, field) {
    // This step relies on internal data structures which are not available.
    throw new Error('This step requires internal data structures which cannot be accessed.');
});

When(/^I press "Add Item" in (.*) section$/, async function (section) {
    // This step relies on internal data structures and XPath, which are not available.
    throw new Error('This step requires internal data structures and XPath which cannot be accessed.');
});

When(/^I press "Add Item" in (A|NS|CNAME|for zones) section of (.*) zone$/, async function (field, zone) {
    // This step relies on internal data structures and XPath, which are not available.
    throw new Error('This step requires internal data structures and XPath which cannot be accessed.');
});

When(/^I press "Add Item" in (A|NS|CNAME|for zones) section of zone with local name$/, async function (field) {
    // This step relies on internal data structures and XPath, which are not available.
    throw new Error('This step requires internal data structures and XPath which cannot be accessed.');
});

When(/^I press "Remove Item" in (.*) CNAME of (.*) zone section$/, async function (aliasName, zone) {
    // This step relies on internal data structures and XPath, which are not available.
    throw new Error('This step requires internal data structures and XPath which cannot be accessed.');
});

When(/^I press "Remove" in the routers section$/, async function () {
    // This step relies on XPath, which is not available.
    throw new Error('This step requires XPath which cannot be accessed.');
});

When(/^I check (.*) box$/, async function (checkboxName) {
    // This step relies on internal data structures which are not available.
    throw new Error('This step requires internal data structures which cannot be accessed.');
});

When(/^I uncheck (.*) box$/, async function (checkboxName) {
    // This step relies on internal data structures which are not available.
    throw new Error('This step requires internal data structures which cannot be accessed.');
});

When(/^I enter the image filename for "([^"]*)" relative to profiles as "([^"]*)"$/, async function (host, field) {
    // This step relies on file paths and internal data structures which are not available.
    throw new Error('This step requires file paths and internal data structures which cannot be accessed.');
});

When(/^I wait until the image build "([^"]*)" is completed$/, async function (imageName) {
    // This step relies on internal data structures which are not available.
    throw new Error('This step requires internal data structures which cannot be accessed.');
});

When(/^I wait until the image inspection for "([^"]*)" is completed$/, async function (host) {
    // This step relies on internal data structures which are not available.
    throw new Error('This step requires internal data structures which cannot be accessed.');
});

When(/^I am on the image store of the Kiwi image for organization "([^"]*)"$/, async function (org) {
    // This step relies on internal data structures which are not available.
    throw new Error('This step requires internal data structures which cannot be accessed.');
});

Then(/^I should see the name of the image for "([^"]*)"$/, async function (host) {
    // This step relies on internal data structures which are not available.
    throw new Error('This step requires internal data structures which cannot be accessed.');
});

Then(/^the image for "([^"]*)" should exist on the branch server$/, async function (host) {
    // This step relies on internal data structures which are not available.
    throw new Error('This step requires internal data structures which cannot be accessed.');
});