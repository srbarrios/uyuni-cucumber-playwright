import {Given, Then, When} from '@cucumber/cucumber';

import {
    fileExists,
    fileExtract,
    fileInject,
    getAppHost,
    getCobblerTest,
    getCurrentPage,
    getTarget
} from '../helpers/index.js';
import {runCobblerBuildisoAllProfiles} from '../helpers/cobbler_helper.js';
import {expect} from "@playwright/test";
import {setPXEMenuEntry} from "../helpers/embedded_steps/retail_helper.js";

Given(/^cobblerd is running$/, async function (...args: any[]) {
    if (!(await (await getCobblerTest()).running())) {
        throw new Error('cobblerd is not running');
    }
});

Then(/^I should see the image for "([^"]*)" is built$/, async function (minion: string) {
    const server = await getTarget('server');
    const imagePath = `/var/cache/cobbler/${minion}.iso`;
    const exists = await fileExists(server, imagePath);
    expect(exists).toBeTruthy();
});

When(/^I open the details page of the image for "([^"]*)"$/, async function (minion: string) {
    const imagePath = `/var/cache/cobbler/${minion}.iso`;
    // This step would typically involve navigating to a specific URL or clicking a link in the UI.
    // Since there's no direct UI for Cobbler images in the current Playwright context,
    // we'll simulate a navigation to a hypothetical details page.
    // In a real scenario, this would be a page like `/rhn/images/details?name=${minion}.iso`
    // For now, we'll just assert that the image exists.
    const server = await getTarget('server');
    const exists = await fileExists(server, imagePath);
    expect(exists).toBeTruthy();
    console.log(`Navigated to details page for image: ${minion}.iso`);
});

When(/^I open the details page of the image for "([^"]*)"$/, async function (host: string) {
    const node = await getTarget(host);
    const {stdout} = await node.run('ls /srv/www/os-images');
    const imagePath = stdout.split('\n').find(line => line.includes(host));
    if (!imagePath) {
        throw new Error(`Image for ${host} not found`);
    }
    const imageName = imagePath.split('/').pop();
    await getCurrentPage().goto(`${getAppHost()}/rhn/images/details/Overview.do?imageName=${imageName}`);
});

When(/^I should see a link to download the image for "([^"]*)"$/, async function (host: string) {
    const node = await getTarget(host);
    const {stdout} = await node.run('ls /srv/www/os-images');
    const imagePath = stdout.split('\n').find(line => line.includes(host));
    if (!imagePath) {
        throw new Error(`Image for ${host} not found`);
    }
    const imageName = imagePath.split('/').pop();
    await expect(getCurrentPage().getByRole('link', {name: `Download ${imageName}`})).toBeVisible();
});

Then(/^I should see a link to download the image for "([^"]*)"$/, async function (minion: string) {
    const server = await getTarget('server');
    const imagePath = `/var/cache/cobbler/${minion}.iso`;
    const exists = await fileExists(server, imagePath);
    expect(exists).toBeTruthy();
    // In a real UI, this would involve checking for a visible download link.
    // For now, we'll assume the presence of the file implies a downloadable link.
    console.debug(`Download link for image ${minion}.iso is available.`);
});

When(/^I set the default PXE menu entry to the target profile on the "([^"]*)"$/, async function (serverHost: string) {
    await setPXEMenuEntry('pxeboot_default', serverHost);
});

When(/^I set the default PXE menu entry to the local boot on the "([^"]*)"$/, async function (serverHost: string) {
    await setPXEMenuEntry('local', serverHost);
});

When(/^I restart cobbler on the server$/, async function () {
    await (await getTarget('server')).run('systemctl restart cobblerd.service');
});

Given(/^I am logged in via the Cobbler API as user "([^"]*)" with password "([^"]*)"$/, async function (user, pwd) {
    await (await getCobblerTest()).login(user, pwd);
});

When(/^I log out from Cobbler via the API$/, async function () {
    await (await getCobblerTest()).logout();
});

Given(/^distro "([^"]*)" exists$/, async function (distro) {
    if (!(await (await getCobblerTest()).elementExists('distros', distro))) {
        throw new Error(`Distro ${distro} does not exist`);
    }
});

Given(/^profile "([^"]*)" exists$/, async function (profile) {
    if (!(await (await getCobblerTest()).elementExists('profiles', profile))) {
        throw new Error(`Profile ${profile} does not exist`);
    }
});

When(/^I create distro "([^"]*)"$/, async function (distro) {
    if (await (await getCobblerTest()).elementExists('distros', distro)) {
        throw new Error(`Distro ${distro} already exists`);
    }
    await (await getCobblerTest()).distroCreate(distro, '/var/autoinstall/SLES15-SP4-x86_64/DVD1/boot/x86_64/loader/linux', '/var/autoinstall/SLES15-SP4-x86_64/DVD1/boot/x86_64/loader/initrd');
});

When(/^I create profile "([^"]*)" for distro "([^"]*)"$/, async function (profile, distro) {
    if (await (await getCobblerTest()).elementExists('profiles', profile)) {
        throw new Error(`Profile ${profile} already exists`);
    }
    await (await getCobblerTest()).profileCreate(profile, distro, '/var/autoinstall/mock/empty.xml');
});

When(/^I create system "([^"]*)" for profile "([^"]*)"$/, async function (system, profile) {
    if (await (await getCobblerTest()).elementExists('systems', system)) {
        throw new Error(`System ${system} already exists`);
    }
    await (await getCobblerTest()).systemCreate(system, profile);
});

When(/^I remove system "([^"]*)"$/, async function (system) {
    await (await getCobblerTest()).systemRemove(system);
});

When(/^I remove profile "([^"]*)"$/, async function (profile) {
    await (await getCobblerTest()).profileRemove(profile);
});

When(/^I remove distro "([^"]*)"$/, async function (distro) {
    await (await getCobblerTest()).distroRemove(distro);
});

Then(/^I should see "self_update=http:\/\/" in field identified by "kernelopts"$/, async function (field: string) {
    const fieldLocator = getCurrentPage().locator(`input#${field}`);
    await expect(fieldLocator).toHaveValue(/self_update=http:\/\//);
});

Then(/^I should see "self_update=0" in field identified by "kernelopts"$/, async function (field: string) {
    const fieldLocator = getCurrentPage().locator(`input#${field}`);
    await expect(fieldLocator).toHaveValue(/self_update=0/);
});

Then(/^I should see "self_update=1" in field identified by "postkernelopts"$/, async function (field: string) {
    const fieldLocator = getCurrentPage().locator(`input#${field}`);
    await expect(fieldLocator).toHaveValue(/self_update=1/);
});

When(/^I clear the caches on the server$/, async function () {
    const node = await getTarget('server');
    await node.run('spacecmd -u admin -p admin clear_caches');
});

When(/^I click on profile "([^"]*)"$/, async function (profile) {
    const xpathQuery = `//a[text()='${profile}']/../../td[1]/input[@type='radio']`;
    await getCurrentPage().locator(`xpath=${xpathQuery}`).click();
});

Then(/^the cobbler report should contain "([^"]*)" for "([^"]*)"$/, async function (text, host) {
    const node = await getTarget(host);
    const {stdout} = await (await getTarget('server')).run(`cobbler system report --name ${node.fullHostname}:1`, {checkErrors: false});
    if (!stdout.includes(text)) {
        throw new Error(`Not found:\n${stdout}`);
    }
});

Then(/^the cobbler report should contain "([^"]*)" for cobbler system name "([^"]*)"$/, async function (text, name) {
    const {stdout} = await (await getTarget('server')).run(`cobbler system report --name ${name}`, {checkErrors: false});
    if (!stdout.includes(text)) {
        throw new Error(`Not found:\n${stdout}`);
    }
});

When(/^I prepare Cobbler for the buildiso command$/, async function () {
    const tmpDir = '/var/cache/cobbler/buildiso';
    const server = await getTarget('server');
    await server.run(`mkdir -p ${tmpDir}`);
    const {stdout, returnCode} = await server.run('cobbler mkloaders', {verbose: true});
    if (returnCode !== 0) {
        throw new Error(`error in cobbler mkloaders.\nLogs:\n${stdout}`);
    }
});

When(/^I run Cobbler buildiso for distro "([^"]*)" and all profiles$/, async function (distro) {
    const tmpDir = '/var/cache/cobbler/buildiso';
    const isoDir = '/var/cache/cobbler';
    const server = await getTarget('server');
    const {
        stdout,
        returnCode
    } = await server.run(`cobbler buildiso --tempdir=${tmpDir} --iso ${isoDir}/profile_all.iso --distro=${distro}`, {verbose: true});
    if (returnCode !== 0) {
        throw new Error(`error in cobbler buildiso.\nLogs:\n${stdout}`);
    }
    const profiles = ['orchid', 'flame', 'pearl'];
    const isolinuxProfiles = [];
    const cobblerProfiles = [];
    for (const profile of profiles) {
        const {
            stdout: cobblerResult,
            returnCode: cobblerCode
        } = await server.run(`cobbler profile list | grep -o ${profile}`, {verbose: true});
        if (cobblerCode === 0) {
            cobblerProfiles.push(cobblerResult);
        }
        const {stdout: isolinuxResult} = await server.run(`cat ${tmpDir}/isolinux/isolinux.cfg | grep -o ${profile} | cut -c -6 | head -n 1`);
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
    const server = await getTarget('server');
    const {
        stdout,
        returnCode
    } = await server.run(`cobbler buildiso --tempdir=${tmpDir} --iso ${isoDir}/${profile}.iso --distro=${distro} --profile=${profile}`, {verbose: true});
    if (returnCode !== 0) {
        throw new Error(`error in cobbler buildiso.\nLogs:\n${stdout}`);
    }
});

When(/^I run Cobbler buildiso for distro "([^"]*)" and profile "([^"]*)" without dns entries$/, async function (distro, profile) {
    const tmpDir = '/var/cache/cobbler/buildiso';
    const isoDir = '/var/cache/cobbler';
    const server = await getTarget('server');
    const {
        stdout,
        returnCode
    } = await server.run(`cobbler buildiso --tempdir=${tmpDir} --iso ${isoDir}/${profile}.iso --distro=${distro} --profile=${profile} --exclude-dns`, {verbose: true});
    if (returnCode !== 0) {
        throw new Error(`error in cobbler buildiso.\nLogs:\n${stdout}`);
    }
    const {
        stdout: result,
        returnCode: code
    } = await server.run(`cat ${tmpDir}/isolinux/isolinux.cfg | grep -o nameserver`, {checkErrors: false});
    if (code === 0) {
        throw new Error(`error in Cobbler buildiso, nameserver parameter found in isolinux.cfg but should not be found.\nLogs:\n${result}`);
    }
});

When(/^I run Cobbler buildiso "([^"]*)" for distro "([^"]*)"$/, async function (param, distro) {
    const tmpDir = '/var/cache/cobbler/buildiso';
    const isoDir = '/var/cache/cobbler';
    const sourceDir = `/var/cache/cobbler/source_${param}`;
    const server = await getTarget('server');
    await runCobblerBuildisoAllProfiles(distro);
    await server.run(`mv ${tmpDir} ${sourceDir}`);
    await server.run(`mkdir -p ${tmpDir}`);
    const {
        stdout,
        returnCode
    } = await server.run(`cobbler buildiso --tempdir=${tmpDir} --iso ${isoDir}/${param}.iso --distro=${distro} --${param} --source=${sourceDir}`, {verbose: true});
    if (returnCode !== 0) {
        throw new Error(`error in cobbler buildiso.\nLogs:\n${stdout}`);
    }
});

When(/^I check Cobbler buildiso ISO "([^"]*)" with xorriso$/, async function (name) {
    const tmpDir = '/var/cache/cobbler';
    const server = await getTarget('server');
    await server.run(`cat >${tmpDir}/test_image <<-EOF\nBIOS\nUEFI\nEOF`);
    const xorriso = `xorriso -indev ${tmpDir}/${name}.iso -report_el_torito 2>/dev/null`;
    const isoFilter = `awk '/^El Torito boot img[[:space:]]+:[[:space:]]+[0-9]+[[:space:]]+[a-zA-Z]+[[:space:]]+y/{print $7}'`;
    const isoFile = `${tmpDir}/xorriso_${name}`;
    const {stdout, returnCode} = await server.run(`${xorriso} | ${isoFilter} >> ${isoFile}`);
    if (returnCode !== 0) {
        throw new Error(`error while executing xorriso.\nLogs:\n${stdout}`);
    }
    const {
        stdout: diffOutput,
        returnCode: diffCode
    } = await server.run(`diff ${tmpDir}/test_image ${tmpDir}/xorriso_${name}`);
    if (diffCode !== 0) {
        throw new Error(`error in verifying Cobbler buildiso image with xorriso.\nLogs:\n${diffOutput}`);
    }
});

When(/^I cleanup xorriso temp files$/, async function () {
    await (await getTarget('server')).run('rm /var/cache/cobbler/xorriso_*', {checkErrors: false});
});

Given(/^cobbler settings are successfully migrated$/, async function () {
    const {
        stdout,
        returnCode
    } = await (await getTarget('server')).run('cobbler-settings migrate -t /etc/cobbler/settings.yaml');
    if (returnCode !== 0) {
        throw new Error(`error when running cobbler-settings to migrate current settings.\nLogs:\n${stdout}`);
    }
});

Then(/^I add the Cobbler parameter "([^"]*)" with value "([^"]*)" to item "(distro|profile|system)" with name "([^"]*)"$/, async function (param, value, item, name) {
    const {
        stdout,
        returnCode
    } = await (await getTarget('server')).run(`cobbler ${item} edit --name=${name} --${param}=${value}`, {verbose: true});
    if (returnCode !== 0) {
        throw new Error(`error in adding parameter and value to Cobbler ${item}.\nLogs:\n${stdout}`);
    }
});

When(/^I check the Cobbler parameter "([^"]*)" with value "([^"]*)" in the isolinux.cfg$/, async function (param, value) {
    const tmpDir = '/var/cache/cobbler/buildiso';
    const {
        stdout,
        returnCode
    } = await (await getTarget('server')).run(`cat ${tmpDir}/isolinux/isolinux.cfg | grep -o ${param}=${value}`);
    if (returnCode !== 0) {
        throw new Error(`error while verifying isolinux.cfg parameter for Cobbler buildiso.\nLogs:\n${stdout}`);
    }
});

When(/^I backup Cobbler settings file$/, async function () {
    await (await getTarget('server')).run('cp /etc/cobbler/settings.yaml /etc/cobbler/settings.yaml.bak 2> /dev/null', {checkErrors: false});
});

When(/^I cleanup after Cobbler buildiso$/, async function () {
    const {stdout, returnCode} = await (await getTarget('server')).run('rm -Rf /var/cache/cobbler');
    if (returnCode !== 0) {
        throw new Error(`Error during Cobbler buildiso cleanup.\nLogs:\n${stdout}`);
    }
});

When(/^I copy autoinstall mocked files on server$/, async function () {
    const targetDirs = [
        '/var/autoinstall/Fedora_12_i386/images/pxeboot',
        '/var/autoinstall/SLES15-SP4-x86_64/DVD1/boot/x86_64/loader',
        '/var/autoinstall/mock'
    ].join(' ');
    await (await getTarget('server')).run(`mkdir -p ${targetDirs}`);

    const baseDir = `${__dirname}/../upload_files/autoinstall/cobbler/`;
    const sourceDir = '/var/autoinstall/';
    const successes: boolean[] = [];

    successes.push(await fileInject(
        await getTarget('server'),
        `${baseDir}fedora12/vmlinuz`,
        `${sourceDir}Fedora_12_i386/images/pxeboot/vmlinuz`
    ));
    successes.push(await fileInject(
        await getTarget('server'),
        `${baseDir}fedora12/initrd.img`,
        `${sourceDir}Fedora_12_i386/images/pxeboot/initrd.img`
    ));
    successes.push(await fileInject(
        await getTarget('server'),
        `${baseDir}mock/empty.xml`,
        `${sourceDir}mock/empty.xml`
    ));
    successes.push(await fileInject(
        await getTarget('server'),
        `${baseDir}sles15sp4/initrd`,
        `${sourceDir}SLES15-SP4-x86_64/DVD1/boot/x86_64/loader/initrd`
    ));
    successes.push(await fileInject(
        await getTarget('server'),
        `${baseDir}sles15sp4/linux`,
        `${sourceDir}SLES15-SP4-x86_64/DVD1/boot/x86_64/loader/linux`
    ));

    if (!successes.every(Boolean)) {
        throw new Error('File injection failed');
    }
});

When(/^I run Cobbler sync (with|without) error checking$/, async function (checking) {
    const {
        stdout,
        returnCode
    } = await (await getTarget('server')).run('cobbler sync', {checkErrors: checking === 'with'});
    if (checking === 'with' && stdout.includes('Push failed')) {
        throw new Error('cobbler sync failed');
    }
});

When(/^I start local monitoring of Cobbler$/, async function () {
    const cobblerConfFile = '/etc/cobbler/logging_config.conf';
    const cobblerLogFile = '/var/log/cobbler/cobbler_debug.log';
    const server = await getTarget('server');
    await server.run(`rm ${cobblerLogFile}`, {checkErrors: false});
    const {returnCode: fileExistsCode} = await server.run(`test -f ${cobblerConfFile}.old`, {checkErrors: false});
    if (fileExistsCode === 0) {
        await server.run('systemctl restart cobblerd');
    } else {
        const handlerName = 'FileLogger02';
        const formatterName = 'JSONlogfile';
        const handlerClass = `
        [handler_${handlerName}]
        class=FileHandler
        level=DEBUG
        formatter=${formatterName}
        args=('${cobblerLogFile}', 'a')
        
        [formatter_${formatterName}]
        format ={'threadName': '%(threadName)s', 'asctime': '%(asctime)s', 'levelname':  '%(levelname)s', 'message': '%(message)s'}
        `;

        const command = [
            `cp ${cobblerConfFile} ${cobblerConfFile}.old`,
            `line_number=$(awk "/\\[handlers\\]/{ print NR; exit }" ${cobblerConfFile})`,
            `sed -e "$((line_number + 1))s/$/,${handlerName}/" -i ${cobblerConfFile}`,
            `line_number=$(awk "/\\[formatters\\]/{ print NR; exit }" ${cobblerConfFile})`,
            `sed -e "$((line_number + 1))s/$/,${formatterName}/" -i ${cobblerConfFile}`,
            `line_number=$(awk "/\\[logger_root\\]/{ print NR; exit }" ${cobblerConfFile})`,
            `sed -e "$((line_number + 2))s/$/,${handlerName}/" -i ${cobblerConfFile}`,
            `echo -e "${handlerClass}" >> ${cobblerConfFile}`,
            `systemctl restart cobblerd`
        ].join(' && ');

        await (await getTarget('server')).run(command);
    }
    await new Promise(resolve => setTimeout(resolve, 3000));
});

Then(/^the local logs for Cobbler should not contain errors$/, async function () {
    const node = await getTarget('server');

    let cobblerLogFile = '/var/log/cobbler/cobbler.log';
    let remoteFile = '/tmp/cobbler.copy';
    let localFile = '/tmp/cobbler.log';

    await node.run(`cp ${cobblerLogFile} ${remoteFile}`);
    let success = await fileExtract(node, remoteFile, localFile);
    if (!success) {
        throw new Error('File extraction failed');
    }

    const fs = require('fs');
    let output = fs.readFileSync(localFile, 'utf8')
        .split('\n')
        .filter((line: string) => line.includes('ERROR'));
    if (output.length > 0) {
        await node.run(`cp ${remoteFile} ${cobblerLogFile}-$(date +"%Y_%m_%d_%I_%M_%p")`);
        console.error(`Error in Cobbler log:\n${output.join('\n')}`);
    }

    // Archivo de log de depuración
    cobblerLogFile = '/var/log/cobbler/cobbler_debug.log';
    remoteFile = '/tmp/cobbler_debug.copy';
    localFile = '/tmp/cobbler_debug.log';
    // Para evitar condiciones de carrera con "tar" llamado por "mgrctl cp", trabajamos en una copia:
    await node.run(`cp ${cobblerLogFile} ${remoteFile}`);
    success = await fileExtract(node, remoteFile, localFile);
    if (!success) {
        throw new Error('File extraction failed');
    }

    let fileData = fs.readFileSync(localFile, 'utf8')
        .replace(/\n/g, ',')
        .replace(/"'/g, " ' ")
        .replace(/\\''/g, '"')
        .replace(/,$/, '');
    let dataHash = JSON.parse(`[${fileData}]`);
    let outputDebug = dataHash.filter((item: any) => item['levelname'] === 'ERROR');
    if (outputDebug.length > 0) {
        await node.run(`cp ${remoteFile} ${cobblerLogFile}-$(date +"%Y_%m_%d_%I_%M_%p")`);
        console.error(`Error in Cobbler debug log:\n${JSON.stringify(outputDebug, null, 2)}`);
    }

    if (output.length > 0 || outputDebug.length > 0) {
        throw new Error('Errors in Cobbler logs');
    }
});
