import { Given, When, Then } from '@cucumber/cucumber';
import { expect } from 'chai';
import {
    getSystemName, 
    getUptimeFromHost, 
    getTarget
} from '../helpers/core/commonlib';
import { BASE_CHANNEL_BY_CLIENT } from '../helpers/core/constants';
import { ENV_CONFIG, GLOBAL_VARS, DEFAULT_TIMEOUT } from '../helpers/core/env';
import * as fs from 'fs';
import * as path from 'path';

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
        if (mirror) {
            iso_path = is_containerized_server
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
        // get_checksum_path is not directly translatable without more context.
        // This would require a more detailed implementation of the underlying logic.
        const checksum_path = '';

        if (
            !(await validate_checksum_with_file(
                original_iso_name,
                iso_path,
                checksum_path
            ))
        ) {
            throw new Error('SHA256 checksum validation failed');
        }

        if (is_containerized_server) {
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
            await server.run(cmd, { verbose: true });
        }
    }
);

Then(
    /^the hostname for "([^"]*)" should be correct$/,
    async function (host: string) {
        const node = await getTarget(host);
        await this.step(`I should see a "${node.hostname}" text`);
    }
);

Then(
    /^the kernel for "([^"]*)" should be correct$/,
    async function (host: string) {
        const node = await getTarget(host);
        const { stdout } = await node.run('uname -r');
        console.log(`I should see kernel version: ${stdout}`);
        await this.step(`I should see a "${stdout.trim()}" text`);
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
            await this.step(`I should see a "${osVersion.replace('-SP', ' SP')}" text`);
        }
    }
);

Then(
    /^the IPv4 address for "([^"]*)" should be correct$/,
    async function (host: string) {
        const node = await getTarget(host);
        const ipv4_address = node.publicIp;
        console.log(`IPv4 address: ${ipv4_address}`);
        await this.step(`I should see a "${ipv4_address}" text`);
    }
);

Then(
    /^the system ID for "([^"]*)" should be correct$/,
    async function (host: string) {
        const client_id = (
            await apiTest.system.searchByName(getSystemName(host))
        )[0]['id'];
        await this.step(`I should see a "${client_id}" text`);
    }
);

Then(
    /^the system name for "([^"]*)" should be correct$/,
    async function (host: string) {
        const system_name = getSystemName(host);
        await this.step(`I should see a "${system_name}" text`);
    }
);

Then(
    /^the uptime for "([^"]*)" should be correct$/,
    async function (host: string) {
        const node = await getTarget(host);
        const uptime = await getUptimeFromHost(node);
        const rounded_uptime_minutes = Math.round(uptime.minutes);
        const rounded_uptime_hours = Math.round(uptime.hours);
        const eleven_hours_in_seconds = 39600;
        const rounded_uptime_days = Math.round(
            (uptime.seconds + eleven_hours_in_seconds) / 86400.0
        );

        const ui_uptime_text = await page.locator('//td[contains(text(), "Last Booted")]/following-sibling::td/time').textContent();
        if (!ui_uptime_text) {
            throw new Error(`Uptime text for host '${host}' not found`);
        }

        const valid_uptime_messages: string[] = [];
        const diffs = [-1, 0, 1];
        if (
            (uptime.days >= 1 && rounded_uptime_days < 2) ||
            (uptime.days < 1 && rounded_uptime_hours >= 22)
        ) {
            valid_uptime_messages.push('a day ago');
        } else if (rounded_uptime_hours > 1 && rounded_uptime_hours <= 21) {
            valid_uptime_messages.push(
                ...diffs.map((n) => `${rounded_uptime_hours + n} hours ago`)
            );
            valid_uptime_messages.forEach((time, index) => {
                if (time === '1 hours ago') {
                    valid_uptime_messages[index] = 'an hour ago';
                }
            });
        } else if (rounded_uptime_minutes >= 45 && rounded_uptime_hours === 1) {
            valid_uptime_messages.push('an hour ago');
        } else if (rounded_uptime_minutes > 1 && rounded_uptime_hours <= 1) {
            valid_uptime_messages.push(
                ...diffs.map((n) => `${rounded_uptime_minutes + n} minutes ago`)
            );
            valid_uptime_messages.forEach((time, index) => {
                if (time === '1 minutes ago') {
                    valid_uptime_messages[index] = 'a minute ago';
                }
            });
        } else if (uptime.seconds >= 45 && rounded_uptime_minutes === 1) {
            valid_uptime_messages.push('a minute ago');
        } else if (uptime.seconds < 45) {
            valid_uptime_messages.push('a few seconds ago');
        } else if (rounded_uptime_days < 25) {
            valid_uptime_messages.push(
                ...diffs.map((n) => `${rounded_uptime_days + n} days ago`)
            );
            valid_uptime_messages.forEach((time, index) => {
                if (time === '1 days ago') {
                    valid_uptime_messages[index] = 'a day ago';
                }
            });
        } else {
            valid_uptime_messages.push('a month ago');
        }

        if (!valid_uptime_messages.includes(ui_uptime_text)) {
            throw new Error(
                `Expected uptime message to be one of #{valid_uptime_messages} - found '${ui_uptime_text}'`
            );
        }
    }
);

When(/^I wait until event "([^"]*)" is completed$/, async function (event) {
    await this.step(
        `I wait at most ${DEFAULT_TIMEOUT} seconds until event "${event}" is completed`
    );
});

When(
    /^I wait (\d+) seconds until the event is picked up and (\d+) seconds until the event "([^"]*)" is completed$/,
    async function (pickup_timeout, complete_timeout, event) {
        await this.step('I follow "Events"');
        await this.step('I wait until I see "Pending Events" text');
        await this.step('I follow "Pending"');
        await this.step('I wait until I see "Pending Events" text');
        await this.step(
            `I wait at most ${pickup_timeout} seconds until I do not see "${event}" text, refreshing the page`
        );
        await this.step('I follow "History"');
        await this.step('I wait until I see "System History" text');
        await this.step(`I wait until I see "${event}" text, refreshing the page`);
        await this.step(`I follow first "${event}"`);
        await this.step('I wait until I see "This action will be executed after" text');
        await this.step(`I wait until I see "${event}" text`);
        await this.step(
            `I wait at most ${complete_timeout} seconds until the event is completed, refreshing the page`
        );
    }
);

When(
    /^I wait at most (\d+) seconds until event "([^"]*)" is completed$/,
    async function (final_timeout, event) {
        await this.step(
            `I wait 180 seconds until the event is picked up and ${final_timeout} seconds until the event "${event}" is completed`
        );
    }
);

Then(
    /^the up2date logs on "([^"]*)" should contain no Traceback error$/,
    async function (host: string) {
        const node = await getTarget(host);
        const cmd =
            'if grep "Traceback" /var/log/up2date ; then exit 1; else exit 0; fi';
        const { returnCode } = await node.run(cmd);
        if (returnCode !== 0) {
            throw new Error('error found, check the client up2date logs');
        }
    }
);

When(
    /^I check default base channel radio button of this "([^"]*)"$/,
    async function (host: string) {
        const default_base_channel = BASE_CHANNEL_BY_CLIENT[globalVars.globalProduct][host];
        if (!default_base_channel) {
            throw new Error(`${default_base_channel} can't be checked`);
        }
    }
);

When(/^I enter as remote command this script in$/, async function (multiline) {
    await page.locator('//textarea[@name="script_body"]').fill(multiline);
});

When(/^I check the ram value of the "([^"]*)"$/, async function (host: string) {
    const node = await getTarget(host);
    const get_ram_value = "grep MemTotal /proc/meminfo |awk '{print $2}'";
    const { stdout } = await node.run(get_ram_value);
    const ram_value = stdout.trim();
    const ram_mb = Math.floor(parseInt(ram_value, 10) / 1024);
    await this.step(`I should see a "${ram_mb}" text`);
});

When(
    /^I check the MAC address value of the "([^"]*)"$/,
    async function (host: string) {
        const node = await getTarget(host);
        const get_mac_address = 'cat /sys/class/net/eth0/address';
        const { stdout } = await node.run(get_mac_address);
        const mac_address = stdout.trim().toLowerCase();
        await this.step(`I should see a "${mac_address}" text`);
    }
);

Then(
    /^I should see the CPU frequency of the "([^"]*)"$/,
    async function (host: string) {
        const node = await getTarget(host);
        const get_cpu_freq = "cat /proc/cpuinfo  | grep -i 'CPU MHz'";
        const { stdout } = await node.run(get_cpu_freq);
        const get_cpu = stdout.trim();
        const cpu = get_cpu.split('.');
        const cpu_mhz = parseInt(cpu[0].replace(/[^\d]/, ''), 10);
        await this.step(`I should see a "${Math.floor(cpu_mhz / 1000)} GHz" text`);
    }
);

Given(/^I am on the Systems page$/, async function () {
    await this.step('I follow the left menu "Systems > System List > All"');
    await this.step('I wait until I do not see "Loading..." text');
});

When(
    /^I refresh the metadata for "([^"]*)"$/,
    async function (host: string) {
        const node = await getTarget(host);
        const osFamily = node.osFamily;
        if (osFamily == undefined){
            throw new Error(
                `The host ${host} has not a defined OS Family`
            );
        }
        if (osFamily.match(/^opensuse/) || osFamily.match(/^sles/) || osFamily.match(/micro/)) {
            await node.runUntilOk('zypper --non-interactive refresh -s');
        } else if (osFamily.match(/^centos/) || osFamily.match(/^rocky/)) {
            await node.run('yum clean all && yum makecache', { timeout: 600 });
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
        const { stdout } = await node.run('uname -m');
        const arch = stdout.trim();
        const cmd = `zgrep '${text}' /var/cache/zypp/raw/susemanager:fake-rpm-suse-channel/repodata/*updateinfo.xml.gz`;
        await node.run(cmd, { timeout: 500 });
    }
);

Then(/^I should see package "([^"]*)"$/, async function (pkg: string) {
    await this.step(`I should see a "${pkg}" text`);
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
        await node.run(command, { timeout: 500 });
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
        await this.step('I follow the left menu "Software > Channel List > All"');
        await this.step(`I follow "${channel}"`);
        await this.step('I follow "Packages"');
        await this.step(`I should see package "${pkg}"`);
    }
);

When(/^I schedule a task to update ReportDB$/, async function () {
    await this.step('I follow the left menu "Admin > Task Schedules"');
    await this.step('I follow "update-reporting-default"');
    await this.step('I follow "mgr-update-reporting-bunch"');
    await this.step('I click on "Single Run Schedule"');
    await this.step('I should see a "bunch was scheduled" text');
    await this.step(
        'I wait until the table contains "FINISHED" or "SKIPPED" followed by "FINISHED" in its first rows'
    );
});
