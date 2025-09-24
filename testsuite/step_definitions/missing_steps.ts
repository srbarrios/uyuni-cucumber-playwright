import { When, Then, Given } from '@cucumber/cucumber';
import { getTarget } from '../helpers/core/commonlib';
import { page } from '../helpers/core/commonlib';
import { apiTest } from '../helpers/core/commonlib';
import { getSystemName } from '../helpers/core/commonlib';
import { save_screenshot } from '../helpers/core/commonlib';
import { attach } from '../helpers/core/commonlib';
import { repeatUntilTimeout } from '../helpers/core/commonlib';
import { refreshPage } from '../helpers/core/commonlib';
import * as fs from 'fs';
import * as path from 'path';

// Missing steps from common_steps.rb

When(/^I save a screenshot as "([^"]+)"$/, async function (filename: string) {
    await save_screenshot(filename);
    // Note: In TypeScript, we'd need to implement the attach functionality differently
    // This would typically involve using Playwright's screenshot capabilities
});

Then(/^the IPv6 address for "([^"]*)" should be correct$/, async function (host: string) {
    const node = await getTarget(host);
    const { stdout: interfaceOutput } = await node.run(`ip -6 address show ${node.publicInterface}`);
    
    const lines = interfaceOutput.split('\n');
    // selects only lines with IPv6 addresses and proceeds to form an array with only those addresses
    const ipv6AddressesList = lines.filter(line => /2[:0-9a-f]*|fe80:[:0-9a-f]*/.test(line))
        .map(line => line.match(/2[:0-9a-f]*|fe80:[:0-9a-f]*/)?.[0])
        .filter((addr): addr is string => addr !== undefined);
    
    // confirms that the IPv6 address shown on the page is part of that list and, therefore, valid
    const ipv6Address = await page.locator('//td[text()=\'IPv6 Address:\']/following-sibling::td[1]').textContent();
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
        const currentMinute = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
        const previousMinute = new Date(now.getTime() - 60000).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
        
        try {
            const element = await page.locator(`//a[contains(text(),'${event}')]/../..//td[4]/time[contains(text(),'${currentMinute}') or contains(text(),'${previousMinute}')]/../../td[3]/a[1]`).first();
            if (await element.isVisible({ timeout: 1000 })) {
                return true;
            }
        } catch (error) {
            // ignored - pending actions cannot be found
        }
        
        await refreshPage();
        return false;
    }, { message: `Couldn't find the event ${event}` });
});

When(/^I follow the event "([^"]*)" completed during last minute$/, async function (event: string) {
    const now = new Date();
    const currentMinute = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
    const previousMinute = new Date(now.getTime() - 60000).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
    
    const xpathQuery = `//a[contains(text(), '${event}')]/../..//td[4]/time[contains(text(),'${currentMinute}') or contains(text(),'${previousMinute}')]/../../td[3]/a[1]`;
    const element = await page.locator(xpathQuery).first();
    await element.click();
});

Then(/^I should see the power is "([^"]*)"$/, async function (status: string) {
    // This would need to be implemented with proper XPath navigation in Playwright
    // For now, we'll leave a placeholder
    throw new Error('Power status check not yet implemented');
});

When(/^I check radio button "(.*?)"$/, async function (radio_button: string) {
    // In Playwright/Cucumber TypeScript, we'd check if a radio button is already checked
    // and then choose it if not
    // This is a simplified implementation
    const radioButton = await page.locator(`input[type="radio"][value="${radio_button}"]`).first();
    if (await radioButton.isChecked()) {
        console.log(`Warning: Radio button '${radio_button}' is already checked`);
    } else {
        // We would need to implement the actual "choose" functionality
        // This is a placeholder
        console.log(`${radio_button} can't be checked`);
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
    await buildHost.run(`zypper --non-interactive in ${packages}`, { timeout: 600 });
});

When(/^I attach the file "(.*)" to "(.*)"$/, async function (filePath: string, field: string) {
    // Construct the canonical path
    const canonicalPath = path.join(__dirname, '../upload_files/', filePath);
    // In Playwright, we would use page.setInputFiles to attach a file
    await page.setInputFiles(field, canonicalPath);
});

When(/^I select "(.*?)" as the origin channel$/, async function (label: string) {
    // This would simulate selecting an option from a dropdown
    // In Playwright, we'd use page.selectOption or similar
    await page.selectOption('original_id', label);
});

Then(/^the user creation should fail with error containing "([^"]*)"$/, async function (expected_text: string) {
    // This would depend on how user creation status is tracked in the TypeScript version
    // Placeholder implementation
    throw new Error('User creation status checking not yet implemented');
});

Then(/^the user creation should succeed$/, async function () {
    // This would depend on how user creation status is tracked in the TypeScript version
    // Placeholder implementation
    throw new Error('User creation status checking not yet implemented');
});
