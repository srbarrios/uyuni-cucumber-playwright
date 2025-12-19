import {Given, Then, When} from '@cucumber/cucumber';
import {
    addContext,
    BASE_CHANNEL_BY_CLIENT,
    CHANNEL_LABEL_TO_SYNC_BY_BASE_CHANNEL,
    CHANNEL_TO_SYNC_BY_OS_PRODUCT_VERSION,
    channelSyncCompleted,
    checkRestart,
    checkShutdown,
    ENV_VAR_BY_HOST,
    envConfig,
    escapeRegex,
    extractLogsFromNode,
    fileDelete,
    fileExists,
    fileExtract,
    fileInject,
    filterChannels,
    folderDelete,
    folderExists,
    generateCertificate,
    generateTempFile,
    getAllNodes,
    getApiTest,
    getAppHost,
    getContext,
    getCurrentPage,
    getSystemName,
    getTarget,
    getVariableFromConfFile,
    globalVars,
    isDebHost,
    isRhHost,
    isSuseHost,
    isTransactionalSystem,
    PARENT_CHANNEL_LABEL_TO_SYNC_BY_BASE_CHANNEL,
    RemoteNode,
    repeatUntilTimeout,
    reportdbServerQuery,
    resetApiTest,
    runningK3s,
    TIMEOUT_BY_CHANNEL_NAME,
    TIMEOUTS,
    updateControllerCA,
} from '../helpers/index.js';
import {expect} from "@playwright/test";
import {exec} from 'child_process';
import * as path from 'path';
import {Client} from 'pg'; // Import Client from pg
import {
    installPackages,
    installSaltPillarTopFile,
    manageRepositories,
    removePackages,
    waitUntilFileExists,
    waitUntilServiceInactive
} from '../helpers/embedded_steps/command_helper.js';
import validator from 'validator';

Then(/^"([^"]*)" should have a FQDN$/, async function (host) {
    const node = await getTarget(host);
    const hostname = node.fullHostname;
    const fqdnOptions = {
        require_tld: true,       // Ensures it has a TLD (e.g., .com, .net)
        allow_underscores: false, // Disallows underscores in hostnames by default
        allow_trailing_dot: false // Disallows the trailing root dot by default
    };

    if (!validator.isFQDN(hostname, fqdnOptions)){
        throw new Error(`Hostname '${hostname}' for host '${host}' is NOT a Fully Qualified Domain Name.`);
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

When(/^I execute spacewalk-debug on the server$/, async function () {
    const server = await getTarget('server');
    await server.run('spacewalk-debug');
    const success = await fileExtract(server, '/tmp/spacewalk-debug.tar.bz2', 'spacewalk-debug.tar.bz2');
    if (!success) {
        throw new Error('Download debug file failed');
    }
});

When(/^I extract the log files from all our active nodes$/, async function () {
    for (const host in ENV_VAR_BY_HOST) {
        try {
            await getTarget(host);
        } catch (error) {
            // Catch exceptions silently
        }
    }
    const nodes = getAllNodes();
    for (const [host, node] of Object.entries(nodes)) {
        if (
            !node ||
            ['salt_migration_minion', 'localhost'].includes(host) ||
            host.endsWith('-ctl')
        ) {
            continue;
        }
        console.log(`Host: ${host}`);
        console.log(`Node: ${node.fullHostname}`);
        await extractLogsFromNode(node, host);
    }
});

Then(/^files on container volumes should all have the proper SELinux label$/, async function () {
    const node = await getTarget('server');
    const cmd = '[ "$(sestatus 2>/dev/null | head -n 1 | grep enabled)" != "" ] && ' +
        '(find /var/lib/containers/storage/volumes/*/_data -exec ls -Zd {} \\; | grep -v ":object_r:container_file_t:s0 ")';
    const {stdout} = await node.runLocal(cmd, {checkErrors: false});
    if (stdout !== '') {
        console.log(stdout);
        throw new Error('Wrong SELinux labels');
    }
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
        //TODO: check_shutdown and check_restart are not directly translatable without more context.
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

When(/^I copy the distribution inside the container on the server$/, async function () {
    const node = await getTarget('server');
    await node.run('mgradm distro copy /tmp/tftpboot-installation/SLE-15-SP-4-x86_64 SLE-15-SP4-TFTP', {runsInContainer: false});
});

When(/^I generate a supportconfig for the server$/, async function () {
    const node = await getTarget('server');
    await node.run('mgradm support config', {timeout: 600, runsInContainer: false});
    await node.run('mv /root/scc_*.tar.gz /root/server-supportconfig.tar.gz', {runsInContainer: false});
});

When(/^I obtain and extract the supportconfig from the server$/, async function () {
    const supportconfig_path = '/root/server-supportconfig.tar.gz';
    const test_runner_file = '/root/server-supportconfig.tar.gz';
    await (await getTarget('server')).scpDownload(supportconfig_path, test_runner_file);
    // These are local commands on the test runner, so we can use a local exec
    exec('rm -rf /root/server-supportconfig');
    exec('mkdir /root/server-supportconfig && tar xzvf /root/server-supportconfig.tar.gz -C /root/server-supportconfig');
    exec('mv /root/server-supportconfig/scc_* /root/server-supportconfig/test-server');
    exec('tar xJvf /root/server-supportconfig/test-server/*supportconfig.txz -C /root/server-supportconfig');
    exec('mv /root/server-supportconfig/scc_suse_*/ /root/server-supportconfig/uyuni-server-supportconfig/');
});

When(/^I remove the autoinstallation files from the server$/, async function () {
    const node = await getTarget('server');
    await node.run('rm -r /tmp/tftpboot-installation', {runsInContainer: false});
    await node.run('rm -r /srv/www/distributions/SLE-15-SP4-TFTP');
});

When(/^I reset tftp defaults on the proxy$/, async function () {
    await (await getTarget('proxy')).run("echo 'TFTP_USER=\"tftp\"\nTFTP_OPTIONS=\"\"\nTFTP_DIRECTORY=\"/srv/tftpboot\"\n' > /etc/sysconfig/tftp");
});

When(/^I wait until the package "([^"]*)" has been cached on this "([^"]*)"$/, async function (pkg_name, host) {
    const node = await getTarget(host);
    let cmd: string;
    if ((await node.run('which zypper', {checkErrors: false})).returnCode === 0) {
        cmd = `ls /var/cache/zypp/packages/susemanager:fake-rpm-suse-channel/getPackage/*/*/${pkg_name}*.rpm`;
    } else if ((await node.run('which apt-get', {checkErrors: false})).returnCode === 0) {
        cmd = `ls /var/cache/apt/archives/${pkg_name}*.deb`;
    } else {
        throw new Error("Unsupported package manager");
    }
    await repeatUntilTimeout(async () => {
        const {returnCode} = await node.run(cmd, {checkErrors: false});
        return returnCode === 0;
    }, {message: `Package ${pkg_name} was not cached`});
});

When(/^I create the bootstrap repository for "([^"]*)" on the server((?: without flushing)?)$/, async function (host: string, without_flushing: string) {
    const isTransactional = await (await getTarget('server')).run('test -f /etc/transactional-update.conf').then(r => r.returnCode === 0);
    if (host === 'proxy' && !isTransactional) {
        host = 'proxy_nontransactional';
    }
    const base_channel = BASE_CHANNEL_BY_CLIENT[globalVars.product][host];
    const productKey = globalVars.product as keyof typeof CHANNEL_LABEL_TO_SYNC_BY_BASE_CHANNEL;
    const baseChannels = CHANNEL_LABEL_TO_SYNC_BY_BASE_CHANNEL[productKey];
    const parentBaseChannels = PARENT_CHANNEL_LABEL_TO_SYNC_BY_BASE_CHANNEL[productKey];
    const channel = baseChannels && base_channel in baseChannels ? baseChannels[base_channel as keyof typeof baseChannels] : undefined;
    const parent_channel = parentBaseChannels && base_channel in parentBaseChannels ? parentBaseChannels[base_channel as keyof typeof parentBaseChannels] : undefined;
    const server = await getTarget('server');
    await server.waitWhileProcessRunning('mgr-create-bootstrap-repo');

    console.log(`base_channel: ${base_channel}`);
    console.log(`channel: ${channel}`);
    console.log(`parent_channel: ${parent_channel}`);

    let cmd: string;
    if (!parent_channel) {
        cmd = `mgr-create-bootstrap-repo --create ${channel} --with-custom-channels`;
    } else {
        cmd = `mgr-create-bootstrap-repo --create ${channel} --with-parent-channel ${parent_channel} --with-custom-channels`;
    }

    if (!without_flushing) {
        cmd += ' --flush';
    }

    console.log('Creating the bootstrap repository on the server:');
    console.log(`  ${cmd}`);
    await server.run(cmd, {execOption: '-it'});
});

When(/^I create the bootstrap repositories including custom channels$/, async function () {
    await (await getTarget('server')).waitWhileProcessRunning('mgr-create-bootstrap-repo');
    await (await getTarget('server')).run('mgr-create-bootstrap-repo --auto --force --with-custom-channels', {
        checkErrors: false,
        verbose: true
    });
});

When(/^I install "([^"]*)" product on the proxy$/, async function (product) {
    const {stdout} = await (await getTarget('proxy')).run(`zypper ref && zypper --non-interactive install --auto-agree-with-licenses --force-resolution -t product ${product}`);
    console.log(`Installed ${product} product: ${stdout}`);
});

When(/^I install proxy pattern on the proxy$/, async function () {
    const pattern = globalVars.product === 'Uyuni' ? 'uyuni_proxy' : 'suma_proxy';
    const cmd = `zypper --non-interactive install -t pattern ${pattern}`;
    await (await getTarget('proxy')).run(cmd, {timeout: 600, successCodes: [0, 100, 101, 102, 103, 106]});
});

When(/^I let squid use avahi on the proxy$/, async function () {
    const file = '/usr/share/rhn/proxy-template/squid.conf';
    let key = 'dns_multicast_local';
    let val = 'on';
    await (await getTarget('proxy')).run(`grep '^${key}' ${file} && sed -i -e 's/^${key}.*$/${key} ${val}/' ${file} || echo '${key} ${val}' >> ${file}`);
    key = 'ignore_unknown_nameservers';
    val = 'off';
    await (await getTarget('proxy')).run(`grep '^${key}' ${file} && sed -i -e 's/^${key}.*$/${key} ${val}/' ${file} || echo '${key} ${val}' >> ${file}`);
});

When(/^I open avahi port on the proxy$/, async function () {
    await (await getTarget('proxy')).run('firewall-offline-cmd --zone=public --add-service=mdns');
});

When(/^I copy server\'s keys to the proxy$/, async function () {
    if (await runningK3s()) {
        // Server running in Kubernetes doesn't know anything about SSL CA
        await generateCertificate('proxy', (await getTarget('proxy')).fullHostname);

        for (const file of ['proxy.crt', 'proxy.key', 'ca.crt']) {
            let success = await fileExtract(await getTarget('server'), `/tmp/${file}`, `/tmp/${file}`);
            if (!success) throw new Error('File extraction failed');

            success = await fileInject(await getTarget('proxy'), `/tmp/${file}`, `/tmp/${file}`);
            if (!success) throw new Error('File injection failed');
        }
    } else {
        for (const file of ['RHN-ORG-PRIVATE-SSL-KEY', 'RHN-ORG-TRUSTED-SSL-CERT', 'rhn-ca-openssl.cnf']) {
            const success = await fileExtract(await getTarget('server'), `/root/ssl-build/${file}`, `/tmp/${file}`);
            if (!success) throw new Error('File extraction failed');

            await (await getTarget('proxy')).run('mkdir -p /root/ssl-build');
            const successInject = await fileInject(await getTarget('proxy'), `/tmp/${file}`, `/root/ssl-build/${file}`);
            if (!successInject) throw new Error('File injection failed');
        }
    }
});

When(/^I configure the proxy$/, async function () {
    // prepare the settings file
    let settings = `RHN_PARENT=${(await getTarget('server')).fullHostname}\n` +
        `HTTP_PROXY=''\n` +
        `VERSION=''\n` +
        `TRACEBACK_EMAIL=galaxy-noise@suse.de\n` +
        `POPULATE_CONFIG_CHANNEL=y\n` +
        `RHN_USER=admin\n`;
    if (await runningK3s()) {
        settings += `USE_EXISTING_CERTS=y\n` +
            `CA_CERT=/tmp/ca.crt\n` +
            `SERVER_KEY=/tmp/proxy.key\n` +
            `SERVER_CERT=/tmp/proxy.crt\n`;
    } else {
        settings += `USE_EXISTING_CERTS=n\n` +
            `INSTALL_MONITORING=n\n` +
            `SSL_PASSWORD=spacewalk\n` +
            `SSL_ORG=SUSE\n` +
            `SSL_ORGUNIT=SUSE\n` +
            `SSL_COMMON=${(await getTarget('proxy')).fullHostname}\n` +
            `SSL_CITY=Nuremberg\n` +
            `SSL_STATE=Bayern\n` +
            `SSL_COUNTRY=DE\n` +
            `SSL_EMAIL=galaxy-noise@suse.de\n` +
            `SSL_CNAME_ASK=proxy.example.org\n`;
    }
    const tempFile = await generateTempFile('config-answers.txt', settings);
    await this.step(`I copy "${tempFile}" to "proxy"`);
    const filename = path.basename(tempFile);

    // perform the configuration
    const cmd = `configure-proxy.sh --non-interactive --rhn-user=admin --rhn-password=admin --answer-file=${filename}`;
    const proxy_timeout = 600;
    await (await getTarget('proxy')).run(cmd, {timeout: proxy_timeout, verbose: true});
});

When(/^the server starts mocking an IPMI host$/, async function () {
    const server = await getTarget('server');
    await server.runLocal(
        'podman run -d --rm --network uyuni -p [::]:623:623/udp -p [::]:9002:9002 --name fakeipmi ghcr.io/uyuni-project/uyuni/ci-fakeipmi:master',
        {verbose: true, checkErrors: true}
    );
});

When(/^the server stops mocking an IPMI host$/, async function () {
    const server = await getTarget('server');
    await server.runLocal('podman kill fakeipmi');
});

When(/^I allow all SSL protocols on the proxy\'s apache$/, async function () {
    const file = '/etc/apache2/ssl-global.conf';
    const key = 'SSLProtocol';
    const val = 'all -SSLv2 -SSLv3';
    await (await getTarget('proxy')).run(`grep '${key}' ${file} && sed -i -e 's/${key}.*$/${key} ${val}/' ${file}`);
    await (await getTarget('proxy')).run('systemctl reload apache2.service', {verbose: true});
});

When(/^I restart squid service on the proxy$/, async function () {
    // We need to restart squid when we add a CNAME to the certificate
    await (await getTarget('proxy')).run('systemctl restart squid.service');
});

When(/^I create channel "([^"]*)" from spacecmd of type "([^"]*)"$/, async function (name, type) {
    const command = `spacecmd -u admin -p admin -- configchannel_create -n ${name} -t  ${type}`;
    await (await getTarget('server')).run(command);
});

When(/^I update init.sls from spacecmd with content "([^"]*)" for channel "([^"]*)"$/, async function (content, label) {
    const filepath = `/tmp/${label}`;
    await (await getTarget('server')).run(`echo -e "${content}" > ${filepath}`, {timeout: 600});
    const command = `spacecmd -u admin -p admin -- configchannel_updateinitsls -c ${label} -f  ${filepath} -y`;
    await (await getTarget('server')).run(command);
    await fileDelete(await getTarget('server'), filepath);
});

When(/^I update init.sls from spacecmd with content "([^"]*)" for channel "([^"]*)" and revision "([^"]*)"$/, async function (content, label, revision) {
    const filepath = `/tmp/${label}`;
    await (await getTarget('server')).run(`echo -e "${content}" > ${filepath}`, {timeout: 600});
    const command = `spacecmd -u admin -p admin -- configchannel_updateinitsls -c ${label} -f ${filepath} -r ${revision} -y`;
    await (await getTarget('server')).run(command);
    await fileDelete(await getTarget('server'), filepath);
});

When(/^I schedule apply configchannels for "([^"]*)"$/, async function (host) {
    const system_name = await getSystemName(host);
    await (await getTarget('server')).run('spacecmd -u admin -p admin clear_caches');
    const command = `spacecmd -y -u admin -p admin -- system_scheduleapplyconfigchannels  ${system_name}`;
    await (await getTarget('server')).run(command);
});

When(/^I refresh packages list via spacecmd on "([^"]*)"$/, async function (client) {
    const node = await getSystemName(client);
    await (await getTarget('server')).run('spacecmd -u admin -p admin clear_caches');
    const command = `spacecmd -u admin -p admin system_schedulepackagerefresh ${node}`;
    await (await getTarget('server')).run(command);
});

When(/^I refresh the packages list via package manager on "([^"]*)"$/, async function (host) {
    const node = await getTarget(host);
    if (await node.run('which yum')) {
        await node.run('yum -y clean all');
        await node.run('yum -y makecache');
    }
});

Then(/^I wait until refresh package list on "([^"]*)" is finished$/, async function (client) {
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
});

When(/^spacecmd should show packages "([^"]*)" installed on "([^"]*)"$/, async function (packages, client) {
    const node = await getSystemName(client);
    await (await getTarget('server')).run('spacecmd -u admin -p admin clear_caches');
    const command = `spacecmd -u admin -p admin system_listinstalledpackages ${node}`;
    const {stdout: result} = await (await getTarget('server')).run(command, {checkErrors: false});
    for (const pkg of packages.split(' ')) {
        if (!result.includes(pkg.trim())) {
            throw new Error(`package ${pkg.trim()} is not installed`);
        }
    }
});

When(/^I wait until package "([^"]*)" is installed on "([^"]*)" via spacecmd$/, async function (pkg, client) {
    const node = await getSystemName(client);
    await (await getTarget('server')).run('spacecmd -u admin -p admin clear_caches');
    const command = `spacecmd -u admin -p admin system_listinstalledpackages ${node}`;
    await repeatUntilTimeout(async () => {
        const {stdout: result} = await (await getTarget('server')).run(command, {checkErrors: false});
        if (result.includes(pkg)) return true;
        await new Promise(resolve => setTimeout(resolve, 1000));
        return false;
    }, {timeout: 600, message: `package ${pkg} is not installed yet`});
});

When(/^I wait until package "([^"]*)" is removed from "([^"]*)" via spacecmd$/, async function (pkg, client) {
    const node = await getSystemName(client);
    await (await getTarget('server')).run('spacecmd -u admin -p admin clear_caches');
    const command = `spacecmd -u admin -p admin system_listinstalledpackages ${node}`;
    await repeatUntilTimeout(async () => {
        const {stdout: result} = await (await getTarget('server')).run(command, {checkErrors: false});
        if (!result.includes(pkg)) return true;
        await new Promise(resolve => setTimeout(resolve, 1000));
        return false;
    }, {timeout: 600, message: `package ${pkg} is still present`});
});

When(/^I apply "([^"]*)" local salt state on "([^"]*)"$/, async function (state, host) {
    const node = await getTarget(host);
    const useSaltBundle = (await node.run('test -f /etc/venv-salt-minion/minion && echo true || echo false')).stdout.trim() === 'true';
    let salt_call = useSaltBundle ? 'venv-salt-call' : 'salt-call';
    if (host === 'server') {
        salt_call = 'salt-call';
    }
    const source = `../upload_files/salt/${state}.sls`;
    const remote_file = `/usr/share/susemanager/salt/${state}.sls`;
    const success = await fileInject(node, source, remote_file);
    if (!success) throw new Error('File injection failed');

    await node.run(`${salt_call} --local --file-root=/usr/share/susemanager/salt --module-dirs=/usr/share/susemanager/salt/ --log-level=info --retcode-passthrough state.apply ${state}`);
});

When(/^I copy unset package file on "([^"]*)"$/, async function (minion) {
    const base_dir = "../upload_files/unset_package/";
    const success = await fileInject(await getTarget(minion), `${base_dir}subscription-tools-1.0-0.noarch.rpm`, '/root/subscription-tools-1.0-0.noarch.rpm');
    if (!success) throw new Error('File injection failed');
});

When(/^I restart the "([^"]*)" service on "([^"]*)"$/, async function (service: string, host: string) {
    const node = await getTarget(host);
    await node.run(`systemctl restart ${service}.service`);
});

When(/^I copy vCenter configuration file on server$/, async function () {
    const base_dir = "../upload_files/virtualization/";
    const success = await fileInject(await getTarget('server'), `${base_dir}vCenter.json`, '/var/tmp/vCenter.json');
    if (!success) throw new Error('File injection failed');
});

When(/^I export software channels "([^"]*)" with ISS v2 to "([^"]*)"$/, async function (channel, path) {
    await (await getTarget('server')).run(`inter-server-sync export --channels=${channel} --outputDir=${path}`);
});

When(/^I export config channels "([^"]*)" with ISS v2 to "([^"]*)"$/, async function (channel, path) {
    await (await getTarget('server')).run(`inter-server-sync export --configChannels=${channel} --outputDir=${path}`);
});

When(/^I import data with ISS v2 from "([^"]*)"$/, async function (path) {
    // WORKAROUND for bsc#1249127
    // Remove "echo UglyWorkaround |" when the product issue is solved
    await (await getTarget('server')).run(`echo UglyWorkaround | inter-server-sync import --importDir=${path}`);
});

Then(/^"([^"]*)" folder on server is ISS v2 export directory$/, async function (folder) {
    if (!await fileExists(await getTarget('server'), `${folder}/sql_statements.sql.gz`)) {
        throw new Error(`Folder ${folder} not found`);
    }
});

When(/^I ensure folder "([^"]*)" doesn\'t exist on "([^"]*)"$/, async function (folder, host) {
    const node = await getTarget(host);
    if (await folderExists(node, folder)) {
        const success = await folderDelete(node, folder);
        if (!success) {
            throw new Error(`Folder '${folder}' exists and cannot be removed`);
        }
    }
});

// ReportDB

Then(/^I should be able to connect to the ReportDB on the server$/, async function () {
    // connect and quit database
    const {returnCode} = await (await getTarget('server')).run(reportdbServerQuery('\\q'));
    if (returnCode !== 0) throw new Error('Couldn\'t connect to the ReportDB on the server');
});

Then(/^there should be a user allowed to create roles on the ReportDB$/, async function () {
    const {
        stdout: users_and_permissions,
        returnCode
    } = await (await getTarget('server')).run(reportdbServerQuery('\\du'));
    if (returnCode !== 0) throw new Error('Couldn\'t connect to the ReportDB on the server');

    // extract only the line for the suma user
    const suma_user_permissions = users_and_permissions.match(/pythia_susemanager(.*)/);
    if (!suma_user_permissions || !['Create role'].every(permission => suma_user_permissions[0].includes(permission))) {
        throw new Error('ReportDB admin user pythia_susemanager doesn\'t have the required permissions');
    }
});

When(/^I create a read-only user for the ReportDB$/, async function () {
    const reportdb_ro_user = 'test_user';
    const file = 'create_user_reportdb.exp';
    const source = `../upload_files/${file}`;
    const dest = `/tmp/${file}`;
    const success = await fileInject(await getTarget('server'), source, dest);
    if (!success) throw new Error('File injection in server failed');

    const node = await getTarget('server');
    await node.runLocal(`expect -f /tmp/${file} ${reportdb_ro_user} ${await node.run('test -f /usr/bin/mgrctl && echo true || echo false').then(r => r.stdout.trim() === 'true')}`);
});

Then(/^I should see the read-only user listed on the ReportDB user accounts$/, async function () {
    const {stdout: users_and_permissions} = await (await getTarget('server')).run(reportdbServerQuery('\\du'));
    if (!users_and_permissions.includes('test_user')) throw new Error('Couldn\'t find the newly created user on the ReportDB');
});

When(/^I delete the read-only user for the ReportDB$/, async function () {
    const file = 'delete_user_reportdb.exp';
    const source = `../upload_files/${file}`;
    const dest = `/tmp/${file}`;
    const success = await fileInject(await getTarget('server'), source, dest);
    if (!success) throw new Error('File injection in server failed');

    const node = await getTarget('server');
    await node.runLocal(`expect -f /tmp/${file} test_user ${await node.run('test -f /usr/bin/mgrctl && echo true || echo false').then(r => r.stdout.trim() === 'true')}`);
});

Then(/^I shouldn\'t see the read-only user listed on the ReportDB user accounts$/, async function () {
    const {stdout: users_and_permissions} = await (await getTarget('server')).run(reportdbServerQuery('\\du'));
    if (users_and_permissions.includes('test_user')) throw new Error('Created read-only user on the ReportDB remains listed');
});

Given(/^I know the ReportDB admin user credentials$/, async function () {
    const reportdb_admin_user = await getVariableFromConfFile('server', '/etc/rhn/rhn.conf', 'report_db_user');
    const reportdb_admin_password = await getVariableFromConfFile('server', '/etc/rhn/rhn.conf', 'report_db_password');
    // Store these in context for later steps
    addContext('reportdb_admin_user', reportdb_admin_user);
    addContext('reportdb_admin_password', reportdb_admin_password);
});

When(/^I connect to the ReportDB with read-only user from external machine$/, async function () {
    const server = await getTarget('server');
    const {Client} = await import('pg');
    const conn = new Client({
        host: server.publicIp,
        port: 5432,
        database: 'reportdb',
        user: 'test_user',
        password: 'linux'
    });
    await conn.connect();
    addContext('reportdb_ro_conn', conn);
});

Then(/^I should be able to query the ReportDB$/, async function () {
    const conn = getContext('reportdb_ro_conn');
    if (!conn) {
        throw new Error('ReportDB read-only connection not initialized');
    }
    const result = await conn.query('select * from system;');
    if (!result || !result.rowCount || result.rowCount <= 0) {
        throw new Error('ReportDB System table is unexpectedly empty after query');
    }
});

Then(
    /^I should not be able to "([^"]*)" data in a ReportDB "([^"]*)" as a read-only user$/,
    async function (action: string, target: 'table' | 'view') {
        const conn = getContext('reportdb_ro_conn');
        if (!conn) {
            throw new Error('ReportDB read-only connection not initialized');
        }
        const tableAndViews: Record<string, string> = {
            table: 'system',
            view: 'systeminactivityreport'
        };
        const obj = tableAndViews[target];
        if (!obj) {
            throw new Error(`Unknown ReportDB target type: ${target}`);
        }
        const pgModule = await import('pg');
        const InsufficientPrivilege =
            (pgModule as any).InsufficientPrivilege ??
            (pgModule as any).default?.errors?.InsufficientPrivilege;

        await expect(async () => {
            switch (action) {
                case 'insert':
                    await conn.query(
                        `insert into ${obj} (mgm_id, system_id, synced_date)
                         values (1, 1010101, current_timestamp);`
                    );
                    break;
                case 'update':
                    await conn.query(`update ${obj}
                                      set mgm_id = 2
                                      where mgm_id = 1;`);
                    break;
                case 'delete':
                    await conn.query(`delete
                                      from ${obj}
                                      where mgm_id = 1;`);
                    break;
                default:
                    throw new Error("Couldn't find command to manipulate the database");
            }
        }).rejects.toThrow(InsufficientPrivilege);
    }
);

Then(/^I should find the systems from the UI in the ReportDB$/, async function () {
    const conn = getContext('reportdb_ro_conn');
    if (!conn) {
        throw new Error('ReportDB read-only connection not initialized');
    }
    const uiSystems: string[] = getContext('systems_list') || [];
    const result = await conn.query('select hostname from system;');
    const dbSystems = (result.rows as any[]).map((r: any) => r.hostname as string);
    const allMatch = uiSystems.every((uiSystem) => dbSystems.includes(uiSystem));
    if (!allMatch) {
        throw new Error(
            `Listed systems from the UI ${JSON.stringify(
                uiSystems
            )} don't match the ones from the ReportDB System table ${JSON.stringify(dbSystems)}`
        );
    }
});

Given(/^I know the current synced_date for "([^"]*)"$/, async function (host: string) {
    const conn = getContext('reportdb_ro_conn');
    if (!conn) {
        throw new Error('ReportDB read-only connection not initialized');
    }
    const node = await getTarget(host);
    const systemHostname = node.fullHostname;
    const result = await conn.query(
        'select synced_date from system where hostname = $1',
        [systemHostname]
    );
    if (!result.rows.length) {
        throw new Error(`No synced_date found in ReportDB for host ${systemHostname}`);
    }
    const initialSyncedDate = new Date(result.rows[0].synced_date);
    addContext('initial_synced_date', initialSyncedDate);
});

Then(
    /^I should find the updated "([^"]*)" property as "([^"]*)" on the "([^"]*)", on ReportDB$/,
    async function (propertyName: string, propertyValue: string, host: string) {
        const conn = getContext('reportdb_ro_conn');
        if (!conn) {
            throw new Error('ReportDB read-only connection not initialized');
        }
        const node = await getTarget(host);
        const systemHostname = node.fullHostname;
        const property = propertyName.split('/')[0].replace(/\s+/g, '').toLowerCase();
        const result = await conn.query(
            `select ${property} as prop, synced_date
             from system
             where hostname = $1`,
            [systemHostname]
        );
        if (!result.rows.length) {
            throw new Error(`No data found in ReportDB for host ${systemHostname}`);
        }
        const dbValue = (result.rows[0] as any).prop as string;
        if (dbValue !== propertyValue) {
            throw new Error(
                `${propertyName}'s value not updated - database still presents ${dbValue} instead of ${propertyValue}`
            );
        }
        const finalSyncedDate = new Date((result.rows[0] as any).synced_date as string);
        const initialSyncedDate = getContext('initial_synced_date') as Date | undefined;
        if (!initialSyncedDate) {
            throw new Error('Initial synced_date was not recorded in context');
        }
        if (!(finalSyncedDate > initialSyncedDate)) {
            throw new Error(
                `Column synced_date not updated. Initial synced_date was ${initialSyncedDate} while current synced_date is ${finalSyncedDate}`
            );
        }
    }
);

Given(/^I block connections from "([^"]*)" on "([^"]*)"$/, async function (blockhost, target) {
    const blkhost = await getTarget(blockhost);
    const node = await getTarget(target);
    await node.run(`iptables -A INPUT -s ${blkhost.publicIp} -j LOG`);
    await node.run(`iptables -A INPUT -s ${blkhost.publicIp} -j DROP`);
});

Then(/^I flush firewall on "([^"]*)"$/, async function (target) {
    const node = await getTarget(target);
    await node.run('iptables -F INPUT');
});

When(/^I remove offending SSH key of "([^"]*)" at port "([^"]*)" for "([^"]*)" on "([^"]*)"$/, async function (key_host, key_port, known_hosts_path, host) {
    const system_name = await getSystemName(key_host);
    const node = await getTarget(host);
    await node.run(`ssh-keygen -R [${system_name}]:${key_port} -f ${known_hosts_path}`);
});

Then(/^port "([^"]*)" should be ([^"]*)$/, async function (port, selection) {
    const {returnCode} = await (await getTarget('server')).run(`ss --listening --numeric | grep :${port}`, {
        checkErrors: false,
        verbose: true
    });
    const port_opened = returnCode === 0;
    if (selection === 'closed') {
        if (port_opened) throw new Error(`Port '${port}' open although it should not be!`);
    } else {
        if (!port_opened) throw new Error(`Port '${port}' not open although it should be!`);
    }
});

// rebooting via SSH
When(/^I reboot the server through SSH$/, async function () {
    const temp_server = new RemoteNode('server');
    await temp_server.run('reboot > /dev/null 2> /dev/null &');
    const default_timeout = 300;

    await checkShutdown((await getTarget('server')).fullHostname, default_timeout);
    await checkRestart((await getTarget('server')).fullHostname, temp_server, default_timeout);

    await repeatUntilTimeout(async () => {
        const {stdout} = await temp_server.run('spacewalk-service status', {checkErrors: false, timeout: 10});
        // mgr-check-payg.service will be inactive (dead) for Uyuni, so we cannot check that all services are running
        // we look for the status displayed by apache2.service, the webserver, when it is ready
        if (stdout.includes('Processing requests...')) {
            console.log('Server spacewalk service is up');
            return true;
        }
        await new Promise(resolve => setTimeout(resolve, 1000));
        return false;
    }, {timeout: default_timeout, message: 'Spacewalk didn\'t come up'});
});

//TODO: Refactor this step to don't use embedded steps
When(/^I reboot the "([^"]*)" minion through the web UI$/, async function (host) {
    // await this.step(`Given I am on the Systems overview page of this "${host}"`);
    // await this.step('When I follow first "Schedule System Reboot"');
    // await this.step('Then I should see a "System Reboot Confirmation" text');
    // await this.step('And I should see a "Reboot system" button');
    // await this.step('When I click on "Reboot system"');
    // await this.step('Then I should see a "Reboot scheduled for system" text');
    // await this.step(`And I wait at most 600 seconds until event "System reboot scheduled by ${this.currentUser}" is completed`);
    // await this.step('Then I should see a "This action\'s status is: Completed" text');
});

//TODO: Refactor this step to don't use embedded steps
When(/^I reboot the "([^"]*)" if it is a transactional system$/, async function (host) {
    if (await isTransactionalSystem(host)) {
        // await this.step(`I reboot the "${host}" minion through the web UI`);
        // await this.step('I should not see a "There is a pending transaction for this system, please reboot it to activate the changes." text');
    }
});

// changing hostname
When(/^I change the server\'s short hostname from hosts and hostname files$/, async function () {
    const server_node = await getTarget('server');
    const old_hostname = server_node.hostname;
    const new_hostname = `${old_hostname}-renamed`;
    console.log(`Old hostname: ${old_hostname} - New hostname: ${new_hostname}`);
    await server_node.run(`sed -i 's/${old_hostname}/${new_hostname}/g' /etc/hostname && hostname ${new_hostname} && echo '${server_node.publicIp} ${server_node.fullHostname} ${old_hostname}' >> /etc/hosts && echo '${server_node.publicIp} ${new_hostname}${server_node.fullHostname.substring(server_node.hostname.length)} ${new_hostname}' >> /etc/hosts`);
    // This will refresh the attributes of this node
    await getTarget('server', true);
    const {stdout: hostname} = await (await getTarget('server')).run('hostname');
    if (hostname.trim() !== new_hostname) throw new Error(`Wrong hostname after changing it. Is: ${hostname.trim()}, should be: ${new_hostname}`);

    // Add the new hostname on controller's /etc/hosts to resolve in smoke tests
    exec(`echo '${server_node.publicIp} ${new_hostname}${server_node.fullHostname.substring(server_node.hostname.length)} ${new_hostname}' >> /etc/hosts`);
});

When(/^I run spacewalk-hostname-rename command on the server$/, async function () {
    const server_node = await getTarget('server');
    const command = 'spacecmd --nossl -q api api.getVersion -u admin -p admin; ' +
        `spacewalk-hostname-rename ${server_node.publicIp} ` +
        '--ssl-country=DE --ssl-state=Bayern --ssl-city=Nuremberg ' +
        '--ssl-org=SUSE --ssl-orgunit=SUSE --ssl-email=galaxy-noise@suse.de ' +
        '--ssl-ca-password=spacewalk --overwrite_report_db_host=y';
    const {stdout: out_spacewalk, returnCode: result_code} = await server_node.run(command, {checkErrors: false});
    console.log(out_spacewalk);

    await getTarget('server', true); // This will refresh the attributes of this node

    const default_timeout = 300;
    await repeatUntilTimeout(async () => {
        const {stdout} = await server_node.run('spacewalk-service status', {checkErrors: false, timeout: 10});
        // mgr-check-payg.service will be inactive (dead) for Uyuni, so we cannot check that all services are running
        // we look for the status displayed by apache2.service, the webserver, when it is ready
        if (stdout.includes('Processing requests...')) {
            console.log('Server: spacewalk service is up');
            return true;
        }
        await new Promise(resolve => setTimeout(resolve, 1000));
        return false;
    }, {timeout: default_timeout, message: 'Spacewalk didn\'t come up'});

    // Update the server CA certificate since it changed, otherwise all API and browser uses will fail
    console.log('Update controller CA certificates');
    await updateControllerCA();

    // Reset the API client to take the new CA into account
    console.log('Resetting the API client');
    await resetApiTest();

    if (result_code !== 0) throw new Error('Error while running spacewalk-hostname-rename command - see logs above');
    if (out_spacewalk.includes('No such file or directory')) throw new Error('Error in the output logs - see logs above');
});

When(/^I check all certificates after renaming the server hostname$/, async function () {
    // get server certificate serial to compare it with the other minions
    const command_server = "openssl x509 -noout -text -in /etc/pki/trust/anchors/LOCAL-RHN-ORG-TRUSTED-SSL-CERT | grep -A1 'Serial' | grep -v 'Serial'";
    const {stdout: server_cert_serial, returnCode} = await (await getTarget('server')).run(command_server);
    console.log(`Server certificate serial: ${server_cert_serial.trim()}`);

    if (returnCode !== 0) throw new Error('Error getting server certificate serial!');

    const targets = ['proxy', 'sle_minion', 'ssh_minion', 'rhlike_minion', 'deblike_minion', 'build_host'];
    for (const target of targets) {
        const os_family = (await getTarget(target)).osFamily;
        // get all defined minions from the environment variables and check their certificate serial
        if (!process.env[target.toUpperCase()]) continue;

        // Red Hat-like and Debian-like minions store their certificates in a different location
        let certificate: string;
        switch (os_family) {
            case 'centos':
            case 'rocky':
                certificate = '/etc/pki/ca-trust/source/anchors/RHN-ORG-TRUSTED-SSL-CERT';
                break;
            case 'ubuntu':
            case 'debian':
                certificate = '/usr/local/share/ca-certificates/susemanager/RHN-ORG-TRUSTED-SSL-CERT.crt';
                break;
            default:
                certificate = '/etc/pki/trust/anchors/RHN-ORG-TRUSTED-SSL-CERT';
        }
        await (await getTarget(target)).run(`test -s ${certificate}`, {successCodes: [0], checkErrors: true});

        const command_minion = `openssl x509 -noout -text -in ${certificate} | grep -A1 'Serial' | grep -v 'Serial'`;
        const {
            stdout: minion_cert_serial,
            returnCode: minionReturnCode
        } = await (await getTarget(target)).run(command_minion);

        if (minionReturnCode !== 0) throw new Error(`${target}: Error getting server certificate serial!`);

        console.log(`${target} certificate serial: ${minion_cert_serial.trim()}`);

        if (minion_cert_serial.trim() !== server_cert_serial.trim()) throw new Error(`${target}: Error, certificate does not match with server one`);
    }
});

When(/^I change back the server\'s hostname$/, async function () {
    const server_node = await getTarget('server');
    const old_hostname = server_node.hostname;
    const new_hostname = old_hostname.replace('-renamed', '');
    console.log(`Old hostname: ${old_hostname} - New hostname: ${new_hostname}`);
    await server_node.run(`sed -i 's/${old_hostname}/${new_hostname}/g' /etc/hostname && hostname ${new_hostname} && sed -i '$d' /etc/hosts && sed -i '$d' /etc/hosts`);
    await getTarget('server', true);
    const {stdout: hostname} = await (await getTarget('server')).run('hostname');
    if (hostname.trim() !== new_hostname) throw new Error(`Wrong hostname after changing it. Is: ${hostname.trim()}, should be: ${new_hostname}`);

    // Cleanup the temporary entry in /etc/hosts on the controller
    exec('sed -i \'$d\' /etc/hosts');
});

When(/^I enable firewall ports for monitoring on this "([^"]*)"$/, async function (host) {
    let add_ports = '';
    for (const port of [9100, 9117, 9187]) {
        add_ports += `firewall-cmd --add-port=${port}/tcp --permanent && `;
    }
    const cmd = `${add_ports.slice(0, -4)} firewall-cmd --reload`;
    const node = await getTarget(host);
    await node.run(cmd);
    const {stdout: output} = await node.run('firewall-cmd --list-ports');
    if (!output.includes('9100/tcp 9117/tcp 9187/tcp')) {
        throw new Error(`Couldn't successfully enable all ports needed for monitoring. Opened ports: ${output}`);
    }
});

When(/^I delete the system "([^"]*)" via spacecmd$/, async function (minion) {
    const node = await getSystemName(minion);
    const command = `spacecmd -u admin -p admin -y system_delete ${node}`;
    await (await getTarget('server')).run(command, {checkErrors: true, verbose: true});
});

When(/^I execute "([^"]*)" on the "([^"]*)"$/, async function (command, host) {
    const node = await getTarget(host);
    await node.run(command, {checkErrors: true, verbose: true});
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

When(/^I should see the image for "([^"]*)" is built$/, async function (host: string) {
    const node = await getTarget(host);
    const {stdout} = await node.run('ls /srv/www/os-images');
    if (!stdout.includes(host)) {
        throw new Error(`Image for ${host} is not built`);
    }
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

Then(/^the clock from "([^"]*)" should be exact$/, async function (host: string) {
    const node = await getTarget(host);
    const {stdout: clockNode} = await node.run("date +'%s'");
    const controller = Math.floor(Date.now() / 1000);
    const diff = parseInt(String(clockNode).trim(), 10) - controller;
    if (Math.abs(diff) >= 2) throw new Error(`clocks differ by ${diff} seconds`);
});

When(/^I clean the search index on the server$/, async function () {
    const server = await getTarget('server');
    const {returnCode} = await server.run('/usr/sbin/rhn-search cleanindex', {checkErrors: false});
    if (returnCode !== 0) {
        throw new Error('Failed to clean search index on the server');
    }
});

When(/^I start the health check tool with supportconfig "([^"]*)" on "([^"]*)"$/, async function (supportconfig: string, host: string) {
    const node = await getTarget(host);
    await node.run(`podman run -d --name health-check-tool -p 8080:8080 -v ${supportconfig}:/supportconfig:ro registry.suse.com/suse/manager/5.0/manager-health-check:latest`);
});

When(/^I stop health check tool on "([^"]*)"$/, async function (host: string) {
    const node = await getTarget(host);
    await node.run('podman stop health-check-tool && podman rm health-check-tool');
});

Then(/^I check that the health check tool exposes metrics on "([^"]*)"$/, async function (host: string) {
    const node = await getTarget(host);
    const {stdout, returnCode} = await node.run('curl -s http://localhost:8080/metrics');
    if (returnCode !== 0 || !stdout.includes('health_check_tool_info')) {
        throw new Error('Health check tool is not exposing metrics correctly');
    }
});

Then(/^I check that the health check tool (is|is not) running on "([^"]*)"$/, async function (action: string, host: string) {
    const node = await getTarget(host);
    const {returnCode} = await node.run('podman ps | grep health-check-tool', {checkErrors: false});
    const isRunning = returnCode === 0;

    if (action === 'is' && !isRunning) {
        throw new Error('Health check tool is not running');
    } else if (action === 'is not' && isRunning) {
        throw new Error('Health check tool is still running');
    }
});

Then(/^I remove test supportconfig on "([^"]*)"$/, async function (host: string) {
    const node = await getTarget(host);
    await node.run('rm -rf /root/server-supportconfig');
});

When(/^the controller starts mocking a Redfish host$/, async function () {
    const controllerNode = await getTarget('controller');
    const hostname = controllerNode.fullHostname;

    let crt_path: string;
    let key_path: string;

    if (await runningK3s()) {
        // On kubernetes, the server has no clue about certificates
        const paths = await generateCertificate('controller', hostname);
        crt_path = paths[0];
        key_path = paths[1];
    } else {
        const serverNode = await getTarget('server');
        await serverNode.run(`mgr-ssl-tool --gen-server -d /root/ssl-build -p spacewalk --set-hostname ${hostname} --server-cert=controller.crt --server-key=controller.key`);
        const {stdout: keyPathOutput} = await serverNode.run('ls /root/ssl-build/*/controller.key');
        key_path = keyPathOutput.trim();
        const {stdout: crtPathOutput} = await serverNode.run('ls /root/ssl-build/*/controller.crt');
        crt_path = crtPathOutput.trim();
    }

    await fileExtract(await getTarget('server'), key_path, '/root/controller.key');
    await fileExtract(await getTarget('server'), crt_path, '/root/controller.crt');

    await new Promise((resolve, reject) => {
        exec('curl --output /root/DSP2043_2019.1.zip https://www.dmtf.org/sites/default/files/standards/documents/DSP2043_2019.1.zip', (error, stdout, stderr) => {
            if (error) {
                console.error(`curl error: ${error.message}`);
                reject(error);
                return;
            }
            console.log(`curl stdout: ${stdout}`);
            console.error(`curl stderr: ${stderr}`);
            resolve(null);
        });
    });

    await new Promise((resolve, reject) => {
        exec('unzip /root/DSP2043_2019.1.zip -d /root/', (error, stdout, stderr) => {
            if (error) {
                console.error(`unzip error: ${error.message}`);
                reject(error);
                return;
            }
            console.log(`unzip stdout: ${stdout}`);
            console.error(`unzip stderr: ${stderr}`);
            resolve(null);
        });
    });

    const redfishMockupServerPath = path.join(__dirname, '../upload_files/Redfish-Mockup-Server/redfishMockupServer.py');
    const cmd = `/usr/bin/python3 ${redfishMockupServerPath} ` +
        `-H ${hostname} -p 8443 ` +
        `-S -D /root/DSP2043_2019.1/public-catfish/ ` +
        `--ssl --cert /root/controller.crt --key /root/controller.key ` +
        `< /dev/null > /dev/null 2>&1 &`;

    await new Promise((resolve, reject) => {
        exec(cmd, (error, stdout, stderr) => {
            if (error) {
                console.error(`redfishMockupServer.py start error: ${error.message}`);
                reject(error);
                return;
            }
            console.log(`redfishMockupServer.py start stdout: ${stdout}`);
            console.error(`redfishMockupServer.py start stderr: ${stderr}`);
            resolve(null);
        });
    });
});

When(/^the controller stops mocking a Redfish host$/, async function () {
    const redfishMockupServerPath = path.join(__dirname, '../upload_files/Redfish-Mockup-Server/redfishMockupServer.py');
    await new Promise((resolve, reject) => {
        exec(`pkill -e -f ${redfishMockupServerPath}`, (error, stdout, stderr) => {
            if (error) {
                console.error(`pkill error: ${error.message}`);
                reject(error);
                return;
            }
            console.log(`pkill stdout: ${stdout}`);
            console.error(`pkill stderr: ${stderr}`);
            resolve(null);
        });
    });
    await new Promise((resolve, reject) => {
        exec('rm -rf /root/DSP2043_2019.1*', (error, stdout, stderr) => {
            if (error) {
                console.error(`rm error: ${error.message}`);
                reject(error);
                return;
            }
            console.log(`rm stdout: ${stdout}`);
            console.error(`rm stderr: ${stderr}`);
            resolve(null);
        });
    });
});

Then(/^I should be able to connect to the ReportDB with the ReportDB admin user$/, async function () {
    const node = await getTarget('server');
    const reportdb_admin_user = getContext('reportdb_admin_user');
    const reportdb_admin_password = getContext('reportdb_admin_password');

    if (!reportdb_admin_user || !reportdb_admin_password) {
        throw new Error('ReportDB admin credentials not found in context.');
    }

    const conn = new Client({
        host: node.publicIp,
        port: 5432,
        database: 'reportdb',
        user: reportdb_admin_user,
        password: reportdb_admin_password,
    });

    try {
        await conn.connect();
        await conn.end();
    } catch (error: any) {
        throw new Error(`Couldn't connect to ReportDB with admin from external machine: ${error.message}`);
    }
});

Then(/^I should not be able to connect to product database with the ReportDB admin user$/, async function () {
    const node = await getTarget('server');
    const reportdb_admin_user = getContext('reportdb_admin_user');
    const reportdb_admin_password = getContext('reportdb_admin_password');

    if (!reportdb_admin_user || !reportdb_admin_password) {
        throw new Error('ReportDB admin credentials not found in context.');
    }

    const dbname = 'susemanager';
    const conn = new Client({
        host: node.publicIp,
        port: 5432,
        database: dbname,
        user: reportdb_admin_user,
        password: reportdb_admin_password,
    });

    const pgModule = await import('pg');
    const InsufficientPrivilege =
        (pgModule as any).InsufficientPrivilege ??
        (pgModule as any).default?.errors?.InsufficientPrivilege;

    await expect(async () => {
        await conn.connect();
        await conn.query('select * from rhnserver;');
    }).rejects.toThrow(InsufficientPrivilege);

    await conn.end();
});
