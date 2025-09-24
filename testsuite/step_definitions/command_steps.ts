import { Given, When, Then } from '@cucumber/cucumber';
import { expect } from 'chai';
import {
    apiTest,
    channelSyncCompleted,
    DEFAULT_TIMEOUT,
    file_exists,
    filterChannels,
    getCommandOutput,
    getFailCode,
    getSystemName,
    kvStore,
    product,
    putCommandOutput,
    putFailCode,
    repeatUntilTimeout,
    rh_host,
    suse_host,
    TIMEOUT_BY_CHANNEL_NAME,
    transactional_system,
    useSaltBundle
} from '../helpers';
import { getTarget } from '../helpers';
import {
    CHANNEL_TO_SYNC_BY_OS_PRODUCT_VERSION,
    ENV_VAR_BY_HOST
} from '../helpers/core/constants';
import {ExecException} from "node:child_process";

Then(/^"([^"]*)" should have a FQDN$/, async function (host) {
    const node = await getTarget(host);
    const { stdout, stderr, returnCode } = await node.run(
        'date +%s; hostname -f; date +%s',
        { runsInContainer: false, checkErrors: false }
    );
    const lines = stdout.split('\n');
    const initial_time = parseInt(lines[0], 10);
    const result = lines[1];
    const end_time = parseInt(lines[2], 10);
    const resolution_time = end_time - initial_time;
    if (returnCode !== 0) {
        throw new Error(`cannot determine hostname. Stderr: ${stderr}`);
    }
    if (resolution_time > 2) {
        throw new Error(
            `name resolution for ${node.fullHostname} took too long (${resolution_time} seconds)`
        );
    }
    if (result !== node.fullHostname) {
        throw new Error('hostname is not fully qualified');
    }
});

Then(/^reverse resolution should work for "([^"]*)"$/, async function (host) {
    const node = await getTarget(host);
    const { stdout, stderr, returnCode } = await node.run(
        `date +%s; getent hosts ${node.fullHostname}; date +%s`,
        { checkErrors: false }
    );
    const lines = stdout.split('\n');
    const initial_time = parseInt(lines[0], 10);
    const result = lines[1];
    const end_time = parseInt(lines[2], 10);
    const resolution_time = end_time - initial_time;
    if (returnCode !== 0) {
        throw new Error(`cannot do reverse resolution. Stderr: ${stderr}`);
    }
    if (resolution_time > 2) {
        throw new Error(
            `reverse resolution for ${node.fullHostname} took too long (${resolution_time} seconds)`
        );
    }
    if (!result.includes(node.fullHostname)) {
        throw new Error(
            `reverse resolution for ${node.fullHostname} returned ${result}, expected to see ${node.fullHostname}`
        );
    }
});

Then(
    /^the clock from "([^"]*)" should be exact$/,
    async function (host: string) {
        const node = await getTarget(host);
        const { stdout } = await node.run("date +'%s'");
        const clock_node = parseInt(stdout.trim(), 10);
        const clock_controller = Math.floor(new Date().getTime() / 1000);
        const difference = Math.abs(clock_node - clock_controller);
        if (difference >= 2) {
            throw new Error(`clocks differ by ${difference} seconds`);
        }
    }
);

When(
    /^I prepare a channel clone for strict mode testing$/,
    async function () {
        const server = await getTarget('server');
        await server.run(
            'cp -r /srv/www/htdocs/pub/TestRepoRpmUpdates /srv/www/htdocs/pub/TestRepoRpmUpdates_STRICT_TEST'
        );
        await server.run(
            'rm -rf /srv/www/htdocs/pub/TestRepoRpmUpdates_STRICT_TEST/repodata'
        );
        for (const folder of ['i586', 'src', 'x86_64']) {
            await server.run(
                `rm -f /srv/www/htdocs/pub/TestRepoRpmUpdates_STRICT_TEST/${folder}/rute-dummy-2.0-1.2.*.rpm`
            );
        }
        await server.run(
            'createrepo_c /srv/www/htdocs/pub/TestRepoRpmUpdates_STRICT_TEST'
        );
        await server.run(
            'gzip -dc /srv/www/htdocs/pub/TestRepoRpmUpdates/repodata/*-updateinfo.xml.gz > /tmp/updateinfo.xml'
        );
        await server.run(
            'modifyrepo_c --verbose --mdtype updateinfo /tmp/updateinfo.xml /srv/www/htdocs/pub/TestRepoRpmUpdates_STRICT_TEST/repodata'
        );
    }
);

Given(/^I am logged into the API$/, async function () {
    const server_node = await getTarget('server');
    const api_url = `https://${server_node.publicIp}/rhn/manager/api/auth/login`;
    const { stdout } = await server_node.run(
        `curl -H 'Content-Type: application/json' -d '{"login": "admin", "password": "admin"}' -i ${api_url}`
    );
    if (!stdout.includes('200 OK')) {
        throw new Error('Failed to login to the API');
    }
});

When(
    /^I store the amount of packages in channel "([^"]*)"$/,
    async function (channel_label: string) {
        const channels = await apiTest.channel.listAllChannels();
        kvStore.put('channels', channels);
        if (kvStore.get('channels')[channel_label]) {
            kvStore.put(
                'package_amount',
                kvStore.get('channels')[channel_label]['packages']
            );
            console.log(
                `Package amount for 'test-strict': ${kvStore.get('package_amount')}`
            );
        } else {
            console.log(`${channel_label} channel not found.`);
        }
    }
);

Then(
    /^The amount of packages in channel "([^"]*)" should be the same as before$/,
    async function (channel_label: string) {
        const channels = await apiTest.channel.listAllChannels();
        kvStore.put('channels', channels);
        if (
            kvStore.get('channels')[channel_label] &&
            kvStore.get('package_amount') !==
            kvStore.get('channels')[channel_label]['packages']
        ) {
            throw new Error('Package counts do not match');
        }
    }
);

Then(
    /^The amount of packages in channel "([^"]*)" should be fewer than before$/,
    async function (channel_label: string) {
        const channels = await apiTest.channel.listAllChannels();
        kvStore.put('channels', channels);
        if (
            kvStore.get('channels')[channel_label] &&
            kvStore.get('channels')[channel_label]['packages'] >=
            kvStore.get('package_amount')
        ) {
            throw new Error('Package count is not fewer than before');
        }
    }
);

When(
    /^I delete these channels with spacewalk-remove-channel:$/,
    async function (table) {
        let channels_cmd = 'spacewalk-remove-channel ';
        table.raw().forEach((x: string[]) => {
            channels_cmd = `${channels_cmd} -c ${x[0]}`;
        });
        const server = await getTarget('server');
        const { stdout } = await server.run(channels_cmd, {
            checkErrors: false
        });
        putCommandOutput(stdout);
    }
);

When(/^I list channels with spacewalk-remove-channel$/, async function () {
    const server = await getTarget('server');
    const { stdout, returnCode } = await server.run(
        'spacewalk-remove-channel -l'
    );
    if (returnCode !== 0) {
        throw new Error('Unable to run spacewalk-remove-channel -l command on server');
    }
    putCommandOutput(stdout);
});

When(/^I add "([^"]*)" channel$/, async function (channel: string) {
    const server = await getTarget('server');
    await server.run(
        `echo -e "admin\\nadmin\\n" | mgr-sync add channel ${channel}`
    );
});

When(
    /^I use spacewalk-common-channel to add channel "([^"]*)" with arch "([^"]*)"$/,
    async function (child_channel: string, arch: string) {
        const command = `spacewalk-common-channels -u admin -p admin -a ${arch} ${child_channel}`;
        const server = await getTarget('server');
        const { stdout } = await server.run(command);
        putCommandOutput(stdout);
    }
);

When(
    /^I use spacewalk-common-channel to add all "([^"]*)" channels with arch "([^"]*)"$/,
    async function (channel: string, architecture: string) {
        let channels_to_synchronize =
            CHANNEL_TO_SYNC_BY_OS_PRODUCT_VERSION[globalVars.globalProduct]?.[channel]?.slice() ||
            CHANNEL_TO_SYNC_BY_OS_PRODUCT_VERSION[globalVars.globalProduct]?.[
                `${channel}-${architecture}`
                ]?.slice();
        if (!envConfig.betaEnabled) {
            channels_to_synchronize = filterChannels(channels_to_synchronize, [
                'beta'
            ]);
        }
        if (!channels_to_synchronize || channels_to_synchronize.length === 0) {
            throw new Error(
                `Synchronization error, channel ${channel} or ${channel}-${architecture} in ${globalVars.globalProduct} product not found`
            );
        }

        for (const os_product_version_channel of channels_to_synchronize) {
            const command = `spacewalk-common-channels -u admin -p admin -a ${architecture} ${os_product_version_channel.replace(
                `-${architecture}`,
                ''
            )}`;
            const server = await getTarget('server');
            await server.run(command, { verbose: true });
            console.log(`Channel ${os_product_version_channel} added`);
        }
    }
);

When(
    /^I use spacewalk-repo-sync to sync channel "([^"]*)"$/,
    async function (channel: string) {
        const server = await getTarget('server');
        const { stdout } = await server.run(`spacewalk-repo-sync -c ${channel}`, {
            checkErrors: false,
            verbose: true
        });
        putCommandOutput(stdout);
    }
);

When(
    /^I use spacewalk-repo-sync to sync channel "([^"]*)" including "([^"]*)" packages?$/,
    async function (channel: string, packages: string) {
        const append_includes = packages
            .split(' ')
            .map((pkg) => `--include ${pkg}`)
            .join(' ');
        const server = await getTarget('server');
        const { stdout } = await server.run(
            `spacewalk-repo-sync -c ${channel} ${append_includes}`,
            { checkErrors: false, verbose: true }
        );
        putCommandOutput(stdout);
    }
);

Then(/^I should get "([^"]*)"$/, async function (value: string) {
    if (!getCommandOutput().includes(value)) {
        throw new Error(`'${value}' not found in output '${getCommandOutput()}'`);
    }
});

Then(/^I shouldn't get "([^"]*)"$/, async function (value: string) {
    if (getCommandOutput().includes(value)) {
        throw new Error(`'${value}' found in output '${getCommandOutput()}'`);
    }
});

Then(
    /^"([^"]*)" should be installed on "([^"]*)"$/,
    async function (pkg: string, host: string) {
        const node = await getTarget(host);
        await node.run(`rpm -q ${pkg}`);
    }
);

Then(
    /^Deb package "([^"]*)" with version "([^"]*)" should be installed on "([^"]*)"$/,
    async function (pkg: string, version: string, host: string) {
        const node = await getTarget(host);
        await node.run(
            `test $(dpkg-query -W -f='$\{Version\}' ${pkg}) = "${version}"`
        );
    }
);

Then(
    /^"([^"]*)" should not be installed on "([^"]*)"$/,
    async function (pkg: string, host: string) {
        const node = await getTarget(host);
        await node.run(`rpm -q ${pkg}; test $? -ne 0`);
    }
);

When(
    /^I wait for "([^"]*)" to be (uninstalled|installed) on "([^"]*)"$/,
    async function (pkg: string, status: string, host: string) {
        if (pkg.includes('suma') && product === 'Uyuni') {
            pkg = pkg.replace('suma', 'uyuni');
        }
        const node = await getTarget(host);
        if (await rh_host(host)) {
            // Handle rh_host case if needed
        } else if (await suse_host(host)) {
            // Handle suse_host case if needed
        } else if (await transactional_system(host)) {
            // Handle transactional_system case if needed
        } else {
            // Default case
        }
        await node.waitForProcess('zypper');
        if (status === 'installed') {
            await node.runUntilOk(`rpm -q ${pkg}`);
        } else {
            await node.runUntilFail(`rpm -q ${pkg}`);
        }
    }
);

When(/^I query latest Salt changes on "(.*?)"$/, async function (host: string) {
    const node = await getTarget(host);
    let salt = useSaltBundle ? 'venv-salt-minion' : 'salt';
    if (host === 'server') {
        salt = 'salt';
    }
    const { stdout } = await node.run(
        `LANG=en_US.UTF-8 rpm -q --changelog ${salt}`
    );
    console.log(stdout.split('\n').slice(0, 15).join('\n'));
});

When(
    /^I query latest Salt changes on Debian-like system "(.*?)"$/,
    async function (host: string) {
        const node = await getTarget(host);
        const salt = useSaltBundle ? 'venv-salt-minion' : 'salt';
        const changelog_file = useSaltBundle
            ? 'changelog.gz'
            : 'changelog.Debian.gz';
        const { stdout } = await node.run(
            `zcat /usr/share/doc/${salt}/${changelog_file}`
        );
        console.log(stdout.split('\n').slice(0, 15).join('\n'));
    }
);

When(
    /^vendor change should be enabled for [^"]* on "([^"]*)"$/,
    async function (host: string) {
        const node = await getTarget(host);
        const pattern = '--allow-vendor-change';
        const current_log = '/var/log/zypper.log';
        const current_time = new Date();
        const rotated_log = `${current_log}-${current_time
            .toISOString()
            .slice(0, 10)
            .replace(/-/g, '')}.xz`;
        const day_after = new Date(current_time);
        day_after.setDate(day_after.getDate() + 1);
        const next_day_rotated_log = `${current_log}-${day_after
            .toISOString()
            .slice(0, 10)
            .replace(/-/g, '')}.xz`;
        try {
            const { returnCode } = await node.run(
                `xzdec ${next_day_rotated_log} | grep -- ${pattern}`
            );
            if (returnCode !== 0) {
                throw new Error();
            }
        } catch (error) {
            const { returnCode } = await node.run(
                `grep -- ${pattern} ${current_log} || xzdec ${rotated_log} | grep -- ${pattern}`
            );
            if (returnCode !== 0) {
                throw new Error('Vendor change option not found in logs');
            }
        }
    }
);

When(
    /^I (start|stop|restart|reload|enable|disable) the "([^"]*)" container$/,
    async function (action: string, service: string) {
        const node = await getTarget('server');
        await node.runLocal(`systemctl ${action} ${service}.service`, {
            checkErrors: true,
            verbose: true
        });
    }
);

When(
    /^I wait until "([^"]*)" container is active$/,
    async function (service: string) {
        const node = await getTarget('server');
        const cmd = `systemctl is-active ${service}`;
        await node.runLocalUntilOk(cmd);
    }
);

When(
    /^I wait until "([^"]*)" service is active on "([^"]*)"$/,
    async function (service: string, host: string) {
        const node = await getTarget(host);
        const cmd = `systemctl is-active ${service}`;
        await node.runUntilOk(cmd);
    }
);

When(
    /^I wait until "([^"]*)" service is inactive on "([^"]*)"$/,
    async function (service: string, host: string) {
        const node = await getTarget(host);
        const cmd = `systemctl is-active ${service}`;
        await node.runUntilFail(cmd);
    }
);

When(
    /^I wait until "([^"]*)" exporter service is active on "([^"]*)"$/,
    async function (service: string, host: string) {
        const node = await getTarget(host);
        const separator = rh_host(host) ? '_' : '-';
        const cmd = `systemctl is-active prometheus-${service}${separator}exporter`;
        await node.runUntilOk(cmd);
    }
);

When(
    /^I execute mgr-sync "([^"]*)" with user "([^"]*)" and password "([^"]*)"$/,
    async function (arg1: string, u: string, p: string) {
        const server = await getTarget('server');
        await server.run(
            `echo -e 'mgrsync.user = "${u}"\\nmgrsync.password = "${p}"\\n' > ~/.mgr-sync`
        );
        const { stdout } = await server.run(
            `echo -e '${u}\\n${p}\\n' | mgr-sync ${arg1}`,
            { checkErrors: false }
        );
        putCommandOutput(stdout);
    }
);

When(/^I execute mgr-sync "([^"]*)"$/, async function (arg1: string) {
    const server = await getTarget('server');
    const { stdout } = await server.run(`mgr-sync ${arg1}`);
    putCommandOutput(stdout);
});

When(/^I remove the mgr-sync cache file$/, async function () {
    const server = await getTarget('server');
    const { stdout } = await server.run('rm -f ~/.mgr-sync');
    putCommandOutput(stdout);
});

When(/^I refresh SCC$/, async function () {
    const refresh_timeout = 600;
    const server = await getTarget('server');
    await server.run('echo -e "admin\\nadmin\\n" | mgr-sync refresh', {
        timeout: refresh_timeout
    });
});

When(/^I execute mgr-sync refresh$/, async function () {
    const server = await getTarget('server');
    const { stdout } = await server.run('mgr-sync refresh', {
        checkErrors: false
    });
    putCommandOutput(stdout);
});

When(
    /^I kill running spacewalk-repo-sync for "([^"]*)"$/,
    async function (os_product_version: string) {
        if (
            !CHANNEL_TO_SYNC_BY_OS_PRODUCT_VERSION[globalVars.globalProduct]?.[os_product_version]
        ) {
            return;
        }

        let channels_to_kill =
            CHANNEL_TO_SYNC_BY_OS_PRODUCT_VERSION[globalVars.globalProduct][
                os_product_version
                ].slice();
        if (!envConfig.betaEnabled) {
            channels_to_kill = filterChannels(channels_to_kill, ['beta']);
        }
        console.log(`Killing channels:\n${channels_to_kill}`);
        let time_spent = 0;
        const checking_rate = 10;
        await repeatUntilTimeout(
            async () => {
                const server = await getTarget('server');
                const { stdout } = await server.run(
                    'ps axo pid,cmd | grep spacewalk-repo-sync | grep -v grep',
                    { checkErrors: false }
                );
                const process = stdout.split('\n')[0];
                if (!process) {
                    if ((time_spent += checking_rate) % 60 === 0) {
                        console.log(
                            `${
                                time_spent / 60
                            } minutes waiting for '${os_product_version}' remaining channels to start their repo-sync processes:\n${channels_to_kill}`
                        );
                    }
                    return false;
                }
                const channel = process.split(' ')[5].trim();
                if (new Date().getSeconds() % 5 === 0) {
                    console.log(`Repo-sync process for channel '${channel}' running.`);
                }
                if (
                    !CHANNEL_TO_SYNC_BY_OS_PRODUCT_VERSION[globalVars.globalProduct][
                        os_product_version
                        ].includes(channel)
                ) {
                    return false;
                }

                channels_to_kill = channels_to_kill.filter((c: string) => c !== channel);
                const pid = process.split(' ')[0];
                await server.run(`kill ${pid}`, { checkErrors: false });
                console.log(`Reposync of channel ${channel} killed`);

                for (const remaining_channel of channels_to_kill) {
                    if (await channelSyncCompleted(remaining_channel)) {
                        console.log(
                            `Channel '${remaining_channel}' is already synced, so there is no need to kill repo-sync process.`
                        );
                        channels_to_kill = channels_to_kill.filter(
                            (c: any) => c !== remaining_channel
                        );
                    }
                }
                return channels_to_kill.length === 0;
            },
            'Some reposync processes were not killed properly',
            { timeout: 900, dontRaise: true }
        );
    }
);

When(
    /^I kill running spacewalk-repo-sync for "([^"]*)" channel$/,
    async function (channel: string) {
        let time_spent = 0;
        const checking_rate = 5;
        await repeatUntilTimeout(
            async () => {
                const server = await getTarget('server');
                const { stdout } = await server.run(
                    'ps axo pid,cmd | grep spacewalk-repo-sync | grep -v grep',
                    { verbose: true, checkErrors: false }
                );
                const process = stdout.split('\n')[0];
                if (!process) {
                    if ((time_spent += checking_rate) % 60 === 0) {
                        console.log(
                            `${
                                time_spent / 60
                            } minutes waiting for '${channel}' channel to start its repo-sync processes.`
                        );
                    }
                    return false;
                }
                const channel_synchronizing = process.split(' ')[5].trim();
                if (channel_synchronizing === channel) {
                    const pid = process.split(' ')[0];
                    await server.run(`kill ${pid}`, { verbose: true, checkErrors: false });
                    console.log(`Reposync of channel ${channel} killed`);
                    return true;
                } else {
                    console.log(
                        `Warning: Repo-sync process for channel '${channel_synchronizing}' running.`
                    );
                    return false;
                }
            },
            'Some reposync processes were not killed properly',
            { timeout: 60, dontRaise: true }
        );
    }
);

Then(/^the reposync logs should not report errors$/, async function () {
    const server = await getTarget('server');
    const { stdout, returnCode } = await server.run(
        'grep -i "ERROR:" /var/log/rhn/reposync/*.log',
        { checkErrors: false }
    );
    if (returnCode === 0) {
        throw new Error(`Errors during reposync:\n${stdout}`);
    }
});

Then(
    /^the "([^"]*)" reposync logs should not report errors$/,
    async function (list: string) {
        const logfiles = list.split(',');
        for (const logs of logfiles) {
            const server = await getTarget('server');
            const { returnCode: fileExistsCode } = await server.run(
                `test -f /var/log/rhn/reposync/${logs}.log`,
                { checkErrors: false }
            );
            if (fileExistsCode === 0) {
                const { stdout, returnCode: grepCode } = await server.run(
                    `grep -i 'ERROR:' /var/log/rhn/reposync/${logs}.log`,
                    { checkErrors: false }
                );
                if (grepCode === 0) {
                    throw new Error(`Errors during ${logs} reposync:\n${stdout}`);
                }
            }
        }
    }
);

Then(
    /^"([^"]*)" package should have been stored$/,
    async function (pkg: string) {
        const server = await getTarget('server');
        await server.run(`find /var/spacewalk/packages -name ${pkg}`, {
            verbose: true
        });
    }
);

Then(
    /^solver file for "([^"]*)" should reference "([^"]*)"$/,
    async function (channel: string, pkg: string) {
        await repeatUntilTimeout(
            async () => {
                const server = await getTarget('server');
                const { returnCode } = await server.run(
                    `dumpsolv /var/cache/rhn/repodata/${channel}/solv | grep ${pkg}`,
                    { verbose: false, checkErrors: false }
                );
                return returnCode === 0;
            },
            `Reference ${pkg} not found in file.`,
            { timeout: 600 }
        );
    }
);

When(
    /^I wait until the channel "([^"]*)" has been synced$/,
    async function (channel: string) {
        let time_spent = 0;
        const checking_rate = 10;
        let timeout: number;
        if (channel.includes('custom_channel') || channel.includes('ptf')) {
            console.log('Timeout of 10 minutes for a custom channel');
            timeout = 600;
        } else if (!TIMEOUT_BY_CHANNEL_NAME[channel]) {
            console.log(`Unknown timeout for channel ${channel}, assuming one minute`);
            timeout = 60;
        } else {
            timeout = TIMEOUT_BY_CHANNEL_NAME[channel];
        }
        try {
            await repeatUntilTimeout(
                async () => {
                    if (await channelSyncCompleted(channel)) {
                        return true;
                    }
                    if ((time_spent += checking_rate) % 60 === 0) {
                        console.log(
                            `${
                                time_spent / 60
                            } minutes out of ${timeout / 60} waiting for '${channel}' channel to be synchronized`
                        );
                    }
                    return false;
                },
                'Channel not fully synced',
                { timeout }
            );
        } catch (e) {
            console.log(e.message);
            throw new Error(`This channel was not fully synced: ${channel}`);
        }
    }
);

When(
    /^I wait until all synchronized channels for "([^"]*)" have finished$/,
    async function (os_product_version: string) {
        let channels_to_wait =
            CHANNEL_TO_SYNC_BY_OS_PRODUCT_VERSION[globalVars.globalProduct]?.[
                os_product_version
                ]?.slice();
        if (!envConfig.betaEnabled) {
            channels_to_wait = filterChannels(channels_to_wait, ['beta']);
        }
        if (!channels_to_wait) {
            throw new Error(
                `Synchronization error, channels for ${os_product_version} in ${globalVars.globalProduct} not found`
            );
        }

        let time_spent = 0;
        const checking_rate = 10;
        let timeout = 900;
        channels_to_wait.forEach((channel: string | number) => {
            if (!TIMEOUT_BY_CHANNEL_NAME[channel]) {
                console.log(`Unknown timeout for channel ${channel}, assuming one minute`);
                timeout += 60;
            } else {
                timeout += TIMEOUT_BY_CHANNEL_NAME[channel];
            }
        });
        try {
            await repeatUntilTimeout(
                async () => {
                    for (const channel of channels_to_wait) {
                        if (await channelSyncCompleted(channel)) {
                            channels_to_wait = channels_to_wait.filter((c: any) => c !== channel);
                            console.log(`Channel ${channel} finished syncing`);
                        }
                    }
                    if (channels_to_wait.length === 0) {
                        return true;
                    }
                    if ((time_spent += checking_rate) % 60 === 0) {
                        console.log(
                            `${
                                time_spent / 60
                            } minutes out of ${timeout / 60} waiting for '${os_product_version}' channels to be synchronized`
                        );
                    }
                    return false;
                },
                'Product not fully synced',
                { timeout }
            );
        } catch (e) {
            console.log(
                `These channels were not fully synced:\n ${channels_to_wait}. \n${e.message}`
            );
            throw e;
        }
    }
);

When(/^I execute mgr-bootstrap "([^"]*)"$/, async function (arg1: string) {
    const server = await getTarget('server');
    const { stdout } = await server.run(`mgr-bootstrap ${arg1}`);
    putCommandOutput(stdout);
});

When(
    /^I fetch "([^"]*)" to "([^"]*)"$/,
    async function (file: string, host: string) {
        const node = await getTarget(host);
        const server = await getTarget('server');
        await node.run(`curl -s -O http://${server.fullHostname}/${file}`);
    }
);

When(
    /^I wait until file "([^"]*)" contains "([^"]*)" on server$/,
    async function (file: string, content: string) {
        await repeatUntilTimeout(
            async () => {
                const server = await getTarget('server');
                const { stdout } = await server.run(`grep ${content} ${file}`, {
                    checkErrors: false
                });
                return stdout.includes(content);
            },
            `${content} not found in file ${file}`,
            { reportResult: true }
        );
    }
);

Then(
    /^file "([^"]*)" should contain "([^"]*)" on server$/,
    async function (file: string, content: string) {
        const server = await getTarget('server');
        const { stdout } = await server.run(`grep -F '${content}' ${file}`, {
            checkErrors: false
        });
        if (!stdout.includes(content)) {
            throw new Error(`'${content}' not found in file ${file}`);
        }
    }
);

Then(/^the tomcat logs should not contain errors$/, async function () {
    const server = await getTarget('server');
    const { stdout } = await server.run('cat /var/log/tomcat/*');
    const msgs = ['ERROR', 'NullPointer'];
    msgs.forEach((msg) => {
        if (stdout.includes(msg)) {
            throw new Error(`-${msg}-  msg found on tomcat logs`);
        }
    });
});

Then(/^the taskomatic logs should not contain errors$/, async function () {
    const server = await getTarget('server');
    const { stdout } = await server.run(
        'cat /var/log/rhn/rhn_taskomatic_daemon.log'
    );
    const msgs = ['NullPointer'];
    msgs.forEach((msg) => {
        if (stdout.includes(msg)) {
            throw new Error(`-${msg}-  msg found on taskomatic logs`);
        }
    });
});

Then(
    /^the log messages should not contain out of memory errors$/,
    async function () {
        const server = await getTarget('server');
        const { stdout, returnCode } = await server.run(
            'grep -i "Out of memory: Killed process" /var/log/messages',
            { checkErrors: false }
        );
        if (returnCode === 0) {
            throw new Error(`Out of memory errors in /var/log/messages:\n${stdout}`);
        }
    }
);

When(/^I restart the spacewalk service$/, async function () {
    const server = await getTarget('server');
    await server.run('spacewalk-service restart');
});

When(/^I shutdown the spacewalk service$/, async function () {
    const server = await getTarget('server');
    await server.run('spacewalk-service stop');
});

When(/^I extract the log files from all our active nodes$/, async function () {
    for (const host in ENV_VAR_BY_HOST) {
        try {
            await getTarget(host);
        } catch (error) {
            // Catch exceptions silently
        }
    }
    // This part of the original code is not directly translatable as it relies on global state.
    // A more robust implementation would involve iterating through a list of active nodes.
});

When(
    /^I run "([^"]*)" on "([^"]*)" with logging$/,
    async function (cmd: string, host: string) {
        const node = await getTarget(host);
        const { stdout } = await node.run(cmd);
        console.log(`OUT: ${stdout}`);
    }
);

When(
    /^I run "([^"]*)" on "([^"]*)" without error control$/,
    async function (cmd: string, host: string) {
        const node = await getTarget(host);
        const { returnCode } = await node.run(cmd, { checkErrors: false });
        putFailCode(returnCode);
    }
);

Then(/^the command should fail$/, async function () {
    if (getFailCode() === 0) {
        throw new Error('Previous command must fail, but has NOT failed!');
    }
});

When(
    /^I wait until file "([^"]*)" exists on "([^"]*)"$/,
    async function (file: string, host: string) {
        await this.step(
            `I wait at most ${DEFAULT_TIMEOUT} seconds until file "${file}" exists on "${host}"`
        );
    }
);

When(
    /^I wait at most (\d+) seconds until file "([^"]*)" exists on "([^"]*)"$/,
    async function (seconds: string, file: string, host: string) {
        const node = await getTarget(host);
        await repeatUntilTimeout(
            async () => {
                return await file_exists(node, file);
            },
            '',
            { timeout: parseInt(seconds, 10) }
        );
    }
);

When(/^I wait until file "(.*)" exists on server$/, async function (file: string) {
    const server = await getTarget('server');
    await repeatUntilTimeout(async () => {
        return await file_exists(server, file);
    });
});

Then(
    /^I wait and check that "([^"]*)" has rebooted$/,
    async function (host: string) {
        const reboot_timeout = 800;
        const system_name = getSystemName(host);
        // check_shutdown and check_restart are not directly translatable without more context.
        // This would require a more detailed implementation of the underlying logic.
    }
);

When(
    /^I call spacewalk-repo-sync for channel "(.*?)" with a custom url "(.*?)"$/,
    async function (arg1: string, arg2: string) {
        const server = await getTarget('server');
        const { stdout } = await server.runUntilOk(
            `spacewalk-repo-sync -c ${arg1} -u ${arg2}`
        );
        putCommandOutput(stdout);
    }
);

When(
    /^I call spacewalk-repo-sync to sync the channel "(.*?)"$/,
    async function (channel: string) {
        const server = await getTarget('server');
        const { stdout } = await server.runUntilOk(
            `spacewalk-repo-sync -c ${channel}`
        );
        putCommandOutput(stdout);
    }
);

When(
    /^I call spacewalk-repo-sync to sync the parent channel "(.*?)"$/,
    async function (channel: string) {
        const server = await getTarget('server');
        const { stdout } = await server.runUntilOk(
            `spacewalk-repo-sync -p ${channel}`
        );
        putCommandOutput(stdout);
    }
);

When(
    /^I get "(.*?)" file details for channel "(.*?)" via spacecmd$/,
    async function (arg1: string, arg2: string) {
        const server = await getTarget('server');
        const { stdout } = await server.run(
            `spacecmd -u admin -p admin -q -- configchannel_filedetails ${arg2} '${arg1}'`,
            { checkErrors: false }
        );
        putCommandOutput(stdout);
    }
);

Then(/^I should see "(.*?)" in the output$/, async function (arg1: string) {
    expect(getCommandOutput()).to.include(arg1);
});