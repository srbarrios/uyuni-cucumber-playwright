import {Then, When} from '@cucumber/cucumber';

import {fileDelete, getTarget} from '../helpers/index.js';

When(/^I destroy "([^"]*)" directory on server$/, async function (directory) {
    await (await getTarget('server')).run(`rm -rf ${directory}`);
});

When(/^I destroy "([^"]*)" directory on "([^"]*)"$/, async function (directory, host) {
    const node = await getTarget(host);
    await node.run(`rm -rf ${directory}`);
});

When(/^I remove "([^"]*)" from "([^"]*)"$/, async function (filename, host) {
    const node = await getTarget(host);
    await fileDelete(node, filename);
});

Then(/^file "([^"]*)" should exist on server$/, async function (filename) {
    await (await getTarget('server')).run(`test -f ${filename}`);
});

Then(/^file "([^"]*)" should exist on "([^"]*)"$/, async function (filename, host) {
    const node = await getTarget(host);
    await node.run(`test -f ${filename}`);
});

Then(/^file "([^"]*)" should have ([0-9]+) permissions on "([^"]*)"$/, async function (filename, permissions, host) {
    const node = await getTarget(host);
    await node.run(`test \`stat -c '%a' ${filename}\` = "${permissions}"`);
});

Then(/^file "([^"]*)" should not exist on server$/, async function (filename) {
    await (await getTarget('server')).run(`test ! -f ${filename}`);
});

Then(/^file "([^"]*)" should not exist on "([^"]*)"$/, async function (filename, host) {
    const node = await getTarget(host);
    await node.run(`test ! -f ${filename}`);
});

When(/^I store "([^"]*)" into file "([^"]*)" on "([^"]*)"$/, async function (content, filename, host) {
    const node = await getTarget(host);
    await node.run(`echo "${content}" > ${filename}`, {timeout: 600});
});

When(/^I bootstrap "([^"]*)" using bootstrap script with activation key "([^"]*)" from the (server|proxy)$/, async function (host, key, targetType) {
    // This step relies on file injection and expect scripts which are not supported.
    throw new Error('This step requires file injection and expect scripts which cannot be performed.');
});

Then(/^file "([^"]*)" should contain "([^"]*)" on "([^"]*)"$/, async function (filename, content, host) {
    const node = await getTarget(host);
    await node.run(`test -f ${filename}`);
    await node.run(`grep "${content}" ${filename}`);
});

Then(/^I remove server hostname from hosts file on "([^"]*)"$/, async function (host) {
    const node = await getTarget(host);
    await node.run(`sed -i 's/${(await getTarget('server')).fullHostname}//' /etc/hosts`);
});

When(/^I ensure folder "([^"]*)" doesn't exist on "([^"]*)"$/, async function (folder: string, host: string) {
    const node = await getTarget(host);
    await node.run(`rm -rf ${folder}`);
});

When(/^I export config channels "([^"]*)" with ISS v2 to "([^"]*)"$/, async function (channels: string, folder: string) {
    const server = await getTarget('server');
    await server.run(`mgr-sync export --channels ${channels} --path ${folder}`);
});

Then(/^"([^"]*)" folder on server is ISS v2 export directory$/, async function (folder: string) {
    const server = await getTarget('server');
    await server.run(`test -d ${folder}/config_channels`);
    await server.run(`test -f ${folder}/config_channels/metadata.json`);
});

When(/^I import data with ISS v2 from "([^"]*)"$/, async function (folder: string) {
    const server = await getTarget('server');
    await server.run(`mgr-sync import --path ${folder}`);
});

When(/^I export software channels "([^"]*)" with ISS v2 to "([^"]*)"$/, async function (channels: string, folder: string) {
    const server = await getTarget('server');
    await server.run(`mgr-sync export --channels ${channels} --path ${folder}`);
});

Then(/^the susemanager repo file should exist on the "([^"]*)"$/, async function (host: string) {
    const node = await getTarget(host);
    await node.run('test -f /etc/zypp/repos.d/susemanager:fake-rpm-suse-channel.repo');
});

Then(/^the repo file should contain the (normal|custom) download endpoint on the "([^"]*)"$/, async function (type: string, host: string) {
    const node = await getTarget(host);
    let expectedContent: string;
    if (type === 'normal') {
        expectedContent = 'baseurl=http://download.suse.de/repositories/systemsmanagement:/Uyuni:/Stable/images/';
    } else {
        expectedContent = 'baseurl=https://download.suse.de/repositories/systemsmanagement:/Uyuni:/Stable/images/';
    }
    await node.run(`grep -q "${expectedContent}" /etc/zypp/repos.d/susemanager:fake-rpm-suse-channel.repo`);
});
