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
