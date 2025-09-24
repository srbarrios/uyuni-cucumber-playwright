import { Given, When, Then } from '@cucumber/cucumber';
// Central helpers (browser, page, utilities)
import * as Helpers from '../helpers';
import { getBrowserInstances } from '../helpers/core/env';

Given(/^cobblerd is running$/, async function (...args: any[]) {
    if (!(await Helpers.cobblerTest.running())) {
        throw new Error('cobblerd is not running');
    }
});

When(/^I restart cobbler on the server$/, async function () {
    await Helpers.getTarget('server').run('systemctl restart cobblerd.service');
});

Given(/^I am logged in via the Cobbler API as user "([^"]*)" with password "([^"]*)"$/, async function (user, pwd) {
    await Helpers.cobblerTest.login(user, pwd);
});

When(/^I log out from Cobbler via the API$/, async function () {
    await Helpers.cobblerTest.logout();
});

Given(/^distro "([^"]*)" exists$/, async function (distro) {
    if (!(await Helpers.cobblerTest.elementExists('distros', distro))) {
        throw new Error(`Distro ${distro} does not exist`);
    }
});

Given(/^profile "([^"]*)" exists$/, async function (profile) {
    if (!(await Helpers.cobblerTest.elementExists('profiles', profile))) {
        throw new Error(`Profile ${profile} does not exist`);
    }
});

When(/^I create distro "([^"]*)"$/, async function (distro) {
    if (await Helpers.cobblerTest.elementExists('distros', distro)) {
        throw new Error(`Distro ${distro} already exists`);
    }
    await Helpers.cobblerTest.distroCreate(distro, '/var/autoinstall/SLES15-SP4-x86_64/DVD1/boot/x86_64/loader/linux', '/var/autoinstall/SLES15-SP4-x86_64/DVD1/boot/x86_64/loader/initrd');
});

When(/^I create profile "([^"]*)" for distro "([^"]*)"$/, async function (profile, distro) {
    if (await Helpers.cobblerTest.elementExists('profiles', profile)) {
        throw new Error(`Profile ${profile} already exists`);
    }
    await Helpers.cobblerTest.profileCreate(profile, distro, '/var/autoinstall/mock/empty.xml');
});

When(/^I create system "([^"]*)" for profile "([^"]*)"$/, async function (system, profile) {
    if (await Helpers.cobblerTest.elementExists('systems', system)) {
        throw new Error(`System ${system} already exists`);
    }
    await Helpers.cobblerTest.systemCreate(system, profile);
});

When(/^I remove system "([^"]*)"$/, async function (system) {
    await Helpers.cobblerTest.systemRemove(system);
});

When(/^I remove profile "([^"]*)"$/, async function (profile) {
    await Helpers.cobblerTest.profileRemove(profile);
});

When(/^I remove distro "([^"]*)"$/, async function (distro) {
    await Helpers.cobblerTest.distroRemove(distro);
});

When(/^I clear the caches on the server$/, async function () {
    const node = await Helpers.getTarget('server');
    await node.run('spacecmd -u admin -p admin clear_caches');
});

When(/^I click on profile "([^"]*)"$/, async function (profile) {
    const { page } = getBrowserInstances();
    const xpathQuery = `//a[text()='${profile}']/../../td[1]/input[@type='radio']`;
    await page.locator(`xpath=${xpathQuery}`).click();
});

Then(/^the cobbler report should contain "([^"]*)" for "([^"]*)"$/, async function (text, host) {
    const node = await Helpers.getTarget(host);
    const { stdout } = await Helpers.getTarget('server').run(`cobbler system report --name ${node.fullHostname}:1`, { checkErrors: false });
    if (!stdout.includes(text)) {
        throw new Error(`Not found:\n${stdout}`);
    }
});

Then(/^the cobbler report should contain "([^"]*)" for cobbler system name "([^"]*)"$/, async function (text, name) {
    const { stdout } = await Helpers.getTarget('server').run(`cobbler system report --name ${name}`, { checkErrors: false });
    if (!stdout.includes(text)) {
        throw new Error(`Not found:\n${stdout}`);
    }
});

When(/^I prepare Cobbler for the buildiso command$/, async function () {
    const tmpDir = '/var/cache/cobbler/buildiso';
    const server = await Helpers.getTarget('server');
    await server.run(`mkdir -p ${tmpDir}`);
    const { stdout, returnCode } = await server.run('cobbler mkloaders', { verbose: true });
    if (returnCode !== 0) {
        throw new Error(`error in cobbler mkloaders.\nLogs:\n${stdout}`);
    }
});

When(/^I run Cobbler buildiso for distro "([^"]*)" and all profiles$/, async function (distro) {
    const tmpDir = '/var/cache/cobbler/buildiso';
    const isoDir = '/var/cache/cobbler';
    const server = await Helpers.getTarget('server');
    const { stdout, returnCode } = await server.run(`cobbler buildiso --tempdir=${tmpDir} --iso ${isoDir}/profile_all.iso --distro=${distro}`, { verbose: true });
    if (returnCode !== 0) {
        throw new Error(`error in cobbler buildiso.\nLogs:\n${stdout}`);
    }
    const profiles = ['orchid', 'flame', 'pearl'];
    const isolinuxProfiles = [];
    const cobblerProfiles = [];
    for (const profile of profiles) {
        const { stdout: cobblerResult, returnCode: cobblerCode } = await server.run(`cobbler profile list | grep -o ${profile}`, { verbose: true });
        if (cobblerCode === 0) {
            cobblerProfiles.push(cobblerResult);
        }
        const { stdout: isolinuxResult } = await server.run(`cat ${tmpDir}/isolinux/isolinux.cfg | grep -o ${profile} | cut -c -6 | head -n 1`);
        if (isolinuxResult) {
            isolinuxProfiles.push(isolinuxResult);
        }
    }
    if (cobblerProfiles.join() !== isolinuxProfiles.join()) {
        throw new Error(`error during comparison of Cobbler profiles.\nLogs:\nCobbler profiles:\n${cobblerProfiles}\nisolinux profiles:\n${isolinuxProfiles}`);
    }
});

When(/^I run Cobbler buildiso for distro "([^"]*)" and profile "([^"]*)"$/, async function (distro, profile) {
    const tmpDir = '/var/cache/cobbler/buildiso';
    const isoDir = '/var/cache/cobbler';
    const server = await Helpers.getTarget('server');
    const { stdout, returnCode } = await server.run(`cobbler buildiso --tempdir=${tmpDir} --iso ${isoDir}/${profile}.iso --distro=${distro} --profile=${profile}`, { verbose: true });
    if (returnCode !== 0) {
        throw new Error(`error in cobbler buildiso.\nLogs:\n${stdout}`);
    }
});

When(/^I run Cobbler buildiso for distro "([^"]*)" and profile "([^"]*)" without dns entries$/, async function (distro, profile) {
    const tmpDir = '/var/cache/cobbler/buildiso';
    const isoDir = '/var/cache/cobbler';
    const server = await Helpers.getTarget('server');
    const { stdout, returnCode } = await server.run(`cobbler buildiso --tempdir=${tmpDir} --iso ${isoDir}/${profile}.iso --distro=${distro} --profile=${profile} --exclude-dns`, { verbose: true });
    if (returnCode !== 0) {
        throw new Error(`error in cobbler buildiso.\nLogs:\n${stdout}`);
    }
    const { stdout: result, returnCode: code } = await server.run(`cat ${tmpDir}/isolinux/isolinux.cfg | grep -o nameserver`, { checkErrors: false });
    if (code === 0) {
        throw new Error(`error in Cobbler buildiso, nameserver parameter found in isolinux.cfg but should not be found.\nLogs:\n${result}`);
    }
});

When(/^I run Cobbler buildiso "([^"]*)" for distro "([^"]*)"$/, async function (param, distro) {
    const tmpDir = '/var/cache/cobbler/buildiso';
    const isoDir = '/var/cache/cobbler';
    const sourceDir = `/var/cache/cobbler/source_${param}`;
    const server = await Helpers.getTarget('server');
    await (this as any).runStep(`I run Cobbler buildiso for distro "${distro}" and all profiles`);
    await server.run(`mv ${tmpDir} ${sourceDir}`);
    await server.run(`mkdir -p ${tmpDir}`);
    const { stdout, returnCode } = await server.run(`cobbler buildiso --tempdir=${tmpDir} --iso ${isoDir}/${param}.iso --distro=${distro} --${param} --source=${sourceDir}`, { verbose: true });
    if (returnCode !== 0) {
        throw new Error(`error in cobbler buildiso.\nLogs:\n${stdout}`);
    }
});

When(/^I check Cobbler buildiso ISO "([^"]*)" with xorriso$/, async function (name) {
    const tmpDir = '/var/cache/cobbler';
    const server = await Helpers.getTarget('server');
    await server.run(`cat >${tmpDir}/test_image <<-EOF\nBIOS\nUEFI\nEOF`);
    const xorriso = `xorriso -indev ${tmpDir}/${name}.iso -report_el_torito 2>/dev/null`;
    const isoFilter = `awk '/^El Torito boot img[[:space:]]+:[[:space:]]+[0-9]+[[:space:]]+[a-zA-Z]+[[:space:]]+y/{print $7}'`;
    const isoFile = `${tmpDir}/xorriso_${name}`;
    const { stdout, returnCode } = await server.run(`${xorriso} | ${isoFilter} >> ${isoFile}`);
    if (returnCode !== 0) {
        throw new Error(`error while executing xorriso.\nLogs:\n${stdout}`);
    }
    const { stdout: diffOutput, returnCode: diffCode } = await server.run(`diff ${tmpDir}/test_image ${tmpDir}/xorriso_${name}`);
    if (diffCode !== 0) {
        throw new Error(`error in verifying Cobbler buildiso image with xorriso.\nLogs:\n${diffOutput}`);
    }
});

When(/^I cleanup xorriso temp files$/, async function () {
    await Helpers.getTarget('server').run('rm /var/cache/cobbler/xorriso_*', { checkErrors: false });
});

Given(/^cobbler settings are successfully migrated$/, async function () {
    const { stdout, returnCode } = await Helpers.getTarget('server').run('cobbler-settings migrate -t /etc/cobbler/settings.yaml');
    if (returnCode !== 0) {
        throw new Error(`error when running cobbler-settings to migrate current settings.\nLogs:\n${stdout}`);
    }
});

Then(/^I add the Cobbler parameter "([^"]*)" with value "([^"]*)" to item "(distro|profile|system)" with name "([^"]*)"$/, async function (param, value, item, name) {
    const { stdout, returnCode } = await Helpers.getTarget('server').run(`cobbler ${item} edit --name=${name} --${param}=${value}`, { verbose: true });
    if (returnCode !== 0) {
        throw new Error(`error in adding parameter and value to Cobbler ${item}.\nLogs:\n${stdout}`);
    }
});

When(/^I check the Cobbler parameter "([^"]*)" with value "([^"]*)" in the isolinux.cfg$/, async function (param, value) {
    const tmpDir = '/var/cache/cobbler/buildiso';
    const { stdout, returnCode } = await Helpers.getTarget('server').run(`cat ${tmpDir}/isolinux/isolinux.cfg | grep -o ${param}=${value}`);
    if (returnCode !== 0) {
        throw new Error(`error while verifying isolinux.cfg parameter for Cobbler buildiso.\nLogs:\n${stdout}`);
    }
});

When(/^I backup Cobbler settings file$/, async function () {
    await Helpers.getTarget('server').run('cp /etc/cobbler/settings.yaml /etc/cobbler/settings.yaml.bak 2> /dev/null', { checkErrors: false });
});

When(/^I cleanup after Cobbler buildiso$/, async function () {
    const { stdout, returnCode } = await Helpers.getTarget('server').run('rm -Rf /var/cache/cobbler');
    if (returnCode !== 0) {
        throw new Error(`Error during Cobbler buildiso cleanup.\nLogs:\n${stdout}`);
    }
});

When(/^I copy autoinstall mocked files on server$/, async function () {
    // This step requires file injection, which is not supported.
    throw new Error('This step requires file injection which cannot be performed.');
});

When(/^I run Cobbler sync (with|without) error checking$/, async function (checking) {
    const { stdout, returnCode } = await Helpers.getTarget('server').run('cobbler sync', { checkErrors: checking === 'with' });
    if (checking === 'with' && stdout.includes('Push failed')) {
        throw new Error('cobbler sync failed');
    }
});

When(/^I start local monitoring of Cobbler$/, async function () {
    const cobblerConfFile = '/etc/cobbler/logging_config.conf';
    const cobblerLogFile = '/var/log/cobbler/cobbler_debug.log';
    const server = await Helpers.getTarget('server');
    await server.run(`rm ${cobblerLogFile}`, { checkErrors: false });
    const { returnCode: fileExistsCode } = await server.run(`test -f ${cobblerConfFile}.old`, { checkErrors: false });
    if (fileExistsCode === 0) {
        await server.run('systemctl restart cobblerd');
    } else {
        // This part requires complex shell commands that are not easily translatable to a single run command.
        throw new Error('This step contains complex shell commands that cannot be easily translated.');
    }
    await new Promise(resolve => setTimeout(resolve, 3000));
});

Then(/^the local logs for Cobbler should not contain errors$/, async function () {
    // This step requires file extraction and JSON parsing, which is not supported.
    throw new Error('This step requires file extraction which cannot be performed.');
});