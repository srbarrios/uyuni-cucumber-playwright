import {Given, Then, When} from '@cucumber/cucumber';
import {
    addContext,
    BASE_CHANNEL_BY_CLIENT,
    envConfig,
    getApiTest,
    getContext,
    getSystemId,
    getSystemName,
    getTarget,
    globalVars,
    LABEL_BY_BASE_CHANNEL,
    repeatUntilTimeout
} from '../helpers/index.js';
import {expect} from "@playwright/test";
import {createUser} from "../helpers/embedded_steps/navigation_helper.js";

Given(/^I want to operate on this "([^"]*)"$/, async function (host) {
    const systemName = await getSystemName(host);
    const systems = await getApiTest().system.searchByName(systemName);
    const firstMatch = systems[0];
    if (firstMatch) {
        addContext('clientId', firstMatch['id']);
    }
    expect(getContext('clientId')).not.toBeNull();
});

When(
    /^I call system\.bootstrap\(\) on host "([^"]*)" and salt-ssh "([^"]*)"$/,
    async (host, saltSshEnabled) => {
        const systemName = await getSystemName(host);
        const saltSsh = saltSshEnabled === 'enabled';
        const akey = saltSsh ? '1-SUSE-SSH-KEY-x86_64' : '1-SUSE-KEY-x86_64';
        const result = await getApiTest().system.bootstrapSystem(
            systemName,
            akey,
            saltSsh
        );
        expect(result).toBe(1);
    }
);

When(
    /^I call system\.bootstrap\(\) on unknown host, I should get an API fault$/,
    async () => {
        let exceptionThrown = false;
        try {
            await getApiTest().system.bootstrapSystem('imprettysureidontexist', '', false);
        } catch (err) {
            exceptionThrown = true;
        }
        expect(exceptionThrown).toBe(true);
    }
);

When(
    /^I call system\.bootstrap\(\) on a Salt minion with saltSSH = true, but with activation key with default contact method, I should get an API fault$/,
    async () => {
        let exceptionThrown = false;
        try {
            const target = await getTarget('sle_minion');
            await getApiTest().system.bootstrapSystem(
                target.fullHostname,
                '1-SUSE-KEY-x86_64',
                true
            );
        } catch (err) {
            exceptionThrown = true;
        }
        expect(exceptionThrown).toBe(true);
    }
);

When(/^I schedule a highstate for "([^"]*)" via API$/, async (host) => {
    const systemName = await getSystemName(host);
    const nodeId = await getApiTest().system.retrieveServerId(systemName);
    expect(nodeId).not.toBeNull();
    if (nodeId === null) {
        throw new Error(`Cannot find node ID for system ${systemName}`);
    }
    const dateHigh = new Date().toISOString();
    await getApiTest().system.scheduleApplyHighstate(nodeId, dateHigh, false);
});

When(
    /^I unsubscribe "([^"]*)" from configuration channel "([^"]*)"$/,
    async (host1, channel) => {
        const systemName1 = await getSystemName(host1);
        const nodeId1 = await getApiTest().system.retrieveServerId(systemName1);
        expect(nodeId1).not.toBeNull();
        if (nodeId1 !== null) {
            await getApiTest().system.config.removeChannels([nodeId1], [channel]);
        }
    }
);

When(/^I create a system record$/, async () => {
    const dev = {
        name: 'eth0',
        ip: '1.1.1.1',
        mac: '00:22:22:77:EE:CC',
        dnsname: 'testserver.example.com'
    };
    await getApiTest().system.createSystemRecord(
        'testserver',
        'fedora_kickstart_profile_upload',
        '',
        'my test server',
        [dev]
    );
});

When(
    /^I create a system record with name "([^"]*)" and kickstart label "([^"]*)"$/,
    async (name, label) => {
        const dev = {
            name: 'eth0',
            ip: '1.1.1.2',
            mac: '00:22:22:77:EE:DD',
            dnsname: 'testserver.example.com'
        };
        await getApiTest().system.createSystemRecord(name, label, '', 'my test server', [
            dev
        ]);
    }
);

When(/^I wait for the OpenSCAP audit to finish$/, async () => {
    const target = await getTarget('sle_minion');
    addContext('sleId', await getApiTest().system.retrieveServerId(target.fullHostname));

    await repeatUntilTimeout(async () => {
        const sleId = getContext('sleId')
        expect(sleId).not.toBeNull();
        if (sleId === null) {
            throw new Error('System ID is null');
        }
        const scans = await getApiTest().system.scap.listXccdfScans(sleId);
        return scans.length > 1;
    }, {message: 'Process did not complete'});
});

When(/^I retrieve the relevant errata for (.+)$/, async (rawHosts) => {
    const hosts = rawHosts.split(',').map((h: { strip: () => any; }) => h.strip());
    const sids = [];

    for (const host of hosts) {
        const node = await getTarget(host);
        sids.push(await getSystemId(node));
    }
    if (sids.length === 1) {
        await getApiTest().system.getSystemErrata(sids[0]);
    } else {
        await getApiTest().system.getSystemsErrata(sids);
    }
});

When(/^I call user\.list_users\(\)$/, async () => {
    addContext('users', await getApiTest().user.listUsers());
});

Then(/^I should get at least user "([^"]*)"$/, async (user) => {
    const logins = getContext('users').map((u: { [x: string]: any; }) => u['login']);
    expect(logins).toContain(user);
});

When(/^I call user\.list_roles\(\) on user "([^"]*)"$/, async (user) => {
    addContext('roles', await getApiTest().user.listRoles(user));
});

Then(
    /^I should get at least one role that matches "([^"]*)" suffix$/,
    async (suffix) => {
        const matchingRoles = getContext('roles').filter((el: string) => el.match(`/${suffix}/`));
        expect(matchingRoles.length).toBeGreaterThan(0);
    }
);

Then(/^I should get role "([^"]*)"$/, async (rolename) => {
    expect(getContext('roles')).toContain(rolename);
});

Then(/^I should not get role "([^"]*)"$/, async (rolename) => {
    expect(getContext('roles')).not.toContain(rolename);
});

When(/^I call user\.create\(\) with login "([^"]*)"$/, async (user) => {
    const result = await getApiTest().user.create(
        user,
        'JamesBond007',
        'Hans',
        'Mustermann',
        'hans.mustermann@suse.com'
    );
    expect(result).toBe(1);
});

When(
    /^I call user\.add_role\(\) on "([^"]*)" with the role "([^"]*)"$/,
    async (user, role) => {
        const result = await getApiTest().user.addRole(user, role);
        expect(result).toBe(1);
    }
);

When(/^I delete user "([^"]*)"$/, async (user) => {
    await getApiTest().user.delete(user);
});

When(/^I make sure "([^"]*)" is not present$/, async (user) => {
    const users = await getApiTest().user.listUsers();
    const userLogins = users.map((u: { [x: string]: any; }) => u['login']);
    if (userLogins.includes(user)) {
        await getApiTest().user.delete(user);
    }
});

When(
    /^I call user\.remove_role\(\) on "([^"]*)" with the role "([^"]*)"$/,
    async (luser, rolename) => {
        const result = await getApiTest().user.removeRole(luser, rolename);
        expect(result).toBe(1);
    }
);

Given(
    /^I create a user with name "([^"]*)" and password "([^"]*)"/,
    async (user, password) => {
        await createUser(user, password);
    }
);

Given(
    /^I attempt to create a user with username "([^"]*)" and password "([^"]*)"/,
    async (user, password) => {
        const users = await getApiTest().user.listUsers();
        if (users.toString().includes(user)) {
            throw new Error(`User ${user} already exists. Cannot create duplicate.`);
        }

        try {
            await getApiTest().user.create(
                user,
                password,
                user,
                user,
                'galaxy-noise@localhost'
            );
            const roles = [
                'config_admin',
                'system_group_admin',
                'activation_key_admin',
                'image_admin'
            ];
            for (const role of roles) {
                await getApiTest().user.addRole(user, role);
            }
        } catch (e) {
            // This is expected in some tests
        }
    }
);

When(/^I create a repo with label "([^"]*)" and url$/, async (label) => {
    const server = await getTarget('server');
    const url = `http://${server.fullHostname}/pub/AnotherRepo/`;
    const result = await getApiTest().channel.software.createRepo(label, url);
    expect(result).toBe(true);
});

When(
    /^I associate repo "([^"]*)" with channel "([^"]*)"$/,
    async (repoLabel, channelLabel) => {
        const result = await getApiTest().channel.software.associateRepo(
            channelLabel,
            repoLabel
        );
        expect(result).toBe(true);
    }
);

When(/^I create the following channels:$/, async (table) => {
    const channels = table.hashes();
    for (const ch of channels) {
        const result = await getApiTest().channel.software.create(
            ch['LABEL'],
            ch['NAME'],
            ch['SUMMARY'],
            ch['ARCH'],
            ch['PARENT']
        );
        expect(result).toBe(1);
    }
});

When(/^I delete the software channel with label "([^"]*)"$/, async (label) => {
    const result = await getApiTest().channel.software.delete(label);
    expect(result).toBe(1);
});

When(/^I delete the repo with label "([^"]*)"$/, async (label) => {
    const result = await getApiTest().channel.software.removeRepo(label);
    expect(result).toBe(true);
});

Then(
    /^something should get listed with a call of listSoftwareChannels$/,
    async () => {
        const count = await getApiTest().channel.getSoftwareChannelsCount();
        expect(count).toBeGreaterThan(0);
    }
);

Then(
    /^"([^"]*)" should get listed with a call of listSoftwareChannels$/,
    async (label) => {
        const result = await getApiTest().channel.verifyChannel(label);
        expect(result).toBe(true);
    }
);

Then(
    /^"([^"]*)" should not get listed with a call of listSoftwareChannels$/,
    async (label) => {
        const result = await getApiTest().channel.verifyChannel(label);
        expect(result).toBe(false);
    }
);

Then(
    /^"([^"]*)" should be the parent channel of "([^"]*)"$/,
    async (parent, child) => {
        const result = await getApiTest().channel.software.parentChannel(child, parent);
        expect(result).toBe(true);
    }
);

Then(
    /^channel "([^"]*)" should have attribute "([^"]*)" that is a date$/,
    async (label, attr) => {
        const ret = await getApiTest().channel.software.getDetails(label);
        expect(ret).not.toBeNull();
        const date = new Date(ret[attr]);
        expect(date).toBeInstanceOf(Date);
    }
);

Then(
    /^channel "([^"]*)" should not have attribute "([^"]*)"$/,
    async (label, attr) => {
        const ret = await getApiTest().channel.software.getDetails(label);
        expect(ret).not.toBeNull();
        expect(ret[attr]).toBeUndefined();
    }
);

Then(
    /^channel "([^"]*)" should be (enabled|disabled) on "([^"]*)"$/,
    async (channel, state, host) => {
        const node = await getTarget(host);
        const systemId = await getSystemId(node);
        const channels = await getApiTest().channel.software.listSystemChannels(
            systemId
        );
        expect(channels.includes(channel)).toBe(state === 'enabled');
    }
);

Then(/^"(\d+)" channels should be enabled on "([^"]*)"$/, async (count, host) => {
    const node = await getTarget(host);
    const systemId = await getSystemId(node);
    const channels = await getApiTest().channel.software.listSystemChannels(systemId);
    expect(channels.length).toBe(Number(count));
});

Then(
    /^"(\d+)" channels with prefix "([^"]*)" should be enabled on "([^"]*)"$/,
    async (count, prefix, host) => {
        const node = await getTarget(host);
        const systemId = await getSystemId(node);
        const channels = await getApiTest().channel.software.listSystemChannels(
            systemId
        );
        const filteredChannels = channels.filter((c: string) => c.startsWith(prefix));
        expect(filteredChannels.length).toBe(Number(count));
    }
);

Then(/^I should get some activation keys$/, async () => {
    const count = await getApiTest().activationkey.getActivationKeysCount();
    expect(count).toBeGreaterThan(0);
});

When(
    /^I create an activation key with id "([^"]*)", description "([^"]*)" and limit of (\d+)$/,
    async (id, dscr, limit) => {
        const key = await getApiTest().activationkey.create(id, dscr, '', Number(limit));
        expect(key).not.toBeNull();
        expect(key).toBe(`1-${id}`);
    }
);

Then(/^I should get the new activation key "([^"]*)"$/, async (activationKey) => {
    const result = await getApiTest().activationkey.verify(activationKey);
    expect(result).toBe(true);
});

When(/^I delete the activation key "([^"]*)"$/, async (activationKey) => {
    let result = await getApiTest().activationkey.delete(activationKey);
    expect(result).toBe(true);
    result = await getApiTest().activationkey.verify(activationKey);
    expect(result).toBe(false);
});

When(
    /^I set the description of the activation key "([^"]*)" to "([^"]*)"$/,
    async (activationKey, description) => {
        const result = await getApiTest().activationkey.setDetails(
            activationKey,
            description,
            '',
            10,
            'default'
        );
        expect(result).toBe(true);
    }
);

Then(
    /^I get the description "([^"]*)" for the activation key "([^"]*)"$/,
    async (description, activationKey) => {
        const details = await getApiTest().activationkey.getDetails(activationKey);
        expect(details['description']).toBe(description);
    }
);

When(
    /^I create an activation key including custom channels for "([^"]*)" via API$/,
    async (client) => {
        const id = `${client}_key`;
        const description = id;
        let clientName = client;
        if (client === 'proxy' && !envConfig.isTransactionalServer) {
            clientName = 'proxy_nontransactional';
        }
        const baseChannel = BASE_CHANNEL_BY_CLIENT[globalVars.product][clientName];
        const baseChannelLabel = LABEL_BY_BASE_CHANNEL[globalVars.product][baseChannel];
        const key = await getApiTest().activationkey.create(
            id,
            description,
            baseChannelLabel,
            100
        );
        expect(key).not.toBeNull();

        const isSshMinion = client.includes('ssh_minion');
        await getApiTest().activationkey.setDetails(
            key,
            description,
            baseChannelLabel,
            100,
            isSshMinion ? 'ssh-push' : 'default'
        );
        const entitlements = client.includes('buildhost')
            ? ['osimage_build_host']
            : [];
        if (entitlements.length > 0) {
            await getApiTest().activationkey.addEntitlements(key, entitlements);
        }

        let childChannels = await getApiTest().channel.software.listChildChannels(
            baseChannelLabel
        );

        if (client.includes('slemicro55')) {
            childChannels = childChannels.filter(
                (channel: string | string[]) =>
                    !channel.includes('suse-manager-proxy-5.0-pool-x86_64') &&
                    !channel.includes('suse-manager-proxy-5.0-updates-x86_64') &&
                    !channel.includes(
                        'suse-manager-retail-branch-server-5.0-pool-x86_64'
                    ) &&
                    !channel.includes(
                        'suse-manager-retail-branch-server-5.0-updates-x86_64'
                    )
            );
        }

        await getApiTest().activationkey.addChildChannels(key, childChannels);
    }
);

When(/^I create an action chain with label "(.*?)" via API$/, async (label) => {
    const actionId = await getApiTest().actionchain.createChain(label);
    expect(actionId).toBeGreaterThan(0);
    addContext('chainLabel', label);
});

When(
    /^I see label "(.*?)" when I list action chains via API$/,
    async (label) => {
        const chains = await getApiTest().actionchain.listChains();
        expect(chains).toContain(label);
    }
);

When(/^I delete the action chain via API$/, async () => {
    const chainLabel = getContext('chainLabel');
    if (chainLabel) {
        await getApiTest().actionchain.deleteChain(chainLabel);
    }
});

When(/^I delete an action chain, labeled "(.*?)", via API$/, async (label) => {
    await getApiTest().actionchain.deleteChain(label);
});

When(/^I delete all action chains via API$/, async () => {
    const chains = await getApiTest().actionchain.listChains();
    for (const label of chains) {
        await getApiTest().actionchain.deleteChain(label);
    }
});

Then(
    /^I rename the action chain with label "(.*?)" to "(.*?)" via API$/,
    async (oldLabel, newLabel) => {
        await getApiTest().actionchain.renameChain(oldLabel, newLabel);
    }
);

Then(
    /^there should be a new action chain with the label "(.*?)" listed via API$/,
    async (label) => {
        const chains = await getApiTest().actionchain.listChains();
        expect(chains).toContain(label);
    }
);

Then(
    /^there should be no action chain with the label "(.*?)" listed via API$/,
    async (label) => {
        const chains = await getApiTest().actionchain.listChains();
        expect(chains).not.toContain(label);
    }
);

When(
    /^I add the script "(.*?)" to the action chain via API$/,
    async (script) => {
        if (getContext('clientId') === undefined || getContext('chainLabel') === undefined) {
            throw new Error('clientId or chainLabel is not defined in context');
        }
        const result = await getApiTest().actionchain.addScriptRun(
            getContext('clientId') as number,
            getContext('chainLabel') as string,
            'root',
            'root',
            300,
            `#!/bin/bash\n${script}`
        );
        expect(result).toBeGreaterThan(0);
    }
);

Then(
    /^I should be able to see all these actions in the action chain via API$/,
    async () => {
        if (getContext('chainLabel') === undefined) {
            throw new Error('chainLabel is not defined in context');
        }
        const actions = await getApiTest().actionchain.listChainActions(getContext('chainLabel') as string);
        expect(actions).not.toBeNull();
    }
);

When(/^I add a system reboot to the action chain via API$/, async () => {
    if (getContext('clientId') === undefined || getContext('chainLabel') === undefined) {
        throw new Error('clientId or chainLabel is not defined in context');
    }
    const result = await getApiTest().actionchain.addSystemReboot(
        getContext('clientId') as number,
        getContext('chainLabel') as string
    );
    expect(result).toBeGreaterThan(0);
});

When(/^I add a package install to the action chain via API$/, async () => {
    if (getContext('clientId') === undefined || getContext('chainLabel') === undefined) {
        throw new Error('clientId or chainLabel is not defined in context');
    }
    const pkgs = await getApiTest().system.listAllInstallablePackages(getContext('clientId') as number);
    expect(pkgs).not.toBeNull();
    expect(pkgs.length).toBeGreaterThan(0);
    const result = await getApiTest().actionchain.addPackageInstall(
        getContext('clientId') as number,
        [pkgs[0]['id']],
        getContext('chainLabel') as string
    );
    expect(result).toBeGreaterThan(0);
});

When(/^I add a package removal to the action chain via API$/, async () => {
    if (getContext('clientId') === undefined || getContext('chainLabel') === undefined) {
        throw new Error('clientId or chainLabel is not defined in context');
    }
    const pkgs = await getApiTest().system.listAllInstallablePackages(getContext('clientId') as number);
    const result = await getApiTest().actionchain.addPackageRemoval(
        getContext('clientId') as number,
        [pkgs[0]['id']],
        getContext('chainLabel') as string
    );
    expect(result).toBeGreaterThan(0);
});

When(/^I add a package upgrade to the action chain via API$/, async () => {
    if (getContext('clientId') === undefined || getContext('chainLabel') === undefined) {
        throw new Error('clientId or chainLabel is not defined in context');
    }
    const pkgs = await getApiTest().system.listLatestUpgradablePackages(getContext('clientId') as number);
    expect(pkgs).not.toBeNull();
    expect(pkgs.length).toBeGreaterThan(0);
    const result = await getApiTest().actionchain.addPackageUpgrade(
        getContext('clientId') as number,
        [pkgs[0]['to_package_id']],
        getContext('chainLabel') as string
    );
    expect(result).toBeGreaterThan(0);
});

When(/^I add a package verification to the action chain via API$/, async () => {
    if (getContext('clientId') === undefined || getContext('chainLabel') === undefined) {
        throw new Error('clientId or chainLabel is not defined in context');
    }
    const pkgs = await getApiTest().system.listAllInstallablePackages(getContext('clientId') as number);
    expect(pkgs).not.toBeNull();
    expect(pkgs.length).toBeGreaterThan(0);
    const result = await getApiTest().actionchain.addPackageVerify(
        getContext('clientId') as number,
        [pkgs[0]['id']],
        getContext('chainLabel') as string
    );
    expect(result).toBeGreaterThan(0);
});

When(/^I remove each action within the chain via API$/, async () => {
    if (getContext('chainLabel') === undefined) {
        throw new Error('chainLabel is not defined in context');
    }
    const actions = await getApiTest().actionchain.listChainActions(getContext('chainLabel') as string);
    expect(actions).not.toBeNull();
    for (const action of actions) {
        const result = await getApiTest().actionchain.removeAction(
            getContext('chainLabel') as string,
            action['id']
        );
        expect(result).toBeGreaterThanOrEqual(0);
    }
});

Then(/^the current action chain should be empty$/, async () => {
    if (getContext('chainLabel') === undefined) {
        throw new Error('chainLabel is not defined in context');
    }
    const actions = await getApiTest().actionchain.listChainActions(getContext('chainLabel') as string);
    expect(actions).toHaveLength(0);
});

When(/^I schedule the action chain via API$/, async () => {
    const result = await getApiTest().actionchain.scheduleChain(
        getContext('chainLabel') as string,
        new Date().toISOString()
    );
    expect(result).toBeGreaterThanOrEqual(0);
});

When(
    /^I wait until there are no more action chains listed via API$/,
    async () => {
        await repeatUntilTimeout(async () => {
            const chains = await getApiTest().actionchain.listChains();
            return chains.length === 0;
        }, {message: 'Action Chains still present'});
    }
);

Then(
    /^I should see scheduled action, called "(.*?)", listed via API$/,
    async (label) => {
        const actions = await getApiTest().schedule.listInProgressActions();
        const names = actions.map((a: { [x: string]: any; }) => a['name']);
        expect(names).toContain(label);
    }
);

Then(/^I cancel all scheduled actions via API$/, async () => {
    const actions = (await getApiTest().schedule.listInProgressActions()).filter(
        (action: { [x: string]: any; }) => !action['prerequisite']
    );

    for (const action of actions) {
        try {
            await getApiTest().schedule.cancelActions([action['id']]);
        } catch (err) {
            const systems = await getApiTest().schedule.listInProgressSystems(
                action['id']
            );
            for (const system of systems) {
                await getApiTest().schedule.failSystemAction(
                    system['server_id'],
                    action['id']
                );
            }
        }
    }
});

Then(
    /^I wait until there are no more scheduled actions listed via API$/,
    async () => {
        await repeatUntilTimeout(async () => {
            const actions = await getApiTest().schedule.listInProgressActions();
            return actions.length === 0;
        }, {message: 'Scheduled actions still present'});
    }
);

When(/^I fetch power management values$/, async () => {
    addContext('PowerMgmtResult',
        await getApiTest().system.provisioning.powermanagement.getDetails(getContext('clientId') as number)
    );
});

Then(
    /^power management results should have "([^"]*)" for "([^"]*)"$/,
    async (value, hkey) => {
        expect(getContext('PowerMgmtResult')[hkey]).toBe(value);
    }
);

Then(
    /^I set power management value "([^"]*)" for "([^"]*)"$/,
    async (value, hkey) => {
        await getApiTest().system.provisioning.powermanagement.setDetails(
            getContext('clientId') as number,
            {[hkey]: value}
        );
    }
);

Then(/^I turn power on$/, async () => {
    await getApiTest().system.provisioning.powermanagement.powerOn(getContext('clientId') as number);
});

Then(/^I turn power off$/, async () => {
    await getApiTest().system.provisioning.powermanagement.powerOff(getContext('clientId') as number);
});

Then(/^I do power management reboot$/, async () => {
    await getApiTest().system.provisioning.powermanagement.reboot(getContext('clientId') as number);
});

Then(/^the power status is "([^"]*)"$/, async (estat) => {
    const stat = await getApiTest().system.provisioning.powermanagement.getStatus(
        getContext('clientId') as number
    );
    if (estat === 'on') {
        expect(stat).toBe(true);
    } else {
        expect(stat).toBe(false);
    }
});

When(
    /^I call audit\.list_systems_by_patch_status\(\) with CVE identifier "([^"]*)"$/,
    async (cveIdentifier) => {
        addContext('resultList',
            (await getApiTest().audit.listSystemsByPatchStatus(cveIdentifier)) || []
        );
    }
);

Then(
    /^I should get status "([^"]+)" for system "([0-9]+)"$/,
    async (status, system) => {
        const result = getContext('resultList').filter(
            (item: { [x: string]: number; }) => item['system_id'] === Number(system)
        );
        expect(result.length).toBeGreaterThan(0);
        addContext('result', result[0]);
        expect(getContext('result')['patch_status']).toBe(status);
    }
);

Then(/^I should get status "([^"]+)" for "([^"]+)"$/, async (status, host) => {
    const node = await getTarget(host);
    const systemId = await getSystemId(node);
    const result = getContext('resultList').filter(
        (item: { [x: string]: number; }) => item['system_id'] === systemId
    );
    expect(result.length).toBeGreaterThan(0);
    addContext('result', result[0]);
    expect(getContext('result')['patch_status']).toBe(status);
});

Then(/^I should get the "([^"]*)" channel label$/, async (channelLabel) => {
    expect(getContext('result')['channel_labels']).toContain(channelLabel);
});

Then(/^I should get the "([^"]*)" patch$/, async (patch) => {
    expect(getContext('result')['errata_advisories']).toContain(patch);
});

Then(/^channel "([^"]*)" should exist$/, async (channel) => {
    const result = await getApiTest().configchannel.channelExists(channel);
    expect(result).toBe(1);
});

Then(
    /^channel "([^"]*)" should contain file "([^"]*)"$/,
    async (channel, file) => {
        const result = await getApiTest().configchannel.listFiles(channel);
        const fileCount = result.filter((item: { [x: string]: any; }) => item['path'] === file).length;
        expect(fileCount).toBe(1);
    }
);

Then(
    /^"([^"]*)" should be subscribed to channel "([^"]*)"$/,
    async (host, channel) => {
        const systemName = await getSystemName(host);
        const result = await getApiTest().configchannel.listSubscribedSystems(channel);
        const systemCount = result.filter(
            async (item: { [x: string]: Promise<string>; }) => await item['name'] === systemName
        ).length;
        expect(systemCount).toBe(1);
    }
);

Then(
    /^"([^"]*)" should not be subscribed to channel "([^"]*)"$/,
    async (host, channel) => {
        const systemName = await getSystemName(host);
        const result = await getApiTest().configchannel.listSubscribedSystems(channel);
        const systemCount = result.filter(
            async (item: { [x: string]: Promise<string>; }) => await item['name'] === systemName
        ).length;
        expect(systemCount).toBe(0);
    }
);

When(/^I create state channel "([^"]*)" via API$/, async (channel) => {
    await getApiTest().configchannel.create(channel, channel, channel, 'state');
});

When(
    /^I create state channel "([^"]*)" containing "([^"]*)" via API$/,
    async (channel, contents) => {
        await getApiTest().configchannel.createWithPathInfo(
            channel,
            channel,
            channel,
            'state',
            {contents: contents}
        );
    }
);

When(
    /^I call configchannel\.get_file_revision\(\) with file "([^"]*)", revision "([^"]*)" and channel "([^"]*)" via API$/,
    async (filePath, revision, channel) => {
        addContext('fileRevisionResult', (
            await getApiTest().configchannel.getFileRevision(
                channel,
                filePath,
                Number(revision)
            )
        ));
    }
);

Then(/^I should get file contents "([^"]*)"$/, async (contents) => {
    expect(getContext('fileRevisionResult')['contents']).toBe(contents);
});

When(
    /^I add file "([^"]*)" containing "([^"]*)" to channel "([^"]*)"$/,
    async (file, contents, channel) => {
        await getApiTest().configchannel.createOrUpdatePath(channel, file, contents);
    }
);

When(
    /^I deploy all systems registered to channel "([^"]*)"$/,
    async (channel) => {
        await getApiTest().configchannel.deployAllSystems(channel);
    }
);

When(
    /^I delete channel "([^"]*)" via API((?: without error control)?)$/,
    async (channel, errorControl) => {
        try {
            await getApiTest().configchannel.deleteChannels([channel]);
        } catch (err) {
            if (errorControl.trim() === '') {
                throw new Error('Error deleting channel');
            }
        }
    }
);

When(
    /^I call system.create_system_profile\(\) with name "([^"]*)" and HW address "([^"]*)"$/,
    async (name, hwAddress) => {
        const profileId = await getApiTest().system.createSystemProfile(name, hwAddress);
        expect(profileId).not.toBeNull();
    }
);

When(
    /^I call system\.create_system_profile\(\) with name "([^"]*)" and hostname "([^"]*)"$/,
    async (name, hostname) => {
        const profileId = await getApiTest().system.createSystemProfile(name, hostname);
        expect(profileId).not.toBeNull();
    }
);

When(/^I call system\.list_empty_system_profiles\(\)$/, async () => {
    addContext('output', await getApiTest().system.listEmptySystemProfiles());
});

Then(/^"([^"]*)" should be present in the result$/, async (profileName) => {
    const count = getContext('output').filter((p: { [x: string]: any; }) => p['name'] === profileName).length;
    expect(count).toBe(1);
});

When(
    /^I create and modify the kickstart system "([^"]*)" with kickstart label "([^"]*)" and hostname "([^"]*)" via XML-RPC$/,
    async (name, kslabel, hostname, table) => {
        const sid = await getApiTest().system.createSystemProfile(name, hostname);
        await getApiTest().system.createSystemRecordWithSid(sid, kslabel);
        const variables = table.rowsHash();
        await getApiTest().system.setVariables(sid, variables);
    }
);

When(/^I create "([^"]*)" kickstart tree via the API$/, async (distroName) => {
    switch (distroName) {
        case 'fedora_kickstart_distro_api':
            await getApiTest().kickstart.tree.createDistro(
                distroName,
                '/var/autoinstall/Fedora_12_i386/',
                'fake-base-channel-rh-like',
                'fedora18'
            );
            break;
        case 'testdistro':
            await getApiTest().kickstart.tree.createDistro(
                distroName,
                '/var/autoinstall/SLES15-SP4-x86_64/DVD1/',
                'sle-product-sles15-sp4-pool-x86_64',
                'sles15generic'
            );
            break;
        default:
            throw new Error(`Unrecognized value: ${distroName}`);
    }
});

When(
    /^I create a "([^"]*)" profile via the API using import file for "([^"]*)" distribution$/,
    async (profileName, distroName) => {
        const canonicalPath =
            'testsuite/upload_files/autoinstall/cobbler/mock/empty.xml';
        await getApiTest().kickstart.createProfileUsingImportFile(
            profileName,
            distroName,
            canonicalPath
        );
    }
);

When(/^I create a kickstart tree with kernel options via the API$/, async () => {
    await getApiTest().kickstart.tree.createDistroWithKernelOptions(
        'fedora_kickstart_distro_kernel_api',
        '/var/autoinstall/Fedora_12_i386/',
        'fake-base-channel-rh-like',
        'fedora18',
        'self_update=0',
        'self_update=1'
    );
});

When(/^I update a kickstart tree via the API$/, async () => {
    await getApiTest().kickstart.tree.updateDistro(
        'fedora_kickstart_distro_api',
        '/var/autoinstall/Fedora_12_i386/',
        'fake-base-channel-rh-like',
        'generic_rpm',
        'self_update=0',
        'self_update=1'
    );
});

When(
    /^I delete profile and distribution using the API for "([^"]*)" kickstart tree$/,
    async (distroName) => {
        await getApiTest().kickstart.tree.deleteTreeAndProfiles(distroName);
    }
);

When(
    /I verify channel "([^"]*)" is( not)? modular via the API/,
    async (channelLabel, notModular) => {
        const isModular = await getApiTest().channel.appstreams.isModular(channelLabel);
        const expected = notModular === undefined;
        expect(isModular).toBe(expected);
    }
);

When(
    /channel "([^"]*)" is( not)? present in the modular channels listed via the API/,
    async (channel, notPresent) => {
        const modularChannels = await getApiTest().channel.appstreams.listModularChannels();
        const isPresent = modularChannels.includes(channel);
        const expected = notPresent === undefined;
        expect(isPresent).toBe(expected);
    }
);

When(
    /"([^"]*)" module streams "([^"]*)" are available for channel "([^"]*)" via the API/,
    async (moduleName, streams, channelLabel) => {
        const expectedStreams = streams.split(',').map((s: { strip: () => any; }) => s.strip());
        const availableStreams = await getApiTest().channel.appstreams.listModuleStreams(
            channelLabel
        );

        for (const expectedStream of expectedStreams) {
            const found = availableStreams.some(
                (stream: { [x: string]: any; }) =>
                    stream['module'] === moduleName && stream['stream'] === expectedStream
            );
            expect(found).toBe(true);
        }
    }
);
