import {
    addContext,
    getApiTest,
    getAppHost,
    getContext,
    getCurrentPage,
    getSystemId,
    getSystemName,
    getTarget,
    globalVars,
    isSuseHost,
    repeatUntilTimeout,
    TIMEOUTS
} from '../index.js';
import {expect} from "@playwright/test";
import {followLinkInContentArea, shouldSeeText} from "./navigation_helper.js";

export async function manageBranchServerRepositories(action: string, when: string) {
    const proxy = await getTarget('proxy');
    const cmd = `sed -i '/^${when}.*/s/^#//g' /etc/zypp/repos.d/susemanager:branch-server.repo`;
    if (action === 'enable') {
        await proxy.run(cmd);
    } else {
        await proxy.run(cmd.replace('s/^#//g', 's/^/#/g'));
    }
}

export function computeImage(host: string): string {
    // TODO: now that the terminals derive from sumaform's pxe_boot module,
    //       we could also specify the desired image as an environment variable
    switch (host) {
        case 'pxeboot_minion':
            return globalVars.pxebootImage;
        case 'sle12sp5_terminal':
            return 'sles12sp5o';
        case 'sle15sp4_terminal':
            return 'sles15sp4o';
        case 'sle15sp7_terminal':
            return 'sles15sp7o';
        default:
            throw new Error(`Is ${host} a supported terminal?`);
    }
}

export function computeKiwiProfileName(host: string): string {
    const image = computeImage(host);
    switch (image) {
        case 'sles15sp7o':
        case 'sles15sp4o':
            return globalVars.product === 'Uyuni' ? 'POS_Image_JeOS7_uyuni' : 'POS_Image_JeOS7_head';
        case 'sles12sp5o':
            return 'POS_Image_JeOS6_head';
        default:
            throw new Error(`Is ${image} a supported image version?`);
    }
}

export function computeKiwiProfileVersion(host: string): string {
    const image = computeImage(host);
    switch (image) {
        case 'sles15sp7o':
        case 'sles15sp4o':
            return '7.0.0';
        case 'sles12sp5o':
            return '6.0.0';
        default:
            throw new Error(`Is ${image} a supported image version?`);
    }
}

export async function retrieveBuildHostId(): Promise<string> {
    const apiTest = getApiTest();
    const systems = await apiTest.system.listSystems();
    const buildHost = await getTarget('build_host');
    const buildHostId = systems
        .filter((s: { name: string; }) => s.name === buildHost.fullHostname)
        .map((s: { id: string; }) => s.id)
        .shift();
    if (!buildHostId) {
        throw new Error(`Build host ${buildHost.fullHostname} is not yet registered?`);
    }
    return buildHostId;
}

export async function shouldSeeImageIsBuilt(host: string) {
    const name = computeKiwiProfileName(host);
    const version = computeKiwiProfileVersion(host);
    await shouldSeeText(`${name}-${version}`);
}

export async function openImageDetailsPage(host: string) {
    const name = computeKiwiProfileName(host);
    await followLinkInContentArea(name);
}

export async function shouldSeeLinkToDownloadImage(host: string) {
    const name = computeKiwiProfileName(host);
    const version = computeKiwiProfileVersion(host);
    const linkLocator = getCurrentPage().locator(`a[href*="${name}-${version}.kiwi"]`);
    await expect(linkLocator).toBeVisible();
}

export async function checkExporter(exporter: string) {
    const server = await getTarget('server');
    const {stdout} = await server.run(`curl -s http://localhost:9090/api/v1/targets | grep ${exporter}`);
    if (!stdout.includes('UP')) {
        throw new Error(`${exporter} is not up`);
    }
}

export async function checkFirstRowInList() {
    const firstRowCheckbox = getCurrentPage().locator('tbody tr:first-child input[type="checkbox"]');
    await firstRowCheckbox.check();
    await expect(firstRowCheckbox).toBeChecked();
}

export async function uncheckRowWithArch(text: string, client: string) {
    const node = await getTarget(client);
    const arch = node.osArch;
    const row = getCurrentPage().locator('tr', {hasText: text}).filter({hasText: arch});
    await row.locator('input[type="checkbox"]').first().uncheck();
}

export async function shouldSeeTextInElement(text: string, element: string) {
    const elementLocator = getCurrentPage().locator(`div#${element}, div.${element}, span#${element}, span.${element}`);
    await expect(elementLocator.getByText(text)).toBeVisible();
}

export async function enterTextAsLeftMenuSearchField(text: string) {
    await getCurrentPage().locator('#filter').fill(text);
}

export async function shouldSeeLeftMenuEmpty() {
    await expect(getCurrentPage().locator('aside #nav nav ul li')).toHaveCount(0);
}

export async function shouldSeeHostnameAsFirstSearchResult(host: string) {
    const systemName = await getSystemName(host);
    const firstSearchResult = getCurrentPage().locator('tbody tr:first-child td.sortedCol');
    await expect(firstSearchResult).toHaveText(systemName);
}

export async function shouldSeeLinkInTableFirstColumn(text: string) {
    const firstColumnLink = getCurrentPage().locator('tbody tr:first-child td:first-child a');
    await expect(firstColumnLink).toHaveText(text);
}

export async function createChannelFromSpacecmd(name: string, type: string) {
    const server = await getTarget('server');
    const command = `spacecmd -u admin -p admin -- configchannel_create -n ${name} -t  ${type}`;
    await server.run(command);
}

export async function updateInitSlsFromSpacecmd(content: string, label: string) {
    const filepath = `/tmp/${label}`;
    await (await getTarget('server')).run(`echo -e "${content}" > ${filepath}`, {timeout: TIMEOUTS.long});
    const command = `spacecmd -u admin -p admin -- configchannel_updateinitsls -c ${label} -f  ${filepath} -y`;
    await (await getTarget('server')).run(command);
    await (await getTarget('server')).run(`rm ${filepath}`);
}

export async function scheduleApplyConfigchannels(host: string) {
    const system_name = await getSystemName(host);
    await (await getTarget('server')).run('spacecmd -u admin -p admin clear_caches');
    const command = `spacecmd -y -u admin -p admin -- system_scheduleapplyconfigchannels  ${system_name}`;
    await (await getTarget('server')).run(command);
}

export async function refreshPackagesListViaSpacecmd(client: string) {
    const node = await getSystemName(client);
    await (await getTarget('server')).run('spacecmd -u admin -p admin clear_caches');
    const command = `spacecmd -u admin -p admin system_schedulepackagerefresh ${node}`;
    await (await getTarget('server')).run(command);
}

export async function waitUntilRefreshPackageListIsFinished(client: string) {
    const round_minute = 60; // spacecmd uses timestamps with precision to minutes only
    const long_wait_delay = 600;
    const current_time = new Date().toISOString().slice(0, 16).replace(/[-T:]/g, '');
    const timeout_time = new Date(new Date().getTime() + (long_wait_delay + round_minute) * 1000).toISOString().slice(0, 16).replace(/[-T:]/g, '');
    const node = await getSystemName(client);
    await (await getTarget('server')).run('spacecmd -u admin -p admin clear_caches');
    // Gather all the ids of package refreshes existing at SUMA
    const {stdout: refreshes} = await (await getTarget('server')).run('spacecmd -u admin -p admin schedule_list | grep \'Package List Refresh\' | cut -f1 -d\' \'', {checkErrors: false});
    let node_refreshes = '';
    for (const refresh_id of refreshes.split('\n')) {
        if (refresh_id.match(/\/[0-9]{1,4}\//)) {
            const {stdout: refresh_result} = await (await getTarget('server')).run(`spacecmd -u admin -p admin schedule_details ${refresh_id}`); // Filter refreshes for specific system
            if (refresh_result.includes(node)) {
                node_refreshes += `^${refresh_id}|`;
            }
        }
    }
    const cmd = `spacecmd -u admin -p admin schedule_list ${current_time} ${timeout_time} | egrep '${node_refreshes.slice(0, -1)}'`;
    await repeatUntilTimeout(async () => {
        const {stdout: result} = await (await getTarget('server')).run(cmd, {checkErrors: false});
        await new Promise(resolve => setTimeout(resolve, 1000));
        if (result.includes('0    0    1')) return false;
        if (result.includes('1    0    0')) return true;
        if (result.includes('0    1    0')) throw new Error('refresh package list failed');
    }, {timeout: long_wait_delay, message: '\'refresh package list\' did not finish'});
}

export async function spacecmdShouldShowPackagesInstalled(packages: string, client: string) {
    const node = await getSystemName(client);
    await (await getTarget('server')).run('spacecmd -u admin -p admin clear_caches');
    const command = `spacecmd -u admin -p admin system_listinstalledpackages ${node}`;
    const {stdout: result} = await (await getTarget('server')).run(command, {checkErrors: false});
    for (const pkg of packages.split(' ')) {
        if (!result.includes(pkg.trim())) {
            throw new Error(`package ${pkg.trim()} is not installed`);
        }
    }
}

export async function theSusemanagerRepoFileShouldExist(host: string) {
    const node = await getTarget(host);
    const repoFile = await isSuseHost(host) ? '/etc/zypp/repos.d/susemanager.repo' : '/etc/apt/sources.list.d/susemanager.sources';
    await node.run(`test -f ${repoFile}`);
}

export async function theRepoFileShouldContainNormalDownloadEndpoint(host: string) {
    const node = await getTarget(host);
    const repoFile = await isSuseHost(host) ? '/etc/zypp/repos.d/susemanager.repo' : '/etc/apt/sources.list.d/susemanager.sources';
    const server = await getTarget('server');
    const normalEndpoint = `url=https://${server.fullHostname}/rhn/manager/download`;
    await node.run(`grep -q "${normalEndpoint}" ${repoFile}`);
}

export async function theRepoFileShouldContainCustomDownloadEndpoint(host: string) {
    const node = await getTarget(host);
    const repoFile = await isSuseHost(host) ? '/etc/zypp/repos.d/susemanager.repo' : '/etc/apt/sources.list.d/susemanager.sources';
    const customEndpoint = 'url=http://download.suse.de';
    await node.run(`grep -q "${customEndpoint}" ${repoFile}`);
}

export async function connectToReportDBWithReadOnlyUserFromExternalMachine() {
    const server = await getTarget('server');
    const reportdb_ro_user = 'test_user';
    const reportdb_ro_password = 'test_password';
    const {returnCode} = await server.run(`PGPASSWORD=${reportdb_ro_password} psql -h ${server.publicIp} -U ${reportdb_ro_user} -d reportdb -c '\\q'`, {checkErrors: false});
    if (returnCode !== 0) {
        throw new Error('Couldn\'t connect to the ReportDB with read-only user from external machine');
    }
}

export async function shouldBeAbleToQueryReportDB() {
    const server = await getTarget('server');
    const reportdb_ro_user = 'test_user';
    const reportdb_ro_password = 'test_password';
    const {returnCode} = await server.run(`PGPASSWORD=${reportdb_ro_password} psql -h ${server.publicIp} -U ${reportdb_ro_user} -d reportdb -c 'SELECT * FROM rhn_system limit 1;'`, {checkErrors: false});
    if (returnCode !== 0) {
        throw new Error('Couldn\'t query the ReportDB with read-only user');
    }
}

export async function shouldNotBeAbleToModifyReportDB(action: string, tableType: string) {
    const server = await getTarget('server');
    const reportdb_ro_user = 'test_user';
    const reportdb_ro_password = 'test_password';
    let command: string;
    if (tableType === 'table') {
        command = `PGPASSWORD=${reportdb_ro_password} psql -h ${server.publicIp} -U ${reportdb_ro_user} -d reportdb -c '${action.toUpperCase()} INTO rhn_system (id, system_id, name) VALUES (999999, 999999, \'test\');'`;
    } else { // view
        command = `PGPASSWORD=${reportdb_ro_password} psql -h ${server.publicIp} -U ${reportdb_ro_user} -d reportdb -c '${action.toUpperCase()} INTO rhn_system_view (id, system_id, name) VALUES (999999, 999999, \'test\');'`;
    }
    const {returnCode} = await server.run(command, {checkErrors: false});
    if (returnCode === 0) {
        throw new Error(`Was able to ${action} data in ReportDB ${tableType} as read-only user`);
    }
}

export async function shouldBeAbleToConnectToReportDBWithAdminUser() {
    const server = await getTarget('server');
    const reportdb_admin_user = getContext('reportdbAdminUser');
    const reportdb_admin_password = getContext('reportdbAdminPassword');
    const {returnCode} = await server.run(`PGPASSWORD=${reportdb_admin_password} psql -h ${server.publicIp} -U ${reportdb_admin_user} -d reportdb -c '\\q'`, {checkErrors: false});
    if (returnCode !== 0) {
        throw new Error('Couldn\'t connect to the ReportDB with admin user');
    }
}

export async function shouldNotBeAbleToConnectToProductDBWithAdminUser() {
    const server = await getTarget('server');
    const reportdb_admin_user = getContext('reportdbAdminUser');
    const reportdb_admin_password = getContext('reportdbAdminPassword');
    const {returnCode} = await server.run(`PGPASSWORD=${reportdb_admin_password} psql -h ${server.publicIp} -U ${reportdb_admin_user} -d susemanager -c '\\q'`, {checkErrors: false});
    if (returnCode === 0) {
        throw new Error('Was able to connect to product database with ReportDB admin user');
    }
}

export async function makeListOfExistingSystems() {
    const server = await getTarget('server');
    const {stdout} = await server.run('spacecmd -u admin -p admin system_list');
    addContext('existingSystems', stdout.split('\n').filter(line => line.trim() !== ''));
}

export async function shouldFindSystemsFromUIInReportDB() {
    const server = await getTarget('server');
    const reportdb_admin_user = getContext('reportdbAdminUser');
    const reportdb_admin_password = getContext('reportdbAdminPassword');
    const {stdout} = await server.run(`PGPASSWORD=${reportdb_admin_password} psql -h ${server.publicIp} -U ${reportdb_admin_user} -d reportdb -c 'SELECT name FROM rhn_system;'`);
    const reportdbSystems = stdout.split('\n').map(line => line.trim()).filter(line => line.length > 0 && !line.includes('name') && !line.includes('rows'));

    for (const system of getContext('existingSystems')) {
        if (!reportdbSystems.includes(system)) {
            throw new Error(`System ${system} not found in ReportDB`);
        }
    }
}

export async function knowCurrentSyncedDate(host: string) {
    const server = await getTarget('server');
    const reportdb_admin_user = getContext('reportdbAdminUser');
    const reportdb_admin_password = getContext('reportdbAdminPassword');
    const systemName = await getSystemName(host);
    const {stdout} = await server.run(`PGPASSWORD=${reportdb_admin_password} psql -h ${server.publicIp} -U ${reportdb_admin_user} -d reportdb -c 'SELECT last_synced FROM rhn_system WHERE name = \'${systemName}\';'`);
    addContext('syncedDate', stdout.split('\n')[2].trim());
}

export async function shouldFindUpdatedCityPropertyInReportDB(city: string, host: string) {
    const server = await getTarget('server');
    const reportdb_admin_user = getContext('reportdbAdminUser');
    const reportdb_admin_password = getContext('reportdbAdminPassword');
    const systemName = await getSystemName(host);
    await repeatUntilTimeout(async () => {
        const {stdout} = await server.run(`PGPASSWORD=${reportdb_admin_password} psql -h ${server.publicIp} -U ${reportdb_admin_user} -d reportdb -c 'SELECT value FROM rhn_system_custom_info WHERE system_name = \'${systemName}\' AND label = \'City\';'`);
        return stdout.includes(city);
    }, {message: `City property for ${systemName} not updated in ReportDB`});
}

export async function setPXEMenuEntry(entry: string, serverHost: string) {
    const server = await getTarget(serverHost);
    await server.run(`cobbler profile set --name=pxeboot_default --set-default=${entry}`);
}

export async function startMockingIPMIHost() {
    const server = await getTarget('server');
    await server.run('podman run -d --name fake-ipmi-host -p 623:623 -v /usr/share/susemanager/testsuite/upload_files/fake_ipmi_host.sh:/fake_ipmi_host.sh:ro registry.suse.com/suse/manager/5.0/ipmisim:latest');
}

export async function stopMockingIPMIHost() {
    const server = await getTarget('server');
    await server.run('podman stop fake-ipmi-host && podman rm fake-ipmi-host');
}

export async function startMockingRedfishHost() {
    const controller = await getTarget('server');
    await controller.run('podman run -d --name redfish-mockup-server -p 5000:5000 -v /usr/share/susemanager/testsuite/upload_files/Redfish-Mockup-Server:/Redfish-Mockup-Server:ro registry.suse.com/suse/manager/5.0/redfish-mockup-server:latest');
}

export async function enterControllerHostnameAsRedfishServerAddress() {
    const controller = await getTarget('server');
    await getCurrentPage().locator('#redfishServerAddress').fill(controller.fullHostname);
}

export async function stopMockingRedfishHost() {
    const controller = await getTarget('server');
    await controller.run('podman stop redfish-mockup-server && podman rm redfish-mockup-server');
}

export async function shouldSeeCorrectTimestampForTask(taskName: string) {
    const server = await getTarget('server');
    const {stdout} = await server.run(`spacecmd -u admin -p admin schedule_list | grep "${taskName}"`);
    const timestamp = stdout.split(' ')[0];
    const currentTime = new Date();
    const taskTime = new Date(
        parseInt(timestamp.substring(0, 4), 10),
        parseInt(timestamp.substring(4, 6), 10) - 1,
        parseInt(timestamp.substring(6, 8), 10),
        parseInt(timestamp.substring(8, 10), 10),
        parseInt(timestamp.substring(10, 12), 10),
        parseInt(timestamp.substring(12, 14), 10)
    );
    const diff = Math.abs(currentTime.getTime() - taskTime.getTime()) / 1000;
    if (diff > 60) {
        throw new Error(`Timestamp for task "${taskName}" is not correct. Difference: ${diff} seconds`);
    }
}

export async function checkCLMFilter(filterName: string) {
    const filterLocator = getCurrentPage().locator(`input[name="${filterName}"]`);
    await filterLocator.check();
    await expect(filterLocator).toBeChecked();
}

export async function shouldSeeTextInField(text: string, fieldName: string) {
    const fieldLocator = getCurrentPage().locator(`input[name="${fieldName}"]`);
    await expect(fieldLocator).toHaveValue(text);
}

export async function shouldSeeTextInArchitectureField(text: string) {
    const fieldLocator = getCurrentPage().locator('input[name="architecture"]');
    await expect(fieldLocator).toHaveValue(text);
}

export async function shouldSeeTextInChannelLabelField(text: string) {
    const fieldLocator = getCurrentPage().locator('input[name="channelLabel"]');
    await expect(fieldLocator).toHaveValue(text);
}

export async function shouldSeeTextInOperatingSystemField(text: string) {
    const fieldLocator = getCurrentPage().locator('input[name="os"]');
    await expect(fieldLocator).toHaveValue(text);
}

export async function shouldSeeTextInUsageLimitField(text: string) {
    const fieldLocator = getCurrentPage().locator('input[name="usageLimit"]');
    await expect(fieldLocator).toHaveValue(text);
}

export async function shouldSeeAdminLinkInTableFirstColumn() {
    const firstColumnLink = getCurrentPage().locator('tbody tr:first-child td:first-child a');
    await expect(firstColumnLink).toHaveText('admin');
}

export async function shouldSeeTextInFirstNamesField(text: string) {
    const fieldLocator = getCurrentPage().locator('input[name="firstNames"]');
    await expect(fieldLocator).toHaveValue(text);
}

export async function shouldSeeTextInLastNameField(text: string) {
    const fieldLocator = getCurrentPage().locator('input[name="lastName"]');
    await expect(fieldLocator).toHaveValue(text);
}

export async function haveComboboxPropertyWithValue(propertyName: string, value: string, host: string) {
    await getCurrentPage().goto(`${getAppHost()}/rhn/systems/details/EditCustomInfo.do?sid=${await getSystemId(await getTarget(host))}`);
    await getCurrentPage().locator(`select[name="custom_info_values:${propertyName}"]`).selectOption(value);
    await getCurrentPage().getByRole('button', {name: 'Update Properties'}).click();
    await shouldSeeText('System Properties Changed');
}
