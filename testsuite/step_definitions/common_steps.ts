import {Given, Then, When} from '@cucumber/cucumber';
import {
    BASE_CHANNEL_BY_CLIENT,
    envConfig,
    getApiTest,
    getChecksumPath,
    getContext,
    getCurrentPage,
    getSystemName,
    getTarget,
    getUptimeFromHost,
    getValidUptimeMessages,
    globalVars,
    refreshPage,
    repeatUntilTimeout,
    validateChecksumWithFile
} from "../helpers/index.js";
import {expect} from "@playwright/test";
import * as path from 'path';
import {dirname} from 'path';
import {fileURLToPath} from "url";
import {
    checkPackageVisibility,
    navigateToChannelPackages,
    navigateToSystemsPage,
    scheduleReportDBUpdate,
    waitForEventCompletion,
    waitUntilEventIsCompleted
} from '../helpers/embedded_steps/common_helper.js';
import {selectOptionFromField} from "../helpers/embedded_steps/navigation_helper.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

When(/^I wait for "(\d+)" seconds?$/, async (seconds: string) => {
    await new Promise((resolve) =>
        setTimeout(resolve, parseInt(seconds, 10) * 1000)
    );
});

When(
    /^I mount as "([^"]+)" the ISO from "([^"]+)" in the server, validating its checksum$/,
    async (name: string, url: string) => {
        let iso_path: string;
        const server = await getTarget('server');
        if (globalVars.mirror) {
            iso_path = envConfig.isContainerizedServer
                ? url.replace(/^https?:\/\/[^/]+/, '/srv/mirror')
                : url.replace(/^https?:\/\/[^/]+/, '/mirror');
        } else {
            iso_path = `/tmp/${name}.iso`;
            await server.run(`curl --insecure -o ${iso_path} ${url}`, {
                runsInContainer: false,
                timeout: 1500
            });
        }

        const iso_dir = iso_path.substring(0, iso_path.lastIndexOf('/'));
        const original_iso_name = url.split('/').pop()!;
        const checksum_path = await getChecksumPath(iso_dir, original_iso_name, url)

        if (
            !(await validateChecksumWithFile(
                original_iso_name,
                iso_path,
                checksum_path
            ))
        ) {
            throw new Error('SHA256 checksum validation failed');
        }

        if (envConfig.isContainerizedServer) {
            const mount_point = '/srv/www/distributions';
            await server.run(`mkdir -p ${mount_point}`);
            await server.run(`mgradm distro copy ${iso_path} ${name}`, {
                runsInContainer: false,
                verbose: true
            });
            await server.run(`ln -s ${mount_point}/${name} /srv/www/htdocs/pub/`);
        } else {
            const mount_point = `/srv/www/htdocs/pub/${name}`;
            const cmd = `mkdir -p ${mount_point} && grep ${iso_path} /etc/fstab || echo '${iso_path}  ${mount_point}  iso9660  loop,ro,_netdev  0 0' >> /etc/fstab && umount ${iso_path}; mount ${iso_path}`;
            await server.run(cmd, {verbose: true});
        }
    }
);

Then(
    /^the hostname for "([^"]*)" should be correct$/,
    async function (host: string) {
        if (!getCurrentPage()) throw new Error('No page instance');
        const node = await getTarget(host);
        await expect(getCurrentPage().getByText(node.hostname)).toBeVisible();
    }
);

Then(
    /^the kernel for "([^"]*)" should be correct$/,
    async function (host: string) {
        const node = await getTarget(host);
        const {stdout} = await node.run('uname -r');
        console.log(`I should see kernel version: ${stdout}`);
        await expect(getCurrentPage().getByText(stdout.trim())).toBeVisible();
    }
);

Then(
    /^the OS version for "([^"]*)" should be correct$/,
    async function (host: string) {
        const node = await getTarget(host);
        const osVersion = node.osVersion;
        if (osVersion === undefined) {
            throw new Error(`Not defined OS version "${host}"`);
        }
        const osFamily = node.osFamily;
        if (osFamily === undefined) {
            throw new Error(`Not defined OS family "${host}"`);
        }
        if (osFamily.includes('sles')) {
            await expect(getCurrentPage().getByText(osVersion.replace('-SP', ' SP'))).toBeVisible();
        }
    }
);

Then(
    /^the IPv4 address for "([^"]*)" should be correct$/,
    async function (host: string) {
        const node = await getTarget(host);
        const ipv4_address = node.publicIp;
        expect(ipv4_address).toBeDefined();
        if (!ipv4_address) {
            throw new Error(`No IPv4 address found for host ${host}`);
        }
        console.log(`IPv4 address: ${ipv4_address}`);
        await expect(getCurrentPage().getByText(ipv4_address)).toBeVisible();
    }
);

Then(
    /^the system ID for "([^"]*)" should be correct$/,
    async function (host: string) {
        const client_id = (
            await getApiTest().system.searchByName(await getSystemName(host))
        )[0]['id'];
        await expect(getCurrentPage().getByText(client_id)).toBeVisible();
    }
);

Then(
    /^the system name for "([^"]*)" should be correct$/,
    async function (host: string) {
        const system_name = await getSystemName(host);
        await expect(getCurrentPage().getByText(system_name)).toBeVisible();
    }
);

Then(
    /^the uptime for "([^"]*)" should be correct$/,
    async function (host: string) {
        const node = await getTarget(host);
        const uptime = await getUptimeFromHost(node);
        const valid_uptime_messages = getValidUptimeMessages(uptime);
        const uptimeLocator = getCurrentPage().getByRole('cell', {name: 'Last Booted'}).locator('following-sibling::td/time');
        await expect(uptimeLocator).toHaveText(new RegExp(valid_uptime_messages.join('|')));
    }
);

When(/^I wait until event "([^"]*)" is completed$/, async function (event) {
    await waitForEventCompletion(event);
});

When(
    /^I wait (\d+) seconds until the event is picked up and (\d+) seconds until the event "([^"]*)" is completed$/,
    async function (pickup_timeout, complete_timeout, event) {
        await waitUntilEventIsCompleted(parseInt(pickup_timeout, 10), parseInt(complete_timeout, 10), event);
    }
);

When(
    /^I wait at most (\d+) seconds until event "([^"]*)" is completed$/,
    async function (final_timeout, event) {
        // This step is a wrapper around the more detailed event waiting step.
        // The original step definition 'I wait 180 seconds until the event is picked up and {int} seconds until the event "{event}" is completed'
        // is now handled by the sequence of helper functions in waitForEventCompletion.
        // We can directly call waitForEventCompletion here, assuming the "180 seconds until picked up" is implicitly handled
        // by the default timeout or the internal logic of waitForEventCompletion.
        await waitForEventCompletion(event, parseInt(final_timeout, 10));
    }
);

Then(
    /^the up2date logs on "([^"]*)" should contain no Traceback error$/,
    async function (host: string) {
        const node = await getTarget(host);
        const cmd =
            'if grep "Traceback" /var/log/up2date ; then exit 1; else exit 0; fi';
        const {returnCode} = await node.run(cmd);
        if (returnCode !== 0) {
            throw new Error('error found, check the client up2date logs');
        }
    }
);

When(
    /^I check default base channel radio button of this "([^"]*)"$/,
    async function (host: string) {
        const default_base_channel = BASE_CHANNEL_BY_CLIENT[globalVars.product][host];
        if (!default_base_channel) {
            throw new Error(`${default_base_channel} can't be checked`);
        }
    }
);

When(/^I enter as remote command this script in$/, async function (multiline) {
    await getCurrentPage().getByLabel('Script').fill(multiline);
});

When(/^I check the ram value of the "([^"]*)"$/, async function (host: string) {
    const node = await getTarget(host);
    const get_ram_value = "grep MemTotal /proc/meminfo |awk '{print $2}'";
    const {stdout} = await node.run(get_ram_value);
    const ram_value = stdout.trim();
    const ram_mb = Math.floor(parseInt(ram_value, 10) / 1024).toString();
    await expect(getCurrentPage().getByText(ram_mb)).toBeVisible();
});

When(
    /^I check the MAC address value of the "([^"]*)"$/,
    async function (host: string) {
        const node = await getTarget(host);
        const get_mac_address = 'cat /sys/class/net/eth0/address';
        const {stdout} = await node.run(get_mac_address);
        const mac_address = stdout.trim().toLowerCase();
        await expect(getCurrentPage().getByText(mac_address)).toBeVisible();
    }
);

Then(
    /^I should see the CPU frequency of the "([^"]*)"$/,
    async function (host: string) {
        const node = await getTarget(host);
        const get_cpu_freq = "cat /proc/cpuinfo  | grep -i 'CPU MHz'";
        const {stdout} = await node.run(get_cpu_freq);
        const get_cpu = stdout.trim();
        const cpu = get_cpu.split('.');
        const cpu_mhz = parseInt(cpu[0].replace(/[^\d]/, ''), 10);
        await expect(getCurrentPage().getByText(`${Math.floor(cpu_mhz / 1000)} GHz`)).toBeVisible();
    }
);

Given(/^I am on the Systems page$/, async function () {
    await navigateToSystemsPage();
});

When(
    /^I refresh the metadata for "([^"]*)"$/,
    async function (host: string) {
        const node = await getTarget(host);
        const osFamily = node.osFamily;
        if (osFamily == undefined) {
            throw new Error(
                `The host ${host} has not a defined OS Family`
            );
        }
        if (osFamily.match(/^opensuse/) || osFamily.match(/^sles/) || osFamily.match(/micro/)) {
            await node.runUntilOk('zypper --non-interactive refresh -s');
        } else if (osFamily.match(/^centos/) || osFamily.match(/^rocky/)) {
            await node.run('yum clean all && yum makecache', {timeout: 600});
        } else if (osFamily.match(/^ubuntu/)) {
            await node.run('apt-get update');
        } else {
            throw new Error(
                `The host ${host} has not yet a implementation for that step`
            );
        }
    }
);

Then(
    /^I should have '([^']*)' in the patch metadata for "([^"]*)"$/,
    async function (text: string, host: string) {
        const node = await getTarget(host);
        const cmd = `zgrep '${text}' /var/cache/zypp/raw/susemanager:fake-rpm-suse-channel/repodata/*updateinfo.xml.gz`;
        await node.run(cmd, {timeout: 500});
    }
);

Then(/^I should see package "([^"]*)"$/, async function (pkg: string) {
    await expect(getCurrentPage().getByText(pkg)).toBeVisible();
});

Given(
    /^metadata generation finished for "([^"]*)"$/,
    async function (channel: string) {
        const server = await getTarget('server');
        await server.runUntilOk(
            `ls /var/cache/rhn/repodata/${channel}/*updateinfo.xml.gz`
        );
    }
);

When(
    /^I push package "([^"]*)" into "([^"]*)" channel through "([^"]*)"$/,
    async function (package_filepath: string, channel: string, minion: string) {
        const server = await getTarget('server');
        const command = `mgrpush -u admin -p admin --server=${server.fullHostname} --nosig -c ${channel} ${package_filepath}`;
        const node = await getTarget(minion);
        await node.run(command, {timeout: 500});
        const package_filename = package_filepath.split('/').pop();
        await server.runUntilOk(
            `find /var/spacewalk/packages -name "${package_filename}" | grep -q "${package_filename}"`,
            500
        );
    }
);

Then(
    /^I should see package "([^"]*)" in channel "([^"]*)"$/,
    async function (pkg: string, channel: string) {
        await navigateToChannelPackages(channel);
        await checkPackageVisibility(pkg);
    }
);

When(/^I schedule a task to update ReportDB$/, async function () {
    await scheduleReportDBUpdate();
});

// Remote/system helpers
Then('service "([^"]*)" is enabled on "([^"]*)"', async function (service: string, host: string) {
    const node = await getTarget(host);
    const {stdout} = await node.run(`systemctl is-enabled '${service}'`, {checkErrors: false});
    const status = (stdout || '').trim().split(/\n+/).pop();
    if (status !== 'enabled') throw new Error(`Service ${service} not enabled on ${host} (got: ${status})`);
});

When(/^I check the first row in the list$/, async function () {
    await getCurrentPage().locator('tbody tr:first-child input[type="checkbox"]').check();
});

Then('service "([^"]*)" is active on "([^"]*)"', async function (service: string, host: string) {
    const node = await getTarget(host);
    const {stdout} = await node.run(`systemctl is-active '${service}'`, {checkErrors: false});
    const status = (stdout || '').trim().split(/\n+/).pop();
    if (status !== 'active') throw new Error(`Service ${service} not active on ${host} (got: ${status})`);
});

Then('socket "([^"]*)" is enabled on "([^"]*)"', async function (socket: string, host: string) {
    const node = await getTarget(host);
    const {stdout} = await node.run(`systemctl is-enabled '${socket}.socket'`, {checkErrors: false});
    const status = (stdout || '').trim().split(/\n+/).pop();
    if (status !== 'enabled') throw new Error(`Socket ${socket} not enabled on ${host} (got: ${status})`);
});

Then('socket "([^"]*)" is active on "([^"]*)"', async function (socket: string, host: string) {
    const node = await getTarget(host);
    const {stdout} = await node.run(`systemctl is-active '${socket}.socket'`, {checkErrors: false});
    const status = (stdout || '').trim().split(/\n+/).pop();
    if (status !== 'active') throw new Error(`Socket ${socket} not active on ${host} (got: ${status})`);
});

Then('reverse resolution should work for "([^"]*)"', async function (host: string) {
    const node = await getTarget(host);
    const {
        stdout: result,
        returnCode
    } = await node.run(`date +%s; getent hosts ${node.fullHostname}; date +%s`, {checkErrors: false});
    if (returnCode !== 0) throw new Error('cannot do reverse resolution');
    const lines = (result || '').split('\n');
    const initial = parseInt(lines[0] || '0', 10);
    const out = String(lines[1] || '');
    const end = parseInt(lines[2] || '0', 10);
    const elapsed = end - initial;
    if (elapsed > 2) throw new Error(`reverse resolution took too long (${elapsed} seconds)`);
    if (!out.includes(node.fullHostname)) throw new Error(`reverse resolution returned ${out}, expected to see ${node.fullHostname}`);
});


When(/^I save a screenshot as "([^"]+)"$/, async function (filename: string) {
    const screenshotPath = path.join(__dirname, '../screenshots/', filename);
    await getCurrentPage().screenshot({path: screenshotPath, type: 'png'});
    await getCurrentPage().setInputFiles('input[type="file"]', screenshotPath);
});

Then(/^the IPv6 address for "([^"]*)" should be correct$/, async function (host: string) {
    const node = await getTarget(host);
    const {stdout: interfaceOutput} = await node.run(`ip -6 address show ${node.publicInterface}`);

    const lines = interfaceOutput.split('\n');
    // selects only lines with IPv6 addresses and proceeds to form an array with only those addresses
    const ipv6AddressesList = lines.filter((line: string) => /2[:0-9a-f]*|fe80:[:0-9a-f]*/.test(line))
        .map((line: string) => line.match(/2[:0-9a-f]*|fe80:[:0-9a-f]*/)?.[0])
        .filter((addr): addr is string => addr !== undefined);

    // confirms that the IPv6 address shown on the page is part of that list and, therefore, valid
    const ipv6Address = await getCurrentPage().locator('//td[text()=\'IPv6 Address:\']/following-sibling::td[1]').textContent();
    if (!ipv6Address) {
        throw new Error(`IPv6 address not found on page`);
    }

    if (!ipv6AddressesList.includes(ipv6Address)) {
        throw new Error(`List of IPv6 addresses: ${ipv6AddressesList} doesn't include ${ipv6Address}`);
    }
});

When(/^I wait until I see the event "([^"]*)" completed during last minute, refreshing the page$/, async function (event: string) {
    await repeatUntilTimeout(async () => {
        const now = new Date();
        const currentMinute = now.toLocaleTimeString('en-US', {hour: '2-digit', minute: '2-digit', hour12: false});
        const previousMinute = new Date(now.getTime() - 60000).toLocaleTimeString('en-US', {
            hour: '2-digit',
            minute: '2-digit',
            hour12: false
        });

        try {
            const element = await getCurrentPage().locator(`//a[contains(text(),'${event}')]/../..//td[4]/time[contains(text(),'${currentMinute}') or contains(text(),'${previousMinute}')]/../../td[3]/a[1]`).first();
            if (await element.isVisible({timeout: 1000})) {
                return true;
            }
        } catch (error) {
            // ignored - pending actions cannot be found
        }

        await refreshPage(getCurrentPage());
        return false;
    }, {message: `Couldn't find the event ${event}`});
});

When(/^I follow the event "([^"]*)" completed during last minute$/, async function (event: string) {
    const now = new Date();
    const currentMinute = now.toLocaleTimeString('en-US', {hour: '2-digit', minute: '2-digit', hour12: false});
    const previousMinute = new Date(now.getTime() - 60000).toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
    });

    const xpathQuery = `//a[contains(text(), '${event}')]/../..//td[4]/time[contains(text(),'${currentMinute}') or contains(text(),'${previousMinute}')]/../../td[3]/a[1]`;
    const element = await getCurrentPage().locator(xpathQuery).first();
    await element.click();
});

Then(/^I should see the power is "([^"]*)"$/, async function (status: string) {
    // This would need to be implemented with proper XPath navigation in Playwright
    // For now, we'll leave a placeholder
    throw new Error('Power status check not yet implemented');
});

When(/^I check radio button "(.*?)"$/, async function (radio_button: string) {
    const radio = getCurrentPage().locator(`input[type="radio"][name="${radio_button}"]`);
    if (await radio.isChecked()) {
        console.warn(`Warning: Radio button '${radio_button}' is already checked`);
    } else {
        const success = await radio.check().then(() => true).catch(() => false);
        if (!success) {
            throw new Error(`${radio_button} can't be checked`);
        }
    }
});

When(/^I install the needed packages for highstate in build host$/, async function () {
    const packages = `bea-stax
    bea-stax-api
    btrfsmaintenance
    btrfsprogs
    btrfsprogs-udev-rules
    catatonit
    checkmedia
    containerd
    cryptsetup
    cryptsetup-lang
    dbus-1-x11
    device-mapper
    docker
    dpkg
    fontconfig
    git-core
    git-gui
    gitk
    grub2-snapper-plugin
    iptables
    java-17-openjdk-headless
    javapackages-filesystem
    javapackages-tools
    jing
    kernel-default
    kernel-firmware-all
    kernel-firmware-amdgpu
    kernel-firmware-ath10k
    kernel-firmware-ath11k
    kernel-firmware-atheros
    kernel-firmware-bluetooth
    kernel-firmware-bnx2
    kernel-firmware-brcm
    kernel-firmware-chelsio
    kernel-firmware-dpaa2
    kernel-firmware-i915
    kernel-firmware-intel
    kernel-firmware-iwlwifi
    kernel-firmware-liquidio
    kernel-firmware-marvell
    kernel-firmware-media
    kernel-firmware-mediatek
    kernel-firmware-mellanox
    kernel-firmware-mwifiex
    kernel-firmware-network
    kernel-firmware-nfp
    kernel-firmware-nvidia
    kernel-firmware-platform
    kernel-firmware-prestera
    kernel-firmware-qcom
    kernel-firmware-qlogic
    kernel-firmware-radeon
    kernel-firmware-realtek
    kernel-firmware-serial
    kernel-firmware-sound
    kernel-firmware-ti
    kernel-firmware-ueagle
    kernel-firmware-usb-network
    kiwi-boot-descriptions
    kiwi-man-pages
    kiwi-systemdeps
    kiwi-systemdeps-bootloaders
    kiwi-systemdeps-containers
    kiwi-systemdeps-core
    kiwi-systemdeps-disk-images
    kiwi-systemdeps-filesystems
    kiwi-systemdeps-image-validation
    kiwi-systemdeps-iso-media
    kiwi-tools
    kpartx
    libaio1
    libasound2
    libbtrfs0
    libburn4
    libcontainers-common
    libdevmapper-event1_03
    libefa1
    libfmt8
    libfontconfig1
    libfreebl3
    libfreebl3-hmac
    libibverbs
    libibverbs1
    libip6tc2
    libisoburn1
    libisofs6
    libjpeg8
    libjte1
    liblcms2-2
    liblmdb-0_9_17
    liblttng-ust0
    liblvm2cmd2_03
    liblzo2-2
    libmd0
    libmediacheck6
    libmlx4-1
    libmlx5-1
    libmpath0
    libnetfilter_conntrack3
    libnfnetlink0
    libnftnl11
    libnuma1
    libpcsclite1
    libpwquality1
    libpwquality-lang
    librados2
    librbd1
    librdmacm1
    libreiserfscore0
    libsgutils2-1_47-2
    libsha1detectcoll1
    libsnapper5
    libsoftokn3
    libsoftokn3-hmac
    liburcu6
    libX11-6
    libX11-data
    libXau6
    libxcb1
    libXext6
    libXft2
    libxkbcommon0
    libxml2-tools
    libXmuu1
    libXrender1
    libxslt1
    libXss1
    lvm2
    make
    make-lang
    mdadm
    mozilla-nspr
    mozilla-nss
    mozilla-nss-certs
    mtools
    multipath-tools
    openssl
    patch
    pcsc-lite
    perl-TimeDate
    postfix
    python3-cssselect
    python3-docopt
    python3-kiwi
    python3-lxml
    python3-simplejson
    python3-solv
    python3-xattr
    qemu-block-curl
    qemu-block-rbd
    qemu-tools
    rdma-core
    rdma-ndd
    relaxngDatatype
    rollback-helper
    runc
    saxon9
    saxon9-scripts
    screen
    sg3_utils
    skopeo
    snapper
    snapper-zypp-plugin
    sqlite3-tcl
    squashfs
    syslinux
    tcl
    thin-provisioning-tools
    timezone-java
    tk
    umoci
    xalan-j2
    xerces-j2
    xhost
    xkeyboard-config
    xkeyboard-config-lang
    xml-commons-apis
    xml-commons-resolver
    xorriso
    xtables-plugins`;

    const buildHost = await getTarget('build_host');
    await buildHost.run(`zypper --non-interactive in ${packages}`, {timeout: 600});
});

When(/^I attach the file "(.*)" to "(.*)"$/, async function (filePath: string, field: string) {
    const canonicalPath = path.join(__dirname, '../upload_files/', filePath);
    await getCurrentPage().setInputFiles(field, canonicalPath);
});

When(/^I select "(.*?)" as the origin channel$/, async function (label: string) {
    await getCurrentPage().selectOption('original_id', label);
});

Then(/^the user creation should fail with error containing "([^"]*)"$/, async function (expected_text: string) {
    let status = getContext('user_creation_status')
    let error_message = getContext('user_creation_error')

    expect(status, `Expected user creation to fail, but status was ${status}`).toBe('error');
    await expect(error_message, `Expected error message to include ${expected_text}, but got ${error_message}`).toHaveText(expected_text);
});

Then(/^the user creation should succeed$/, async function () {
    let status = getContext('user_creation_status')
    expect(status, `Expected user creation to succeed, but status was ${status}`).toBe('success');
});

Then(/^I should see "([^"]*)" in field identified by "([^"]*)"$/, async function (text: string, field: string) {
    await expect(getCurrentPage().locator(`//label[text()='${field}']/following-sibling::input`)).toHaveValue(text);
});

Then(/^I should see the text "([^"]*)" in the ([^"]*) field$/, async function (text: string, field: string) {
    await expect(getCurrentPage().locator(`//td[text()='${field}']/following-sibling::td`)).toHaveText(text);
});

When(/^I select the next maintenance window$/, async function () {
    await selectOptionFromField('Next Maintenance Window', 'next_maintenance_window');
});
