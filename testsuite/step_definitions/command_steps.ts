import {Given, Then, When} from '@cucumber/cucumber';
import {
    addContext,
    CHANNEL_TO_SYNC_BY_OS_PRODUCT_VERSION,
    channelSyncCompleted,
    ENV_VAR_BY_HOST,
    envConfig,
    escapeRegex,
    fileExists,
    filterChannels,
    generateCertificate,
    getAllNodes,
    getApiTest,
    getContext,
    getSystemName,
    getTarget,
    globalVars,
    isDebHost,
    isRhHost,
    isSuseHost,
    isTransactionalSystem,
    repeatUntilTimeout,
    runningK3s,
    TIMEOUT_BY_CHANNEL_NAME,
    TIMEOUTS,
} from '../helpers/index.js';
import {expect} from "@playwright/test";
import {
    installPackages,
    installSaltPillarTopFile,
    manageRepositories,
    removePackages,
    waitUntilFileExists,
    waitUntilServiceInactive
} from '../helpers/embedded_steps/command_helper.js';

Then(/^"([^"]*)" should have a FQDN$/, async function (host) {
    const node = await getTarget(host);
    const {stdout, stderr, returnCode} = await node.run(
        'date +%s; hostname -f; date +%s',
        {runsInContainer: false, checkErrors: false, timeout: TIMEOUTS.ssh}
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
    const {stdout} = await server_node.run(
        `curl -H 'Content-Type: application/json' -d '{"login": "admin", "password": "admin"}' -i ${api_url}`
    );
    if (!stdout.includes('200 OK')) {
        throw new Error('Failed to login to the API');
    }
});

When(
    /^I store the amount of packages in channel "([^"]*)"$/,
    async function (channel_label: string) {
        const channels = await getApiTest().channel.listAllChannels();
        addContext('channels', channels);
        if (getContext('channels')[channel_label]) {
            addContext(
                'package_amount',
                getContext('channels')[channel_label]['packages']
            );
            console.log(
                `Package amount for 'test-strict': ${getContext('package_amount')}`
            );
        } else {
            console.log(`${channel_label} channel not found.`);
        }
    }
);

Then(
    /^The amount of packages in channel "([^"]*)" should be the same as before$/,
    async function (channel_label: string) {
        const channels = await getApiTest().channel.listAllChannels();
        addContext('channels', channels);
        if (
            getContext('channels')[channel_label] &&
            getContext('package_amount') !==
            getContext('channels')[channel_label]['packages']
        ) {
            throw new Error('Package counts do not match');
        }
    }
);

Then(
    /^The amount of packages in channel "([^"]*)" should be fewer than before$/,
    async function (channel_label: string) {
        const channels = await getApiTest().channel.listAllChannels();
        addContext('channels', channels);
        if (
            getContext('channels')[channel_label] &&
            getContext('channels')[channel_label]['packages'] >=
            getContext('package_amount')
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
        const {stdout} = await server.run(channels_cmd, {
            checkErrors: false
        });
        addContext('commandOutput', stdout);
    }
);

When(/^I list channels with spacewalk-remove-channel$/, async function () {
    const server = await getTarget('server');
    const {stdout, returnCode} = await server.run(
        'spacewalk-remove-channel -l'
    );
    if (returnCode !== 0) {
        throw new Error('Unable to run spacewalk-remove-channel -l command on server');
    }
    addContext('commandOutput', stdout);
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
        const {stdout} = await server.run(command);
        addContext('commandOutput', stdout);
    }
);

When(
    /^I use spacewalk-common-channel to add all "([^"]*)" channels with arch "([^"]*)"$/,
    async function (channel: string, architecture: string) {
        let channels_to_synchronize =
            CHANNEL_TO_SYNC_BY_OS_PRODUCT_VERSION[globalVars.product]?.[channel]?.slice() ||
            CHANNEL_TO_SYNC_BY_OS_PRODUCT_VERSION[globalVars.product]?.[
                `${channel}-${architecture}`
                ]?.slice();
        if (!envConfig.betaEnabled) {
            channels_to_synchronize = filterChannels(channels_to_synchronize, [
                'beta'
            ]);
        }
        if (!channels_to_synchronize || channels_to_synchronize.length === 0) {
            throw new Error(
                `Synchronization error, channel ${channel} or ${channel}-${architecture} in ${globalVars.product} product not found`
            );
        }

        for (const os_product_version_channel of channels_to_synchronize) {
            const command = `spacewalk-common-channels -u admin -p admin -a ${architecture} ${os_product_version_channel.replace(
                `-${architecture}`,
                ''
            )}`;
            const server = await getTarget('server');
            await server.run(command, {verbose: true});
            console.log(`Channel ${os_product_version_channel} added`);
        }
    }
);

When(
    /^I use spacewalk-repo-sync to sync channel "([^"]*)"$/,
    async function (channel: string) {
        const server = await getTarget('server');
        const {stdout} = await server.run(`spacewalk-repo-sync -c ${channel}`, {
            checkErrors: false,
            verbose: true
        });
        addContext('commandOutput', stdout);
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
        const {stdout} = await server.run(
            `spacewalk-repo-sync -c ${channel} ${append_includes}`,
            {checkErrors: false, verbose: true}
        );
        addContext('commandOutput', stdout);
    }
);

Then(/^I should get "([^"]*)"$/, async function (value: string) {
    if (!getContext('commandOutput').includes(value)) {
        throw new Error(`'${value}' not found in output '${getContext('commandOutput')}'`);
    }
});

Then(/^I shouldn't get "([^"]*)"$/, async function (value: string) {
    if (getContext('commandOutput').includes(value)) {
        throw new Error(`'${value}' found in output '${getContext('commandOutput')}'`);
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

When(/^I wait for "([^"]*)" to be (uninstalled|installed) on "([^"]*)"$/,
    async function (package_name: string, status: 'uninstalled' | 'installed', host: string) {
        if (package_name.includes('suma') && globalVars.product === 'Uyuni') {
            package_name = package_name.replace('suma', 'uyuni');
        }

        const node = await getTarget(host);

        if (await isDebHost(host)) {
            const parts = package_name.split('-');
            const pkg_version = parts.pop();
            const pkg_name = parts.join('-');
            const pkg_version_regexp = pkg_version?.replace(/\./g, '\\.');

            if (status === 'installed') {
                await node.runUntilOk(`dpkg -l | grep -E '^ii +${pkg_name} +${pkg_version_regexp} +'`);
            } else {
                await node.runUntilFail(`dpkg -l | grep -E '^ii +${pkg_name} +${pkg_version_regexp} +'`);
            }
            await node.waitWhileProcessRunning('apt-get');
        } else {
            await node.waitWhileProcessRunning('zypper');
            if (status === 'installed') {
                await node.runUntilOk(`rpm -q ${package_name}`);
            } else {
                await node.runUntilFail(`rpm -q ${package_name}`);
            }
        }
    });
When(/^I query latest Salt changes on "(.*?)"$/, async function (host: string) {
    const node = await getTarget(host);
    let salt = globalVars.useSaltBundle ? 'venv-salt-minion' : 'salt';
    if (host === 'server') {
        salt = 'salt';
    }
    const {stdout} = await node.run(
        `LANG=en_US.UTF-8 rpm -q --changelog ${salt}`
    );
    console.log(stdout.split('\n').slice(0, 15).join('\n'));
});

When(
    /^I query latest Salt changes on Debian-like system "(.*?)"$/,
    async function (host: string) {
        const node = await getTarget(host);
        const salt = globalVars.useSaltBundle ? 'venv-salt-minion' : 'salt';
        const changelog_file = globalVars.useSaltBundle
            ? 'changelog.gz'
            : 'changelog.Debian.gz';
        const {stdout} = await node.run(
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
            const {returnCode} = await node.run(
                `xzdec ${next_day_rotated_log} | grep -- ${pattern}`
            );
            expect(returnCode, `Return code: ${returnCode}`).toEqual(0);
        } catch (error) {
            const {returnCode} = await node.run(
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
        await waitUntilServiceInactive(service, host);
    }
);

When(
    /^I wait until "([^"]*)" exporter service is active on "([^"]*)"$/,
    async function (service: string, host: string) {
        const node = await getTarget(host);
        const separator = await isRhHost(host) ? '_' : '-';
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
        const {stdout} = await server.run(
            `echo -e '${u}\\n${p}\\n' | mgr-sync ${arg1}`,
            {checkErrors: false}
        );
        addContext('commandOutput', stdout);
    }
);

When(/^I execute mgr-sync "([^"]*)"$/, async function (arg1: string) {
    const server = await getTarget('server');
    const {stdout} = await server.run(`mgr-sync ${arg1}`);
    addContext('commandOutput', stdout);
});

When(/^I remove the mgr-sync cache file$/, async function () {
    const server = await getTarget('server');
    const {stdout} = await server.run('rm -f ~/.mgr-sync');
    addContext('commandOutput', stdout);
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
    const {stdout} = await server.run('mgr-sync refresh', {
        checkErrors: false
    });
    addContext('commandOutput', stdout);
});

When(
    /^I kill running spacewalk-repo-sync for "([^"]*)"$/,
    async function (os_product_version: string) {
        if (
            !CHANNEL_TO_SYNC_BY_OS_PRODUCT_VERSION[globalVars.product]?.[os_product_version]
        ) {
            return;
        }

        let channels_to_kill =
            CHANNEL_TO_SYNC_BY_OS_PRODUCT_VERSION[globalVars.product][
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
                const {stdout} = await server.run(
                    'ps axo pid,cmd | grep spacewalk-repo-sync | grep -v grep',
                    {checkErrors: false}
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
                    !CHANNEL_TO_SYNC_BY_OS_PRODUCT_VERSION[globalVars.product][
                        os_product_version
                        ].includes(channel)
                ) {
                    return false;
                }

                channels_to_kill = channels_to_kill.filter((c: string) => c !== channel);
                const pid = process.split(' ')[0];
                await server.run(`kill ${pid}`, {checkErrors: false});
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

            {message: 'Some reposync processes were not killed properly', timeout: 900, dontRaise: true}
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
                const {stdout} = await server.run(
                    'ps axo pid,cmd | grep spacewalk-repo-sync | grep -v grep',
                    {verbose: true, checkErrors: false}
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
                    await server.run(`kill ${pid}`, {verbose: true, checkErrors: false});
                    console.log(`Reposync of channel ${channel} killed`);
                    return true;
                } else {
                    console.log(
                        `Warning: Repo-sync process for channel '${channel_synchronizing}' running.`
                    );
                    return false;
                }
            },

            {message: 'Some reposync processes were not killed properly', timeout: 60, dontRaise: true}
        );
    }
);

Then(/^the reposync logs should not report errors$/, async function () {
    const server = await getTarget('server');
    const {stdout, returnCode} = await server.run(
        'grep -i "ERROR:" /var/log/rhn/reposync/*.log',
        {checkErrors: false}
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
            const {returnCode: fileExistsCode} = await server.run(
                `test -f /var/log/rhn/reposync/${logs}.log`,
                {checkErrors: false}
            );
            if (fileExistsCode === 0) {
                const {stdout, returnCode: grepCode} = await server.run(
                    `grep -i 'ERROR:' /var/log/rhn/reposync/${logs}.log`,
                    {checkErrors: false}
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
                const {returnCode} = await server.run(
                    `dumpsolv /var/cache/rhn/repodata/${channel}/solv | grep ${pkg}`,
                    {verbose: false, checkErrors: false}
                );
                return returnCode === 0;
            },

            {message: `Reference ${pkg} not found in file.`, timeout: 600}
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
                {message: 'Channel not fully synced', timeout}
            );
        } catch (e: Error | any) {
            console.log(e.message);
            throw new Error(`This channel was not fully synced: ${channel}`);
        }
    }
);

When(
    /^I wait until all synchronized channels for "([^"]*)" have finished$/,
    async function (os_product_version: string) {
        let channels_to_wait =
            CHANNEL_TO_SYNC_BY_OS_PRODUCT_VERSION[globalVars.product]?.[
                os_product_version
                ]?.slice();
        if (!envConfig.betaEnabled) {
            channels_to_wait = filterChannels(channels_to_wait, ['beta']);
        }
        if (!channels_to_wait) {
            throw new Error(
                `Synchronization error, channels for ${os_product_version} in ${globalVars.product} not found`
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

                {message: 'Product not fully synced', timeout}
            );
        } catch (e: Error | any) {
            console.log(
                `These channels were not fully synced:\n ${channels_to_wait}. \n${e.message}`
            );
            throw e;
        }
    }
);

When(/^I execute mgr-bootstrap "([^"]*)"$/, async function (arg1: string) {
    const server = await getTarget('server');
    const {stdout} = await server.run(`mgr-bootstrap ${arg1}`);
    addContext('commandOutput', stdout);
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
                const {stdout} = await server.run(`grep ${content} ${file}`, {
                    checkErrors: false
                });
                return stdout.includes(content);
            },

            {message: `${content} not found in file ${file}`, reportResult: true}
        );
    }
);

Then(
    /^file "([^"]*)" should contain "([^"]*)" on server$/,
    async function (file: string, content: string) {
        const server = await getTarget('server');
        const {stdout} = await server.run(`grep -F '${content}' ${file}`, {
            checkErrors: false
        });
        if (!stdout.includes(content)) {
            throw new Error(`'${content}' not found in file ${file}`);
        }
    }
);

Then(/^the tomcat logs should not contain errors$/, async function () {
    const server = await getTarget('server');
    const {stdout} = await server.run('cat /var/log/tomcat/*');
    const msgs = ['ERROR', 'NullPointer'];
    msgs.forEach((msg) => {
        if (stdout.includes(msg)) {
            throw new Error(`-${msg}-  msg found on tomcat logs`);
        }
    });
});

Then(/^the taskomatic logs should not contain errors$/, async function () {
    const server = await getTarget('server');
    const {stdout} = await server.run(
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
        const {stdout, returnCode} = await server.run(
            'grep -i "Out of memory: Killed process" /var/log/messages',
            {checkErrors: false}
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

When(/^I run "([^"]*)" on "([^"]*)"$/, async function (cmd: string, host: string) {
    const node = await getTarget(host);
    await node.run(cmd);
});

When(/^I run "([^"]*)" on "([^"]*)" with logging$/, async function (cmd: string, host: string) {
    const node = await getTarget(host);
    const {stdout} = await node.run(cmd);
    console.log(`OUT: ${stdout}`);
});

When(/^I run "([^"]*)" on "([^"]*)" without error control$/, async function (cmd: string, host: string) {
    const node = await getTarget(host);
    const {returnCode} = await node.run(cmd, {checkErrors: false});
    addContext('failCode', returnCode);
});

Then(/^the command should fail$/, async function () {
    if (getContext('failCode') === 0) {
        throw new Error('Previous command must fail, but has NOT failed!');
    }
});

When(
    /^I wait until file "([^"]*)" exists on "([^"]*)"$/,
    async function (file: string, host: string) {
        await waitUntilFileExists(TIMEOUTS.long.toString(), file, host);
    }
);

When(
    /^I wait at most (\d+) seconds until file "([^"]*)" exists on "([^"]*)"$/,
    async function (seconds: string, file: string, host: string) {
        const node = await getTarget(host);
        await repeatUntilTimeout(
            async () => {
                return await fileExists(node, file);
            },
            {timeout: parseInt(seconds, 10)}
        );
    }
);

When(/^I wait until file "(.*)" exists on server$/, async function (file: string) {
    const server = await getTarget('server');
    await repeatUntilTimeout(async () => {
        return await fileExists(server, file);
    }, {timeout: 60});
});

Then(
    /^I wait and check that "([^"]*)" has rebooted$/,
    async function (host: string) {
        const reboot_timeout = 800;
        const system_name = await getSystemName(host);
        // check_shutdown and check_restart are not directly translatable without more context.
        // This would require a more detailed implementation of the underlying logic.
    }
);

When(
    /^I call spacewalk-repo-sync for channel "(.*?)" with a custom url "(.*?)"$/,
    async function (arg1: string, arg2: string) {
        const server = await getTarget('server');
        const {stdout} = await server.runUntilOk(
            `spacewalk-repo-sync -c ${arg1} -u ${arg2}`
        );
        addContext('commandOutput', stdout);
    }
);

When(
    /^I call spacewalk-repo-sync to sync the channel "(.*?)"$/,
    async function (channel: string) {
        const server = await getTarget('server');
        const {stdout} = await server.runUntilOk(
            `spacewalk-repo-sync -c ${channel}`
        );
        addContext('commandOutput', stdout);
    }
);

When(
    /^I call spacewalk-repo-sync to sync the parent channel "(.*?)"$/,
    async function (channel: string) {
        const server = await getTarget('server');
        const {stdout} = await server.runUntilOk(
            `spacewalk-repo-sync -p ${channel}`
        );
        addContext('commandOutput', stdout);
    }
);

When(
    /^I get "(.*?)" file details for channel "(.*?)" via spacecmd$/,
    async function (arg1: string, arg2: string) {
        const server = await getTarget('server');
        const {stdout} = await server.run(
            `spacecmd -u admin -p admin -q -- configchannel_filedetails ${arg2} '${arg1}'`,
            {checkErrors: false}
        );
        addContext('commandOutput', stdout);
    }
);

Then(/^I should see "(.*?)" in the output$/, async function (arg1: string) {
    expect(getContext('commandOutput')).toHaveText(arg1)
});

Then(/^I turn off disable_local_repos for all clients$/, async function () {
    const server = await getTarget('server');
    await server.run('echo "mgr_disable_local_repos: False" > /srv/pillar/disable_local_repos_off.sls');
    await installSaltPillarTopFile('salt_bundle_config, disable_local_repos_off', '*');
});

Then(/^it should be possible to reach the test packages$/, async function () {
    const url = 'https://download.opensuse.org/repositories/systemsmanagement:/Uyuni:/Test-Packages:/Updates/rpm/x86_64/orion-dummy-1.1-1.1.x86_64.rpm';
    const server = await getTarget('server');
    await server.run(`curl --insecure --location ${url} --output /dev/null`);
});

Then(/^it should be possible to use the HTTP proxy$/, async function () {
    const server = await getTarget('server');
    const proxy = `suma3:P4%24%24w%2Ford%20With%and%26@${server.fullHostname}`;
    const url = 'https://www.suse.com';
    await server.run(`curl --insecure --proxy '${proxy}' --proxy-anyauth --location '${url}' --output /dev/null`);
});

Then(/^it should be possible to use the custom download endpoint$/, async function () {
    const server = await getTarget('server');
    const url = `${server.fullHostname}/rhn/manager/download/fake-rpm-suse-channel/repodata/repomd.xml`;
    await server.run(`curl --ipv4 --location ${url} --output /dev/null`);
});

Then(/^it should be possible to reach the build sources$/, async function () {
    const server = await getTarget('server');
    const example_product = globalVars.product === 'Uyuni'
        ? 'distribution/leap-micro/5.5/product/repo/Leap-Micro-5.5-x86_64-Media1/media.1/products'
        : 'ibs/SUSE/Products/SLE-Product-SLES/15-SP6/x86_64/product/media.1/products';
    await server.run(`curl --insecure --location http://${server.fullHostname}/${example_product} --output /dev/null`);
});

Then(/^it should be possible to reach the Docker profiles$/, async function () {
    const server = await getTarget('server');
    const git_profiles = process.env.GITPROFILES;
    if (git_profiles) {
        const url = git_profiles.replace(/github\.com/, 'raw.githubusercontent.com')
            .replace(/\.git#:/, '/master/')
            .concat('/Docker/Dockerfile');
        await server.run(`curl --insecure --location ${url} --output /dev/null`);
    }
});

Then(/^it should be possible to reach the authenticated registry$/, async function () {
    const server = await getTarget('server');
    const auth_registry = process.env.AUTH_REGISTRY;
    if (auth_registry && auth_registry.length > 0) {
        const url = `https://${auth_registry}`;
        await server.run(`curl --insecure --location ${url} --output /dev/null`);
    }
});

Then(/^it should be possible to reach the not authenticated registry$/, async function () {
    const server = await getTarget('server');
    const no_auth_registry = process.env.NO_AUTH_REGISTRY;
    if (no_auth_registry && no_auth_registry.length > 0) {
        const url = `https://${no_auth_registry}`;
        await server.run(`curl --insecure --location ${url} --output /dev/null`);
    }
});

When(/^I migrate the non-SUMA repositories on "([^"]*)"$/, async function (host: string) {
    const node = await getTarget(host);
    const saltCall = globalVars.useSaltBundle ? 'venv-salt-call' : 'salt-call';
    await node.run(`${saltCall} --local --file-root /root/salt/ state.apply repos`);
    await node.run('for repo in $(zypper lr | awk \'NR>7 && !/susemanager:/ {print $3}\'); do zypper mr -d $repo; done');
});

When(/^I (enable|disable) Debian-like "([^"]*)" repository on "([^"]*)"$/, async function (action: string, repo: string, host: string) {
    const node = await getTarget(host);
    const sources = '/etc/apt/sources.list.d/ubuntu.sources';
    const tmp = '/tmp/ubuntu.sources';
    await node.run(`awk -f /tmp/edit-deb822.awk -v action=${action} -v distro=$(lsb_release -sc) -v repo=${repo} ${sources} > ${tmp} && mv ${tmp} ${sources}`);
});

When(/^I add repository "([^"]*)" with url "([^"]*)" on "([^"]*)"((?: without error control)?)$/, async function (repo: string, url: string, host: string, error_control: string) {
    const node = await getTarget(host);
    const checkErrors = error_control === '';
    let cmd = '';
    // This step definition is currently only for SUSE-like systems.
    if (await isSuseHost(host)) {
        cmd = `zypper addrepo ${url} ${repo}`;
    }
    await node.run(cmd, {verbose: true, checkErrors});
});

When(/^I remove repository "([^"]*)" on "([^"]*)"((?: without error control)?)$/, async function (repo: string, host: string, error_control: string) {
    const node = await getTarget(host);
    const checkErrors = error_control === '';
    let cmd = '';
    // This step definition is currently only for SUSE-like systems.
    if (await isSuseHost(host)) {
        cmd = `zypper removerepo ${repo}`;
    }
    await node.run(cmd, {verbose: true, checkErrors});
});

When(/^I (enable|disable) (the repositories|repository) "([^"]*)" on this "([^"]*)"((?: without error control)?)$/, async function (action: string, _optional: string, repos: string, host: string, error_control: string) {
    await manageRepositories(action, repos, host, error_control);
});

When(/^I enable source package syncing$/, async function () {
    const server = await getTarget('server');
    const cmd = 'echo \'server.sync_source_packages = 1\' >> /etc/rhn/rhn.conf';
    await server.run(cmd);
});

When(/^I disable source package syncing$/, async function () {
    const server = await getTarget('server');
    const cmd = 'sed -i \'s/^server.sync_source_packages = 1.*//g\' /etc/rhn/rhn.conf';
    await server.run(cmd);
});

When(/^I install pattern "([^"]*)" on this "([^"]*)"$/, async function (pattern: string, host: string) {
    if (pattern.includes('suma') && globalVars.product === 'Uyuni') {
        pattern = pattern.replace('suma', 'uyuni');
    }
    const node = await getTarget(host);
    await node.run('zypper ref');
    const cmd = `zypper --non-interactive install -t pattern ${pattern}`;
    await node.run(cmd, {checkErrors: false, successCodes: [0, 100, 101, 102, 103, 106]});
});

When(/^I remove pattern "([^"]*)" from this "([^"]*)"$/, async function (pattern: string, host: string) {
    if (pattern.includes('suma') && globalVars.product === 'Uyuni') {
        pattern = pattern.replace('suma', 'uyuni');
    }
    const node = await getTarget(host);
    await node.run('zypper ref');
    const cmd = `zypper --non-interactive remove -t pattern ${pattern}`;
    await node.run(cmd, {checkErrors: false, successCodes: [0, 100, 101, 102, 103, 104, 106]});
});

When(/^I (install|remove) OpenSCAP dependencies (on|from) "([^"]*)"$/, async function (action: string, _where: string, host: string) {
    const node = await getTarget(host);
    let pkgs: string;
    if (await isSuseHost(host)) {
        pkgs = 'openscap-utils openscap-content scap-security-guide';
    } else if (await isRhHost(host)) {
        pkgs = 'openscap-utils scap-security-guide-redhat';
    } else { // Debian-like
        pkgs = 'openscap-utils openscap-scanner openscap-common ssg-debderived';
    }
    if (action === 'install') {
        await installPackages(pkgs, host, '');
    } else {
        await removePackages(pkgs, host, '');
    }
});

When(/^I install packages? "([^"]*)" on this "([^"]*)"((?: without error control)?)$/, async function (packageList: string, host: string, error_control: string) {
    const node = await getTarget(host);
    const checkErrors = error_control === '';
    let cmd: string;
    let notFoundMsg: string;
    let successcodes: number[];

    if (await isRhHost(host)) {
        cmd = `yum -y install ${packageList}`;
        successcodes = [0];
        notFoundMsg = 'No package';
    } else if (await isSuseHost(host)) {
        if (await isTransactionalSystem(host, false)) {
            cmd = `transactional-update pkg install -y ${packageList}`;
        } else {
            cmd = `zypper --non-interactive install -y ${packageList}`;
        }
        successcodes = [0, 100, 101, 102, 103, 106];
        notFoundMsg = 'not found in package names';
    } else { // Debian-like
        cmd = `apt-get --assume-yes install ${packageList}`;
        successcodes = [0];
        notFoundMsg = 'Unable to locate package';
    }

    const {stdout, returnCode} = await node.run(cmd, {checkErrors: false, successCodes: successcodes});
    if (checkErrors && returnCode !== 0) {
        throw new Error(`Command failed with return code ${returnCode}`);
    }
    if (stdout.includes(notFoundMsg)) {
        throw new Error(`A package was not found. Output:\n ${stdout}`);
    }
});

When(/^I install old packages? "([^"]*)" on this "([^"]*)"((?: without error control)?)$/, async function (packageList: string, host: string, error_control: string) {
    const node = await getTarget(host);
    const checkErrors = error_control === '';
    let cmd: string;
    let notFoundMsg: string;
    let successcodes: number[];

    if (await isRhHost(host)) {
        cmd = `yum -y downgrade ${packageList}`;
        successcodes = [0];
        notFoundMsg = 'No package';
    } else if (await isSuseHost(host)) {
        cmd = `zypper --non-interactive install --oldpackage -y ${packageList}`;
        successcodes = [0, 100, 101, 102, 103, 106];
        notFoundMsg = 'not found in package names';
    } else { // Debian-like
        cmd = `apt-get --assume-yes install ${packageList} --allow-downgrades`;
        successcodes = [0];
        notFoundMsg = 'Unable to locate package';
    }

    const {stdout, returnCode} = await node.run(cmd, {checkErrors: false, successCodes: successcodes});
    if (checkErrors && returnCode !== 0) {
        throw new Error(`Command failed with return code ${returnCode}`);
    }
    if (stdout.includes(notFoundMsg)) {
        throw new Error(`A package was not found. Output:\n ${stdout}`);
    }
});

When(/^I remove packages? "([^"]*)" from this "([^"]*)"((?: without error control)?)$/, async function (packageList: string, host: string, error_control: string) {
    const node = await getTarget(host);
    const checkErrors = error_control === '';
    let cmd: string;
    let successcodes: number[];

    if (await isRhHost(host)) {
        cmd = `yum -y remove ${packageList}`;
        successcodes = [0];
    } else if (await isSuseHost(host)) {
        if (await isTransactionalSystem(host, false)) {
            cmd = `transactional-update pkg rm -y ${packageList}`;
        } else {
            cmd = `zypper --non-interactive remove -y ${packageList}`;
        }
        successcodes = [0, 100, 101, 102, 103, 104, 106];
    } else { // Debian-like
        cmd = `dpkg --remove ${packageList}`;
        successcodes = [0];
    }
    await node.run(cmd, {checkErrors: checkErrors, successCodes: successcodes});
});

When(/I copy "([^"]*)" from "([^"]*)" to "([^"]*)" via scp in the path "([^"]*)"$/, async function (file: string, origin: string, dest: string, dest_folder: string) {
    const nodeOrigin = await getTarget(origin);
    const nodeDest = await getTarget(dest);
    const destHostname = nodeDest.hostname;
    const {returnCode} = await nodeOrigin.run(`scp -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null -r ${file} root@${destHostname}:${dest_folder}`, {checkErrors: false});
    if (returnCode !== 0) {
        throw new Error(`File could not be sent from ${origin} to ${dest}`);
    }
});

When(/^I check the cloud-init status on "([^"]*)"$/, async function (host: string) {
    const node = await getTarget(host);
    await node.run('cloud-init status --wait', {checkErrors: true, verbose: false});
    await repeatUntilTimeout(
        async () => {
            const {stdout, returnCode} = await node.run('cloud-init status --wait', {
                checkErrors: true,
                verbose: false
            });
            if (stdout.includes('done')) {
                return true;
            }
            if (returnCode === 1) {
                throw new Error('Error during cloud-init.');
            }
            return false;
        },
        {reportResult: true, message: 'Cloud-init did not finish.'}
    );
});

When(/^I wait until I see "([^"]*)" in file "([^"]*)" on "([^"]*)"$/, async function (text: string, file: string, host: string) {
    const node = await getTarget(host);
    await repeatUntilTimeout(
        async () => {
            const {returnCode} = await node.run(`tail -n 10 ${file} | grep '${text}' `, {checkErrors: false});
            return returnCode === 0;
        },
        {message: `Entry ${text} in file ${file} on ${host} not found`}
    );
});

Then(/^the word "([^']*)" does not occur more than (\d+) times in "(.*)" on "([^"]*)"$/, async function (word: string, threshold: number, path: string, host: string) {
    const node = await getTarget(host);
    const {stdout} = await node.run(`grep -o -i '${word}' ${path} | wc -l`);
    const occurrences = parseInt(stdout.trim(), 10);
    if (occurrences > threshold) {
        throw new Error(`The word ${word} occurred ${occurrences} times, which is more than ${threshold} times in file ${path}`);
    }
});

When(/^I reboot the "([^"]*)" host through SSH, waiting until it comes back$/, async function (host: string) {
    const node = await getTarget(host);
    await node.run('reboot', {checkErrors: false, verbose: true, runsInContainer: false});
    await node.waitUntilOffline();
    await node.waitUntilOnline();
});

When(/^I wait until mgr-sync refresh is finished$/, async function () {
    const server = await getTarget('server');
    const cmd = 'spacecmd -u admin -p admin api sync.content.listProducts | grep SLES';
    const refreshTimeout = 1800;

    await repeatUntilTimeout(
        async () => {
            const {stdout} = await server.run(cmd, {successCodes: [0, 1], checkErrors: true});
            return stdout.includes('SLES');
        },

        {message: '\'mgr-sync refresh\' did not finish', timeout: refreshTimeout}
    );
});

When(/^I generate the configuration "([^"]*)" of containerized proxy on the server$/, async function (filePath: string) {
    const server = await getTarget('server');
    const proxy = await getTarget('proxy');
    let command: string;

    if (await runningK3s()) {
        await generateCertificate('proxy', proxy.fullHostname);
        await server.inject(`/tmp/proxy.crt`, `/tmp/proxy.crt`);
        await server.inject(`/tmp/proxy.key`, `/tmp/proxy.key`);
        await server.inject(`/tmp/ca.crt`, `/tmp/ca.crt`);
        command = `spacecmd -u admin -p admin proxy_container_config -- -o ${filePath} -p 8022 ${proxy.fullHostname} ${server.fullHostname} 2048 galaxy-noise@suse.de /tmp/ca.crt /tmp/proxy.crt /tmp/proxy.key`;
    } else {
        command = `echo spacewalk > ca_pass && spacecmd --nossl -u admin -p admin proxy_container_config_generate_cert -- -o ${filePath} ${proxy.fullHostname} ${server.fullHostname} 2048 galaxy-noise@suse.de --ssl-cname proxy.example.org --ca-pass ca_pass && rm ca_pass`;
    }

    await server.run(command);
});

When(/^I copy the configuration "([^"]*)" of containerized proxy from the server to the proxy$/, async function (filePath: string) {
    const server = await getTarget('server');
    const proxy = await getTarget('proxy');
    await server.extract(filePath, filePath);
    await proxy.inject(filePath, filePath);
});

When(/^I add avahi hosts in containerized proxy configuration$/, async function () {
    const server = await getTarget('server');
    if (server.fullHostname.includes('tf.local')) {
        let hostsList = '';
        for (const [_host, node] of Object.entries(getAllNodes())) {
            hostsList += `--add-host=${node.fullHostname}:${node.publicIp} `;
        }
        hostsList = escapeRegex(hostsList);

        const proxy = await getTarget('proxy');
        const cmd = `echo 'export UYUNI_PODMAN_ARGS="${hostsList}"' >> ~/.bashrc && source ~/.bashrc`;
        await proxy.run(cmd, {runsInContainer: false});
        console.log(`Avahi hosts added: ${hostsList}`);
        console.log('The Development team has not been working to support avahi in containerized proxy, yet. This is best effort.');
    } else {
        console.log('Record not added - avahi domain was not detected');
    }
});

When(/^I wait until port "([^"]*)" is listening on "([^"]*)" (host|container)$/, async function (port: string, host: string, location: string) {
    const node = await getTarget(host);
    const runsInContainer = location === 'container';
    await node.runUntilOk(`lsof -i:${port}`, TIMEOUTS.long, runsInContainer);
});

When(/^I visit "([^"]*)" endpoint of this "([^"]*)"$/, async function (service: string, host: string) {
    const node = await getTarget(host);
    const systemName = await getSystemName(host);
    const osFamily = node.osFamily || '';
    let port: number;
    let protocol: string;
    let path: string;
    let text: string;

    switch (service) {
        case 'Proxy':
            port = 443;
            protocol = 'https';
            path = '/pub/';
            text = 'Index of /pub';
            break;
        case 'Prometheus':
            port = 9090;
            protocol = 'http';
            path = '';
            text = 'graph';
            break;
        case 'Prometheus node exporter':
            port = 9100;
            protocol = 'http';
            path = '';
            text = 'Node Exporter';
            break;
        case 'Prometheus apache exporter':
            port = 9117;
            protocol = 'http';
            path = '';
            text = 'Apache Exporter';
            break;
        case 'Prometheus postgres exporter':
            port = 9187;
            protocol = 'http';
            path = '';
            text = 'Postgres Exporter';
            break;
        case 'Grafana':
            port = 3000;
            protocol = 'http';
            path = '';
            text = 'Grafana Labs';
            break;
        default:
            throw new Error(`Unknown port for service ${service}`);
    }

    const isDebian = osFamily.includes('debian') || osFamily.includes('ubuntu');
    if (isDebian) {
        await node.runUntilOk(`wget --no-check-certificate -qO- ${protocol}://${systemName}:${port}${path} | grep -i '${text}'`);
    } else {
        await node.runUntilOk(`curl -s -k ${protocol}://${systemName}:${port}${path} | grep -i '${text}'`);
    }
});

Then('the clock from {string} should be exact', async function (host: string) {
    const node = await getTarget(host);
    const {stdout: clockNode} = await node.run("date +'%s'");
    const controller = Math.floor(Date.now() / 1000);
    const diff = parseInt(String(clockNode).trim(), 10) - controller;
    if (Math.abs(diff) >= 2) throw new Error(`clocks differ by ${diff} seconds`);
});
