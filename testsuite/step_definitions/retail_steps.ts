import {Then, When} from '@cucumber/cucumber';
import {expect} from '@playwright/test';
import * as path from 'path';
import {dirname} from 'path';
import {fileURLToPath} from 'url';

import {
    getCurrentPage,
    getTarget,
    globalVars,
    PRIVATE_ADDRESSES,
    FIELD_IDS,
    BOX_IDS,
    fileInject,
    getNetPrefix,
    getPrivateNet,
    getReverseNet
} from '../helpers/index.js';
import {
    computeKiwiProfileName,
    computeKiwiProfileVersion,
    manageBranchServerRepositories,
    openImageDetailsPage,
    readBranchPrefixFromYaml,
    readTerminalsFromYaml,
    shouldSeeImageIsBuilt,
    shouldSeeLinkToDownloadImage
} from '../helpers/retail_helper.js';
import {waitForEventCompletion} from '../helpers/embedded_steps/common_helper.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

When(/^I start tftp on the proxy$/, async function () {
    const proxy = await getTarget('proxy');
    if (globalVars.product === 'Uyuni') {
        await manageBranchServerRepositories('enable', 'before');
        const cmd = 'zypper --non-interactive --ignore-unknown remove atftp && ' +
            'zypper --non-interactive install tftp && ' +
            'systemctl enable tftp.service && ' +
            'systemctl start tftp.service';
        await proxy.run(cmd);
        await manageBranchServerRepositories('disable', 'after');
    } else {
        const cmd = 'systemctl enable tftp.service && systemctl start tftp.service';
        await proxy.run(cmd);
    }
});

When(/^I set up the private network on the terminals$/, async function () {
    const proxy = getNetPrefix() + PRIVATE_ADDRESSES['proxy'];
    const nodes = [await getTarget('sle_minion')];
    const conf = "STARTMODE='auto'\\nBOOTPROTO='dhcp'";
    const file = '/etc/sysconfig/network/ifcfg-eth1';
    const script2 = "-e '/^#/d' -e 's/^search /search example.org /' -e '$anameserver " + proxy + "' -e '/^nameserver /d'";
    const file2 = '/etc/resolv.conf';
    for (const node of nodes) {
        if (!node) continue;
        await node.run(`echo -e "${conf}" > ${file} && sed -i ${script2} ${file2} && ifup eth1`);
    }

    const rhlikeNodes = [await getTarget('rhlike_minion')];
    const rhlikeFile = '/etc/sysconfig/network-scripts/ifcfg-eth1';
    const conf2 = 'GATEWAYDEV=eth0';
    const rhlikeFile2 = '/etc/sysconfig/network';
    for (const node of rhlikeNodes) {
        if (!node) continue;
        const {stdout: domain} = await node.run('grep \'^search\' /etc/resolv.conf | sed \'s/^search//\'');
        const rhlikeConf = `DOMAIN='${domain.trim()}'\\nDEVICE='eth1'\\nSTARTMODE='auto'\\nBOOTPROTO='dhcp'\\nDNS1='${proxy}'`;
        const service = node.osFamily?.match(/^rocky/) ? 'NetworkManager' : 'network';
        await node.run(`echo -e "${rhlikeConf}" > ${rhlikeFile} && echo -e "${conf2}" > ${rhlikeFile2} && systemctl restart ${service}`);
    }

    const deblikeNodes = [await getTarget('deblike_minion')];
    const source = path.join(__dirname, '../upload_files/01-netcfg.yaml');
    const dest = '/etc/netplan/01-netcfg.yaml';
    for (const node of deblikeNodes) {
        if (!node) continue;
        const success = await fileInject(node, source, dest);
        if (!success) {
            throw new Error('File injection failed');
        }
        await node.run('netplan apply');
    }

    if (globalVars.pxebootMac) {
        await this.When(/^I restart the network on the PXE boot minion$/);
    }
});

Then(/^"([^"]*)" should communicate with the server using public interface$/, async function (host) {
    const node = await getTarget(host);
    const server = await getTarget('server');
    const {returnCode: pingCode} = await node.run(`ping -n -c 1 -I ${node.publicInterface} ${server.publicIp}`, {checkErrors: false});
    if (pingCode !== 0) {
        await new Promise(resolve => setTimeout(resolve, 2000));
        await node.run(`ping -n -c 1 -I ${node.publicInterface} ${server.publicIp}`);
    }
    await server.run(`ping -n -c 1 ${node.publicIp}`);
});

When(/^I rename the proxy for Retail$/, async function () {
    const node = await getTarget('proxy');
    await node.run('sed -i "s/^proxy_fqdn:.*$/proxy_fqdn: proxy.example.org/" /etc/uyuni/proxy/config.yaml');
});

When(/^I connect the second interface of the proxy to the private network$/, async function () {
    const node = await getTarget('proxy');
    const {returnCode} = await node.run('which nmcli', {checkErrors: false});
    let cmd: string;
    if (returnCode === 0) {
        cmd = 'nmcli connection modify "Wired connection 1" ipv4.dns-priority 20 && ' +
            `nmcli device modify ${node.publicInterface} ipv4.dns-priority 20 && ` +
            'nmcli connection modify "Wired connection 2" ipv4.dns-priority 10 && ' +
            `nmcli device modify ${node.privateInterface} ipv4.dns-priority 10`;
    } else {
        const static_dns = getNetPrefix() + PRIVATE_ADDRESSES['dhcp_dns'];
        cmd = 'echo -e "BOOTPROTO=dhcp\\nSTARTMODE=auto\\n" > /etc/sysconfig/network/ifcfg-eth1 && ' +
            'ifup eth1 && ' +
            `sed -i 's/^NETCONFIG_DNS_STATIC_SERVERS=\\".*\\"/NETCONFIG_DNS_STATIC_SERVERS=\\"${static_dns}\\"/' /etc/sysconfig/network/config && ` +
            'netconfig update -f';
    }
    await node.run(cmd);
});

When(/^I restart all proxy containers$/, async function () {
    const node = await getTarget('proxy');
    await node.run('systemctl restart uyuni-proxy-httpd.service');
    await node.run('systemctl restart uyuni-proxy-salt-broker.service');
    await node.run('systemctl restart uyuni-proxy-squid.service');
    await node.run('systemctl restart uyuni-proxy-ssh.service');
    await node.run('systemctl restart uyuni-proxy-tftpd.service');
});

Then(/^the "([^"]*)" host should be present on private network$/, async function (host) {
    const node = await getTarget('proxy');
    const {returnCode, stdout} = await node.run(`ping -n -c 1 -I ${node.privateInterface} ${getNetPrefix()}${PRIVATE_ADDRESSES[host]}`);
    if (returnCode !== 0) {
        throw new Error(`Terminal ${host} does not answer on eth1: ${stdout}`);
    }
});

Then(/^name resolution should work on private network$/, async function () {
    const node = await getTarget('proxy');
    for (const dest of ['proxy.example.org', 'dns.google.com']) {
        const {returnCode, stdout} = await node.run(`host ${dest}`, {checkErrors: false});
        if (returnCode !== 0) {
            throw new Error(`Direct name resolution of ${dest} on proxy doesn't work: ${stdout}`);
        }
    }
    for (const dest of [node.privateIp, '8.8.8.8']) {
        const {returnCode, stdout} = await node.run(`host ${dest}`, {checkErrors: false});
        if (returnCode !== 0) {
            throw new Error(`Reverse name resolution of ${dest} on proxy doesn't work: ${stdout}`);
        }
    }
});

When(/^I restart the network on the PXE boot minion$/, async function () {
    const mac = globalVars.pxebootMac!.replace(/:/g, '');
    const hex = (parseInt(`${mac.substring(0, 6)}fffe${mac.substring(6, 12)}`, 16) ^ 0x0200000000000000).toString(16);
    const ipv6 = `fe80::${hex.substring(0, 4)}:${hex.substring(4, 8)}:${hex.substring(8, 12)}:${hex.substring(12, 16)}%eth1`;
    const file = 'restart-network-pxeboot.exp';
    const source = path.join(__dirname, '../upload_files/', file);
    const dest = `/tmp/${file}`;
    const success = await fileInject(await getTarget('proxy'), source, dest);
    if (!success) {
        throw new Error('File injection failed');
    }
    await (await getTarget('proxy')).run(`expect -f /tmp/${file} ${ipv6}`);
});

When(/^I reboot the (Retail|Cobbler) terminal "([^"]*)"$/, async function (context, host) {
    let mac: string;
    switch (host) {
        case 'pxeboot_minion':
            mac = globalVars.pxebootMac!;
            break;
        case 'sle12sp5_terminal':
            mac = globalVars.sle12sp5TerminalMac || 'EE:EE:EE:00:00:05';
            break;
        case 'sle15sp4_terminal':
            mac = globalVars.sle15sp4TerminalMac || 'EE:EE:EE:00:00:06';
            break;
        default:
            if (host.includes('deblike') || host.includes('debian12') || host.includes('ubuntu')) {
                const node = await getTarget(host);
                const {stdout: output} = await node.run('ip link show dev ens4');
                mac = output.split('\n')[1].split(' ')[1];
            } else {
                const node = await getTarget(host);
                const {stdout: output} = await node.run('ip link show dev eth1');
                mac = output.split('\n')[1].split(' ')[1];
            }
            break;
    }
    mac = mac.replace(/:/g, '');
    const hex = (parseInt(`${mac.substring(0, 6)}fffe${mac.substring(6, 12)}`, 16) ^ 0x0200000000000000).toString(16);
    const ipv6 = `fe80::${hex.substring(0, 4)}:${hex.substring(4, 8)}:${hex.substring(8, 12)}:${hex.substring(12, 16)}%eth1`;
    console.log(`Rebooting ${ipv6}...`);
    const file = 'reboot-pxeboot.exp';
    const source = path.join(__dirname, '../upload_files/', file);
    const dest = `/tmp/${file}`;
    const success = await fileInject(await getTarget('proxy'), source, dest);
    if (!success) {
        throw new Error('File injection failed');
    }
    await (await getTarget('proxy')).run(`expect -f /tmp/${file} ${ipv6} ${context}`);
});

When(/^I create the bootstrap script for "([^"]+)" hostname and "([^"]*)" activation key on "([^"]*)"$/, async function (hostname, key, host) {
    const node = await getTarget(host);
    await node.run(`mgr-bootstrap --hostname=${hostname} --activation-keys=${key}`);
    const {stdout} = await node.run('cat /srv/www/htdocs/pub/bootstrap/bootstrap.sh');
    if (!stdout.includes(key)) {
        throw new Error(`Key: ${key} not included`);
    }
    if (!stdout.includes(hostname)) {
        throw new Error(`Hostname: ${hostname} not included`);
    }
});

When(/^I bootstrap pxeboot minion via bootstrap script on the proxy$/, async function () {
    const file = 'bootstrap-pxeboot.exp';
    const source = path.join(__dirname, '../upload_files/', file);
    const dest = `/tmp/${file}`;
    const success = await fileInject(await getTarget('proxy'), source, dest);
    if (!success) {
        throw new Error('File injection failed');
    }
    const ipv4 = getNetPrefix() + PRIVATE_ADDRESSES['pxeboot_minion'];
    await (await getTarget('proxy')).run(`expect -f /tmp/${file} ${ipv4}`, {verbose: true});
});

When(/^I accept key of pxeboot minion in the Salt master$/, async function () {
    await (await getTarget('server')).run('salt-key -y --accept=pxeboot.example.org');
});

When(/^I install the GPG key of the test packages repository on the PXE boot minion$/, async function () {
    const file = 'uyuni.key';
    const source = path.join(__dirname, '../upload_files/', file);
    const dest = `/tmp/${file}`;
    const success = await fileInject(await getTarget('server'), source, dest);
    if (!success) {
        throw new Error('File injection failed');
    }
    const system_name = await (await getTarget('pxeboot_minion')).hostname; // Assuming getHostname exists
    await (await getTarget('server')).run(`salt-cp ${system_name} ${dest} ${dest}`);
    await (await getTarget('server')).run(`salt ${system_name} cmd.run 'rpmkeys --import ${dest}'`);
});

When(/^I wait until Salt client is inactive on the PXE boot minion$/, async function () {
    const file = 'wait-end-of-cleanup-pxeboot.exp';
    const source = path.join(__dirname, '../upload_files/', file);
    const dest = `/tmp/${file}`;
    const success = await fileInject(await getTarget('proxy'), source, dest);
    if (!success) {
        throw new Error('File injection failed');
    }
    const ipv4 = getNetPrefix() + PRIVATE_ADDRESSES['pxeboot_minion'];
    await (await getTarget('proxy')).run(`expect -f /tmp/${file} ${ipv4}`);
});

When(/^I prepare the retail configuration file on server$/, async function () {
    const source = path.join(__dirname, '../upload_files/massive-import-terminals.yml');
    const dest = '/tmp/massive-import-terminals.yml';
    const success = await fileInject(await getTarget('server'), source, dest);
    if (!success) {
        throw new Error(`File ${source} couldn't be copied to server`);
    }

    const proxyHostname = (await getTarget('proxy')).fullHostname;
    const sed_values = `s/<PROXY_HOSTNAME>/${proxyHostname}/; ` +
        `s/<NET_PREFIX>/${getNetPrefix()}/; ` +
        `s/<PROXY>/${PRIVATE_ADDRESSES['proxy']}/; ` +
        `s/<RANGE_BEGIN>/${PRIVATE_ADDRESSES['range begin']}/; ` +
        `s/<RANGE_END>/${PRIVATE_ADDRESSES['range end']}/; ` +
        `s/<PXEBOOT>/${PRIVATE_ADDRESSES['pxeboot_minion']}/; ` +
        `s/<PXEBOOT_MAC>/${globalVars.pxebootMac}/; ` +
        `s/<IMAGE>/${computeKiwiProfileName('pxeboot_minion')}/`;
    await (await getTarget('server')).run(`sed -i '${sed_values}' ${dest}`);
});

When(/^I import the retail configuration using retail_yaml command$/, async function () {
    const filepath = '/tmp/massive-import-terminals.yml';
    await (await getTarget('server')).run('retail_yaml --api-user admin --api-pass admin --from-yaml ' + filepath);
});

When(/^I follow "([^"]*)" terminal$/, async function (host) {
    const domain = readBranchPrefixFromYaml();
    if (host.includes('pxeboot')) {
        await this.When(`I follow "${host}.${domain}"`);
    } else {
        await this.When(`I follow "${domain}.${host}"`);
    }
});

Then(/^I should see the terminals imported from the configuration file$/, async function () {
    const terminals = readTerminalsFromYaml();
    for (const terminal of terminals) {
        await this.When(`I wait until I see the "${terminal}" system, refreshing the page`);
    }
});

Then(/^I should not see any terminals imported from the configuration file$/, async function () {
    const terminals = readTerminalsFromYaml();
    for (const terminal of terminals) {
        if (!terminal.includes('minion') && !terminal.includes('client')) {
            await this.Then(`I should not see a "${terminal}" text`);
        }
    }
});

When(/^I delete all the imported terminals$/, async function () {
    const terminals = readTerminalsFromYaml();
    for (const terminal of terminals) {
        if (!terminal.includes('minion') && !terminal.includes('client')) {
            console.log(`Deleting terminal with name: ${terminal}`);
            await this.When(
                `I follow "${terminal}" terminal
                And I follow "Delete System"
                And I should see a "Confirm System Profile Deletion" text
                And I click on "Delete Profile"
                Then I should see a "has been deleted" text`
            );
        }
    }
});

When(/^I enter the local IP address of "([^"]*)" in (.*) field$/, async function (host, field) {
    const fieldId = FIELD_IDS[field];
    if (!fieldId) {
        throw new Error(`Field ID for "${field}" not found.`);
    }
    await getCurrentPage().locator(`id=${fieldId}`).fill(getNetPrefix() + PRIVATE_ADDRESSES[host]);
});

When(/^I enter "([^"]*)" in (.*) field$/, async function (value, field) {
    const fieldId = FIELD_IDS[field];
    if (!fieldId) {
        throw new Error(`Field ID for "${field}" not found.`);
    }
    await getCurrentPage().locator(`id=${fieldId}`).fill(value);
});

When(/^I enter "([^"]*)" in (.*) field of (.*) zone$/, async function (value, field, zone) {
    const fieldIdSuffix = FIELD_IDS[field];
    if (!fieldIdSuffix) {
        throw new Error(`Field ID suffix for "${field}" not found.`);
    }
    const zone_xpath = `//input[@name='Name' and @value='${zone}']/ancestor::div[starts-with(@id, 'bind#available_zones#')]`;
    await getCurrentPage().locator(`${zone_xpath}//input[contains(@id, '${fieldIdSuffix}')]`).fill(value);
});

When(/^I enter the local IP address of "([^"]*)" in (.*) field of (.*) zone$/, async function (host, field, zone) {
    await this.When(`I enter "${getNetPrefix() + PRIVATE_ADDRESSES[host]}" in ${field} field of ${zone} zone`);
});

When(/^I enter the MAC address of "([^"]*)" in (.*) field$/, async function (host, field) {
    let mac: string;
    switch (host) {
        case 'pxeboot_minion':
            mac = globalVars.pxebootMac!;
            break;
        case 'sle12sp5_terminal':
            mac = globalVars.sle12sp5TerminalMac || 'EE:EE:EE:00:00:05';
            break;
        case 'sle15sp4_terminal':
            mac = globalVars.sle15sp4TerminalMac || 'EE:EE:EE:00:00:06';
            break;
        default:
            if (host.includes('deblike') || host.includes('debian12') || host.includes('ubuntu')) {
                const node = await getTarget(host);
                const {stdout: output} = await node.run('ip link show dev ens4');
                mac = output.split('\n')[1].split(' ')[1];
            } else {
                const node = await getTarget(host);
                const {stdout: output} = await node.run('ip link show dev eth1');
                mac = output.split('\n')[1].split(' ')[1];
            }
            break;
    }
    const fieldId = FIELD_IDS[field];
    if (!fieldId) {
        throw new Error(`Field ID for "${field}" not found.`);
    }
    await getCurrentPage().locator(`id=${fieldId}`).fill(`ethernet ${mac}`);
});

When(/^I enter the local zone name in (.*) field$/, async function (field) {
    const reverse_net = getReverseNet(getPrivateNet());
    console.log(`${getPrivateNet()} => ${reverse_net}`);
    await this.When(`I enter "${reverse_net}" in ${field} field`);
});

When(/^I enter the local file name in (.*) field of zone with local name$/, async function (field) {
    const reverse_filename = `master/db.${getReverseNet(getPrivateNet())}`;
    console.log(`${getPrivateNet()} => ${reverse_filename}`);
    await this.When(`I enter "${reverse_filename}" in ${field} field of zone with local name`);
});

When(/^I enter "([^"]*)" in (.*) field of zone with local name$/, async function (value, field) {
    const reverse_net = getReverseNet(getPrivateNet());
    await this.When(`I enter "${value}" in ${field} field of ${reverse_net} zone`);
});

When(/^I enter the local network in (.*) field of zone with local name$/, async function (field) {
    await this.When(`I enter "${getPrivateNet()}" in ${field} field of zone with local name`);
});

Then(/^I should see the image for "([^"]*)" is built$/, async function (host: string) {
    await shouldSeeImageIsBuilt(host);
});

Then(/^I open the details page of the image for "([^"]*)"$/, async function (host: string) {
    await openImageDetailsPage(host);
});

Then(/^I should see a link to download the image for "([^"]*)"$/, async function (host: string) {
    await shouldSeeLinkToDownloadImage(host);
});

When(/^I enter the image name for "([^"]*)" in (.*) field$/, async function (host, field) {
    const name = computeKiwiProfileName(host);
    await getCurrentPage().locator(`id=${field}`).fill(name);
});

When(/^I press "Add Item" in (.*) section$/, async function (section) {
    const sectionIds: { [key: string]: string } = {
        'host reservations': 'dhcpd#hosts#add_item',
        'config options': 'bind#config#options#add_item',
        'configured zones': 'bind#configured_zones#add_item',
        'available zones': 'bind#available_zones#add_item',
        'partitions': 'partitioning#0#partitions#add_item'
    };
    const sectionId = sectionIds[section];
    if (!sectionId) {
        throw new Error(`Section ID for "${section}" not found.`);
    }
    await getCurrentPage().locator(`id=#${sectionId}`).click();
});

When(/^I press "Add Item" in (A|NS|CNAME|for zones) section of (.*) zone$/, async function (field, zone) {
    const sectionIds: { [key: string]: string } = {
        'for zones': 'for_zones',
        'NS': 'NS#@',
        'CNAME': 'CNAME',
        'A': 'A'
    };
    const sectionId = sectionIds[field];
    if (!sectionId) {
        throw new Error(`Section ID for "${field}" not found.`);
    }
    const xpath = `//input[@name='Name' and @value='${zone}']/ancestor::div[starts-with(@id, 'bind#available_zones#')]//i[contains(@id, '##${sectionId}#add_item')]`;
    await getCurrentPage().locator(xpath).click();
});

When(/^I press "Add Item" in (A|NS|CNAME|for zones) section of zone with local name$/, async function (field) {
    const reverse_net = getReverseNet(getPrivateNet());
    await this.When(`I press "Add Item" in ${field} section of ${reverse_net} zone`);
});

When(/^I press "Remove Item" in (.*) CNAME of (.*) zone section$/, async function (aliasName, zone) {
    const cname_xpath = `//input[@name='Name' and @value='${zone}']/ancestor::div[starts-with(@id, 'bind#available_zones#')]//input[@name='Alias' and @value='${aliasName}']/ancestor::div[@class='form-group']`;
    await getCurrentPage().locator(`${cname_xpath}/button`).click();
});

When(/^I press "Remove" in the routers section$/, async function () {
    const cname_xpath = '//div[@id=\'dhcpd#subnets#0#routers#0\']/button';
    await getCurrentPage().locator(cname_xpath).click();
});

When(/^I check (.*) box$/, async function (checkboxName) {
    const boxId = BOX_IDS[checkboxName];
    if (!boxId) {
        throw new Error(`Box ID for "${checkboxName}" not found.`);
    }
    await getCurrentPage().locator(`id=${boxId}`).check();
});

When(/^I uncheck (.*) box$/, async function (checkboxName) {
    const boxId = BOX_IDS[checkboxName];
    if (!boxId) {
        throw new Error(`Box ID for "${checkboxName}" not found.`);
    }
    await getCurrentPage().locator(`id=${boxId}`).uncheck();
});

When(/^I enter the image filename for "([^"]*)" relative to profiles as "([^"]*)"$/, async function (host, field) {
    const git_profiles = process.env.GITPROFILES || '';
    const profilePath = computeKiwiProfileName(host); // Assuming this returns the filename relative to profiles
    await this.When(`I enter "${git_profiles}/${profilePath}" as "${field}"`);
});

When(/^I wait until the image build "([^"]*)" is completed$/, async function (imageName) {
    await waitForEventCompletion(`Image Build ${imageName}`, 3300);
});

When(/^I wait until the image inspection for "([^"]*)" is completed$/, async function (host) {
    const name = computeKiwiProfileName(host);
    const version = computeKiwiProfileVersion(host);
    await waitForEventCompletion(`Image Inspect 1//${name}:${version}`, 300);
});

Then(/^I should see the name of the image for "([^"]*)"$/, async function (host: string) {
    const name = computeKiwiProfileName(host);
    await expect(getCurrentPage().getByText(name)).toBeVisible();
});

Then(/^the image for "([^"]*)" should exist on the branch server$/, async function (host: string) {
    const name = computeKiwiProfileName(host);
    const version = computeKiwiProfileVersion(host);
    const proxy = await getTarget('proxy');
    const {stdout} = await proxy.run(`ls /srv/saltboot/image/${name}-${version}*.kiwi`);
    if (!stdout.includes(`${name}-${version}`)) {
        throw new Error(`Image for ${host} does not exist on the branch server`);
    }
});
