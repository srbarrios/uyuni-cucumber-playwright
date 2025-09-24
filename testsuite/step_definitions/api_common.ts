import { Given, When, Then } from '@cucumber/cucumber';
import { expect } from 'chai';
import {
    ApiTest,
    getSystemName,
    getSystemId,
    getClientId,
    setClientId,
    getChainLabel,
    setChainLabel,
    getPowerMgmtResult,
    setPowerMgmtResult,
    setUsers,
    getUsers,
    setRoles,
    getRoles,
    setGetFileRevisionResult,
    getGetFileRevisionResult,
    setOutput,
    getOutput,
    setResultList,
    getResultList,
    setResult,
    getResult,
    repeatUntilTimeout,
    dateNow,
    getSleId,
    setSleId,
    product,
    isTransactionalServer
} from '../helpers';
import { getTarget } from '../helpers';
import {
    BASE_CHANNEL_BY_CLIENT,
    LABEL_BY_BASE_CHANNEL
} from '../helpers/core/constants';

Given(/^I want to operate on this "([^"]*)"$/, async function (host) {
    const systemName = getSystemName(host);
    const systems = await ApiTest.system.searchByName(systemName);
    const firstMatch = systems[0];
    if (firstMatch) {
        setClientId(firstMatch['id']);
    }
    expect(getClientId()).to.not.be.null;
});

When(
    /^I call system\.bootstrap\(\) on host "([^"]*)" and salt-ssh "([^"]*)"$/,
    async (host, saltSshEnabled) => {
        const systemName = getSystemName(host);
        const saltSsh = saltSshEnabled === 'enabled';
        const akey = saltSsh ? '1-SUSE-SSH-KEY-x86_64' : '1-SUSE-KEY-x86_64';
        const result = await apiTest.system.bootstrapSystem(
            systemName,
            akey,
            saltSsh
        );
        expect(result).to.equal(1);
    }
);

When(
    /^I call system\.bootstrap\(\) on unknown host, I should get an API fault$/,
    async () => {
        let exceptionThrown = false;
        try {
            await apiTest.system.bootstrapSystem('imprettysureidontexist', '', false);
        } catch (err) {
            exceptionThrown = true;
        }
        expect(exceptionThrown).to.be.true;
    }
);

When(
    /^I call system\.bootstrap\(\) on a Salt minion with saltSSH = true, but with activation key with default contact method, I should get an API fault$/,
    async () => {
        let exceptionThrown = false;
        try {
            const target = await getTarget('sle_minion');
            await apiTest.system.bootstrapSystem(
                target.fullHostname,
                '1-SUSE-KEY-x86_64',
                true
            );
        } catch (err) {
            exceptionThrown = true;
        }
        expect(exceptionThrown).to.be.true;
    }
);

When(/^I schedule a highstate for "([^"]*)" via API$/, async (host) => {
    const systemName = getSystemName(host);
    const nodeId = await apiTest.system.retrieveServerId(systemName);
    const dateHigh = dateNow();
    await apiTest.system.scheduleApplyHighstate(nodeId, dateHigh, false);
});

When(
    /^I unsubscribe "([^"]*)" from configuration channel "([^"]*)"$/,
    async (host1, channel) => {
        const systemName1 = getSystemName(host1);
        const nodeId1 = await apiTest.system.retrieveServerId(systemName1);
        await apiTest.system.config.removeChannels([nodeId1], [channel]);
    }
);

When(/^I create a system record$/, async () => {
    const dev = {
        name: 'eth0',
        ip: '1.1.1.1',
        mac: '00:22:22:77:EE:CC',
        dnsname: 'testserver.example.com'
    };
    await apiTest.system.createSystemRecord(
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
        await apiTest.system.createSystemRecord(name, label, '', 'my test server', [
            dev
        ]);
    }
);

When(/^I wait for the OpenSCAP audit to finish$/, async () => {
    const target = await getTarget('sle_minion');
    setSleId(await apiTest.system.retrieveServerId(target.fullHostname));

    await repeatUntilTimeout(async () => {
        const scans = await apiTest.system.scap.listXccdfScans(getSleId());
        return scans.length > 1;
    }, 'Process did not complete');
});

When(/^I retrieve the relevant errata for (.+)$/, async (rawHosts) => {
    const hosts = rawHosts.split(',').map((h: { strip: () => any; }) => h.strip());
    const sids = [];

    for (const host of hosts) {
        const node = await getTarget(host);
        sids.push(await getSystemId(node));
    }
    if (sids.length === 1) {
        await apiTest.system.getSystemErrata(sids[0]);
    } else {
        await apiTest.system.getSystemsErrata(sids);
    }
});

When(/^I call user\.list_users\(\)$/, async () => {
    setUsers(await apiTest.user.listUsers());
});

Then(/^I should get at least user "([^"]*)"$/, async (user) => {
    const logins = getUsers().map((u: { [x: string]: any; }) => u['login']);
    expect(logins).to.include(user);
});

When(/^I call user\.list_roles\(\) on user "([^"]*)"$/, async (user) => {
    setRoles(await apiTest.user.listRoles(user));
});

Then(
    /^I should get at least one role that matches "([^"]*)" suffix$/,
    async (suffix) => {
        const matchingRoles = getRoles().filter((el: string) => el.match(`/${suffix}/`));
        expect(matchingRoles).to.not.be.empty;
    }
);

Then(/^I should get role "([^"]*)"$/, async (rolename) => {
    expect(getRoles()).to.include(rolename);
});

Then(/^I should not get role "([^"]*)"$/, async (rolename) => {
    expect(getRoles()).to.not.include(rolename);
});

When(/^I call user\.create\(\) with login "([^"]*)"$/, async (user) => {
    const result = await apiTest.user.create(
        user,
        'JamesBond007',
        'Hans',
        'Mustermann',
        'hans.mustermann@suse.com'
    );
    expect(result).to.equal(1);
});

When(
    /^I call user\.add_role\(\) on "([^"]*)" with the role "([^"]*)"$/,
    async (user, role) => {
        const result = await apiTest.user.addRole(user, role);
        expect(result).to.equal(1);
    }
);

When(/^I delete user "([^"]*)"$/, async (user) => {
    await apiTest.user.delete(user);
});

When(/^I make sure "([^"]*)" is not present$/, async (user) => {
    const users = await apiTest.user.listUsers();
    const userLogins = users.map((u: { [x: string]: any; }) => u['login']);
    if (userLogins.includes(user)) {
        await apiTest.user.delete(user);
    }
});

When(
    /^I call user\.remove_role\(\) on "([^"]*)" with the role "([^"]*)"$/,
    async (luser, rolename) => {
        const result = await apiTest.user.removeRole(luser, rolename);
        expect(result).to.equal(1);
    }
);

Given(
    /^I create a user with name "([^"]*)" and password "([^"]*)"/,
    async (user, password) => {
        const users = await apiTest.user.listUsers();
        if (users.toString().includes(user)) {
            return;
        }

        await apiTest.user.create(
            user,
            password,
            user,
            user,
            'galaxy-noise@localhost'
        );
        const roles = [
            'org_admin',
            'channel_admin',
            'config_admin',
            'system_group_admin',
            'activation_key_admin',
            'image_admin'
        ];
        for (const role of roles) {
            await apiTest.user.addRole(user, role);
        }
    }
);

Given(
    /^I attempt to create a user with username "([^"]*)" and password "([^"]*)"/,
    async (user, password) => {
        const users = await apiTest.user.listUsers();
        if (users.toString().includes(user)) {
            throw new Error(`User ${user} already exists. Cannot create duplicate.`);
        }

        try {
            await apiTest.user.create(
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
                await apiTest.user.addRole(user, role);
            }
        } catch (e) {
            // This is expected in some tests
        }
    }
);

When(/^I create a repo with label "([^"]*)" and url$/, async (label) => {
    const server = await getTarget('server');
    const url = `http://${server.fullHostname}/pub/AnotherRepo/`;
    const result = await apiTest.channel.software.createRepo(label, url);
    expect(result).to.be.true;
});

When(
    /^I associate repo "([^"]*)" with channel "([^"]*)"$/,
    async (repoLabel, channelLabel) => {
        const result = await apiTest.channel.software.associateRepo(
            channelLabel,
            repoLabel
        );
        expect(result).to.be.true;
    }
);

When(/^I create the following channels:$/, async (table) => {
    const channels = table.hashes();
    for (const ch of channels) {
        const result = await apiTest.channel.software.create(
            ch['LABEL'],
            ch['NAME'],
            ch['SUMMARY'],
            ch['ARCH'],
            ch['PARENT']
        );
        expect(result).to.equal(1);
    }
});

When(/^I delete the software channel with label "([^"]*)"$/, async (label) => {
    const result = await apiTest.channel.software.delete(label);
    expect(result).to.equal(1);
});

When(/^I delete the repo with label "([^"]*)"$/, async (label) => {
    const result = await apiTest.channel.software.removeRepo(label);
    expect(result).to.be.true;
});

Then(
    /^something should get listed with a call of listSoftwareChannels$/,
    async () => {
        const count = await apiTest.channel.getSoftwareChannelsCount();
        expect(count).to.be.greaterThan(0);
    }
);

Then(
    /^"([^"]*)" should get listed with a call of listSoftwareChannels$/,
    async (label) => {
        const result = await apiTest.channel.verifyChannel(label);
        expect(result).to.be.true;
    }
);

Then(
    /^"([^"]*)" should not get listed with a call of listSoftwareChannels$/,
    async (label) => {
        const result = await apiTest.channel.verifyChannel(label);
        expect(result).to.be.false;
    }
);

Then(
    /^"([^"]*)" should be the parent channel of "([^"]*)"$/,
    async (parent, child) => {
        const result = await apiTest.channel.software.parentChannel(child, parent);
        expect(result).to.be.true;
    }
);

Then(
    /^channel "([^"]*)" should have attribute "([^"]*)" that is a date$/,
    async (label, attr) => {
        const ret = await apiTest.channel.software.getDetails(label);
        expect(ret).to.not.be.null;
        const date = new Date(ret[attr]);
        expect(date).to.be.a('date');
    }
);

Then(
    /^channel "([^"]*)" should not have attribute "([^"]*)"$/,
    async (label, attr) => {
        const ret = await apiTest.channel.software.getDetails(label);
        expect(ret).to.not.be.null;
        expect(ret).to.not.have.property(attr);
    }
);

Then(
    /^channel "([^"]*)" should be (enabled|disabled) on "([^"]*)"$/,
    async (channel, state, host) => {
        const node = await getTarget(host);
        const systemId = await getSystemId(node);
        const channels = await apiTest.channel.software.listSystemChannels(
            systemId
        );
        expect(channels.includes(channel)).to.equal(state === 'enabled');
    }
);

Then(/^"(\d+)" channels should be enabled on "([^"]*)"$/, async (count, host) => {
    const node = await getTarget(host);
    const systemId = await getSystemId(node);
    const channels = await apiTest.channel.software.listSystemChannels(systemId);
    expect(channels.length).to.equal(Number(count));
});

Then(
    /^"(\d+)" channels with prefix "([^"]*)" should be enabled on "([^"]*)"$/,
    async (count, prefix, host) => {
        const node = await getTarget(host);
        const systemId = await getSystemId(node);
        const channels = await apiTest.channel.software.listSystemChannels(
            systemId
        );
        const filteredChannels = channels.filter((c: string) => c.startsWith(prefix));
        expect(filteredChannels.length).to.equal(Number(count));
    }
);

Then(/^I should get some activation keys$/, async () => {
    const count = await apiTest.activationkey.getActivationKeysCount();
    expect(count).to.be.greaterThan(0);
});

When(
    /^I create an activation key with id "([^"]*)", description "([^"]*)" and limit of (\d+)$/,
    async (id, dscr, limit) => {
        const key = await apiTest.activationkey.create(id, dscr, '', Number(limit));
        expect(key).to.not.be.null;
        expect(key).to.equal(`1-${id}`);
    }
);

Then(/^I should get the new activation key "([^"]*)"$/, async (activationKey) => {
    const result = await apiTest.activationkey.verify(activationKey);
    expect(result).to.be.true;
});

When(/^I delete the activation key "([^"]*)"$/, async (activationKey) => {
    let result = await apiTest.activationkey.delete(activationKey);
    expect(result).to.be.true;
    result = await apiTest.activationkey.verify(activationKey);
    expect(result).to.be.false;
});

When(
    /^I set the description of the activation key "([^"]*)" to "([^"]*)"$/,
    async (activationKey, description) => {
        const result = await apiTest.activationkey.setDetails(
            activationKey,
            description,
            '',
            10,
            'default'
        );
        expect(result).to.be.true;
    }
);

Then(
    /^I get the description "([^"]*)" for the activation key "([^"]*)"$/,
    async (description, activationKey) => {
        const details = await apiTest.activationkey.getDetails(activationKey);
        expect(details['description']).to.equal(description);
    }
);

When(
    /^I create an activation key including custom channels for "([^"]*)" via API$/,
    async (client) => {
        const id = `${client}_key`;
        const description = id;
        let clientName = client;
        if (client === 'proxy' && !isTransactionalServer) {
            clientName = 'proxy_nontransactional';
        }
        const baseChannel = BASE_CHANNEL_BY_CLIENT[product][clientName];
        const baseChannelLabel = LABEL_BY_BASE_CHANNEL[product][baseChannel];
        const key = await apiTest.activationkey.create(
            id,
            description,
            baseChannelLabel,
            100
        );
        expect(key).to.not.be.null;

        const isSshMinion = client.includes('ssh_minion');
        await apiTest.activationkey.setDetails(
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
            await apiTest.activationkey.setEntitlement(key, entitlements);
        }

        let childChannels = await apiTest.channel.software.listChildChannels(
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

        await apiTest.activationkey.addChildChannels(key, childChannels);
    }
);

When(/^I create an action chain with label "(.*?)" via API$/, async (label) => {
    const actionId = await apiTest.actionchain.createChain(label);
    expect(actionId).to.be.greaterThan(0);
    setChainLabel(label);
});

When(
    /^I see label "(.*?)" when I list action chains via API$/,
    async (label) => {
        const chains = await apiTest.actionchain.listChains();
        expect(chains).to.include(label);
    }
);

When(/^I delete the action chain via API$/, async () => {
    await apiTest.actionchain.deleteChain(getChainLabel());
});

When(/^I delete an action chain, labeled "(.*?)", via API$/, async (label) => {
    await apiTest.actionchain.deleteChain(label);
});

When(/^I delete all action chains via API$/, async () => {
    const chains = await apiTest.actionchain.listChains();
    for (const label of chains) {
        await apiTest.actionchain.deleteChain(label);
    }
});

Then(
    /^I rename the action chain with label "(.*?)" to "(.*?)" via API$/,
    async (oldLabel, newLabel) => {
        await apiTest.actionchain.renameChain(oldLabel, newLabel);
    }
);

Then(
    /^there should be a new action chain with the label "(.*?)" listed via API$/,
    async (label) => {
        const chains = await apiTest.actionchain.listChains();
        expect(chains).to.include(label);
    }
);

Then(
    /^there should be no action chain with the label "(.*?)" listed via API$/,
    async (label) => {
        const chains = await apiTest.actionchain.listChains();
        expect(chains).to.not.include(label);
    }
);

When(
    /^I add the script "(.*?)" to the action chain via API$/,
    async (script) => {
        const result = await apiTest.actionchain.addScriptRun(
            getClientId(),
            getChainLabel(),
            'root',
            'root',
            300,
            `#!/bin/bash\n${script}`
        );
        expect(result).to.be.greaterThan(0);
    }
);

Then(
    /^I should be able to see all these actions in the action chain via API$/,
    async () => {
        const actions = await apiTest.actionchain.listChainActions(getChainLabel());
        expect(actions).to.not.be.null;
    }
);

When(/^I add a system reboot to the action chain via API$/, async () => {
    const result = await apiTest.actionchain.addSystemReboot(
        getClientId(),
        getChainLabel()
    );
    expect(result).to.be.greaterThan(0);
});

When(/^I add a package install to the action chain via API$/, async () => {
    const pkgs = await apiTest.system.listAllInstallablePackages(getClientId());
    expect(pkgs).to.not.be.null;
    expect(pkgs).to.not.be.empty;
    const result = await apiTest.actionchain.addPackageInstall(
        getClientId(),
        [pkgs[0]['id']],
        getChainLabel()
    );
    expect(result).to.be.greaterThan(0);
});

When(/^I add a package removal to the action chain via API$/, async () => {
    const pkgs = await apiTest.system.listAllInstallablePackages(getClientId());
    const result = await apiTest.actionchain.addPackageRemoval(
        getClientId(),
        [pkgs[0]['id']],
        getChainLabel()
    );
    expect(result).to.be.greaterThan(0);
});

When(/^I add a package upgrade to the action chain via API$/, async () => {
    const pkgs = await apiTest.system.listLatestUpgradablePackages(getClientId());
    expect(pkgs).to.not.be.null;
    expect(pkgs).to.not.be.empty;
    const result = await apiTest.actionchain.addPackageUpgrade(
        getClientId(),
        [pkgs[0]['to_package_id']],
        getChainLabel()
    );
    expect(result).to.be.greaterThan(0);
});

When(/^I add a package verification to the action chain via API$/, async () => {
    const pkgs = await apiTest.system.listAllInstallablePackages(getClientId());
    expect(pkgs).to.not.be.null;
    expect(pkgs).to.not.be.empty;
    const result = await apiTest.actionchain.addPackageVerify(
        getClientId(),
        [pkgs[0]['id']],
        getChainLabel()
    );
    expect(result).to.be.greaterThan(0);
});

When(/^I remove each action within the chain via API$/, async () => {
    const actions = await apiTest.actionchain.listChainActions(getChainLabel());
    expect(actions).to.not.be.null;
    for (const action of actions) {
        const result = await apiTest.actionchain.removeAction(
            getChainLabel(),
            action['id']
        );
        expect(result).to.not.be.lessThan(0);
    }
});

Then(/^the current action chain should be empty$/, async () => {
    const actions = await apiTest.actionchain.listChainActions(getChainLabel());
    expect(actions).to.be.empty;
});

When(/^I schedule the action chain via API$/, async () => {
    const result = await apiTest.actionchain.scheduleChain(
        getChainLabel(),
        new Date()
    );
    expect(result).to.not.be.lessThan(0);
});

When(
    /^I wait until there are no more action chains listed via API$/,
    async () => {
        await repeatUntilTimeout(async () => {
            const chains = await apiTest.actionchain.listChains();
            return chains.length === 0;
        }, 'Action Chains still present');
    }
);

Then(
    /^I should see scheduled action, called "(.*?)", listed via API$/,
    async (label) => {
        const actions = await apiTest.schedule.listInProgressActions();
        const names = actions.map((a: { [x: string]: any; }) => a['name']);
        expect(names).to.include(label);
    }
);

Then(/^I cancel all scheduled actions via API$/, async () => {
    const actions = (await apiTest.schedule.listInProgressActions()).filter(
        (action: { [x: string]: any; }) => !action['prerequisite']
    );

    for (const action of actions) {
        try {
            await apiTest.schedule.cancelActions([action['id']]);
        } catch (err) {
            const systems = await apiTest.schedule.listInProgressSystems(
                action['id']
            );
            for (const system of systems) {
                await apiTest.schedule.failSystemAction(
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
            const actions = await apiTest.schedule.listInProgressActions();
            return actions.length === 0;
        }, 'Scheduled actions still present');
    }
);

When(/^I fetch power management values$/, async () => {
    setPowerMgmtResult(
        await apiTest.system.provisioning.powermanagement.getDetails(getClientId())
    );
});

Then(
    /^power management results should have "([^"]*)" for "([^"]*)"$/,
    async (value, hkey) => {
        expect(getPowerMgmtResult()[hkey]).to.equal(value);
    }
);

Then(
    /^I set power management value "([^"]*)" for "([^"]*)"$/,
    async (value, hkey) => {
        await apiTest.system.provisioning.powermanagement.setDetails(
            getClientId(),
            { [hkey]: value }
        );
    }
);

Then(/^I turn power on$/, async () => {
    await apiTest.system.provisioning.powermanagement.powerOn(getClientId());
});

Then(/^I turn power off$/, async () => {
    await apiTest.system.provisioning.powermanagement.powerOff(getClientId());
});

Then(/^I do power management reboot$/, async () => {
    await apiTest.system.provisioning.powermanagement.reboot(getClientId());
});

Then(/^the power status is "([^"]*)"$/, async (estat) => {
    const stat = await apiTest.system.provisioning.powermanagement.getStatus(
        getClientId()
    );
    if (estat === 'on') {
        expect(stat).to.be.true;
    } else {
        expect(stat).to.be.false;
    }
});

When(
    /^I call audit\.list_systems_by_patch_status\(\) with CVE identifier "([^"]*)"$/,
    async (cveIdentifier) => {
        setResultList(
            (await apiTest.audit.listSystemsByPatchStatus(cveIdentifier)) || []
        );
    }
);

Then(
    /^I should get status "([^"]+)" for system "([0-9]+)"$/,
    async (status, system) => {
        const result = getResultList().filter(
            (item: { [x: string]: number; }) => item['system_id'] === Number(system)
        );
        expect(result).to.not.be.empty;
        setResult(result[0]);
        expect(getResult()['patch_status']).to.equal(status);
    }
);

Then(/^I should get status "([^"]+)" for "([^"]+)"$/, async (status, host) => {
    const node = await getTarget(host);
    const systemId = await getSystemId(node);
    const result = getResultList().filter(
        (item: { [x: string]: number; }) => item['system_id'] === systemId
    );
    expect(result).to.not.be.empty;
    setResult(result[0]);
    expect(getResult()['patch_status']).to.equal(status);
});

Then(/^I should get the "([^"]*)" channel label$/, async (channelLabel) => {
    expect(getResult()['channel_labels']).to.include(channelLabel);
});

Then(/^I should get the "([^"]*)" patch$/, async (patch) => {
    expect(getResult()['errata_advisories']).to.include(patch);
});

Then(/^channel "([^"]*)" should exist$/, async (channel) => {
    const result = await apiTest.configchannel.channelExists(channel);
    expect(result).to.equal(1);
});

Then(
    /^channel "([^"]*)" should contain file "([^"]*)"$/,
    async (channel, file) => {
        const result = await apiTest.configchannel.listFiles(channel);
        const fileCount = result.filter((item: { [x: string]: any; }) => item['path'] === file).length;
        expect(fileCount).to.equal(1);
    }
);

Then(
    /^"([^"]*)" should be subscribed to channel "([^"]*)"$/,
    async (host, channel) => {
        const systemName = getSystemName(host);
        const result = await apiTest.configchannel.listSubscribedSystems(channel);
        const systemCount = result.filter(
            (item: { [x: string]: Promise<string>; }) => item['name'] === systemName
        ).length;
        expect(systemCount).to.equal(1);
    }
);

Then(
    /^"([^"]*)" should not be subscribed to channel "([^"]*)"$/,
    async (host, channel) => {
        const systemName = getSystemName(host);
        const result = await apiTest.configchannel.listSubscribedSystems(channel);
        const systemCount = result.filter(
            (item: { [x: string]: Promise<string>; }) => item['name'] === systemName
        ).length;
        expect(systemCount).to.equal(0);
    }
);

When(/^I create state channel "([^"]*)" via API$/, async (channel) => {
    await apiTest.configchannel.create(channel, channel, channel, 'state');
});

When(
    /^I create state channel "([^"]*)" containing "([^"]*)" via API$/,
    async (channel, contents) => {
        await apiTest.configchannel.createWithPathinfo(
            channel,
            channel,
            channel,
            'state',
            { contents: contents }
        );
    }
);

When(
    /^I call configchannel\.get_file_revision\(\) with file "([^"]*)", revision "([^"]*)" and channel "([^"]*)" via API$/,
    async (filePath, revision, channel) => {
        setGetFileRevisionResult(
            await apiTest.configchannel.getFileRevision(
                channel,
                filePath,
                Number(revision)
            )
        );
    }
);

Then(/^I should get file contents "([^"]*)"$/, async (contents) => {
    expect(getGetFileRevisionResult()['contents']).to.equal(contents);
});

When(
    /^I add file "([^"]*)" containing "([^"]*)" to channel "([^"]*)"$/,
    async (file, contents, channel) => {
        await apiTest.configchannel.createOrUpdatePath(channel, file, {
            contents: contents
        });
    }
);

When(
    /^I deploy all systems registered to channel "([^"]*)"$/,
    async (channel) => {
        await apiTest.configchannel.deployAllSystems(channel);
    }
);

When(
    /^I delete channel "([^"]*)" via API((?: without error control)?)$/,
    async (channel, errorControl) => {
        try {
            await apiTest.configchannel.deleteChannels([channel]);
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
        const profileId = await apiTest.system.createSystemProfile(name, {
            hwAddress: hwAddress
        });
        expect(profileId).to.not.be.null;
    }
);

When(
    /^I call system\.create_system_profile\(\) with name "([^"]*)" and hostname "([^"]*)"$/,
    async (name, hostname) => {
        const profileId = await apiTest.system.createSystemProfile(name, {
            hostname: hostname
        });
        expect(profileId).to.not.be.null;
    }
);

When(/^I call system\.list_empty_system_profiles\(\)$/, async () => {
    setOutput(await apiTest.system.listEmptySystemProfiles());
});

Then(/^"([^"]*)" should be present in the result$/, async (profileName) => {
    const count = getOutput().filter((p: { [x: string]: any; }) => p['name'] === profileName).length;
    expect(count).to.equal(1);
});

When(
    /^I create and modify the kickstart system "([^"]*)" with kickstart label "([^"]*)" and hostname "([^"]*)" via XML-RPC$/,
    async (name, kslabel, hostname, table) => {
        const sid = await apiTest.system.createSystemProfile(name, {
            hostname: hostname
        });
        await apiTest.system.createSystemRecordWithSid(sid, kslabel);
        const variables = table.rowsHash();
        await apiTest.system.setVariables(sid, variables);
    }
);

When(/^I create "([^"]*)" kickstart tree via the API$/, async (distroName) => {
    switch (distroName) {
        case 'fedora_kickstart_distro_api':
            await apiTest.kickstart.tree.createDistro(
                distroName,
                '/var/autoinstall/Fedora_12_i386/',
                'fake-base-channel-rh-like',
                'fedora18'
            );
            break;
        case 'testdistro':
            await apiTest.kickstart.tree.createDistro(
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
        await apiTest.kickstart.createProfileUsingImportFile(
            profileName,
            distroName,
            canonicalPath
        );
    }
);

When(/^I create a kickstart tree with kernel options via the API$/, async () => {
    await apiTest.kickstart.tree.createDistroWKernelOptions(
        'fedora_kickstart_distro_kernel_api',
        '/var/autoinstall/Fedora_12_i386/',
        'fake-base-channel-rh-like',
        'fedora18',
        'self_update=0',
        'self_update=1'
    );
});

When(/^I update a kickstart tree via the API$/, async () => {
    await apiTest.kickstart.tree.updateDistro(
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
        await apiTest.kickstart.tree.deleteTreeAndProfiles(distroName);
    }
);

When(
    /I verify channel "([^"]*)" is( not)? modular via the API/,
    async (channelLabel, notModular) => {
        const isModular = await apiTest.channel.appstreams.isModular(channelLabel);
        const expected = notModular === undefined;
        expect(isModular).to.equal(expected);
    }
);

When(
    /channel "([^"]*)" is( not)? present in the modular channels listed via the API/,
    async (channel, notPresent) => {
        const modularChannels = await apiTest.channel.appstreams.listModularChannels();
        const isPresent = modularChannels.includes(channel);
        const expected = notPresent === undefined;
        expect(isPresent).to.equal(expected);
    }
);

When(
    /"([^"]*)" module streams "([^"]*)" are available for channel "([^"]*)" via the API/,
    async (moduleName, streams, channelLabel) => {
        const expectedStreams = streams.split(',').map((s: { strip: () => any; }) => s.strip());
        const availableStreams = await apiTest.channel.appstreams.listModuleStreams(
            channelLabel
        );

        for (const expectedStream of expectedStreams) {
            const found = availableStreams.some(
                (stream: { [x: string]: any; }) =>
                    stream['module'] === moduleName && stream['stream'] === expectedStream
            );
            expect(found).to.be.true;
        }
    }
);