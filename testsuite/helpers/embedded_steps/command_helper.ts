import {
    getTarget,
    repeatUntilTimeout,
    fileExists,
    isRhHost,
    isSuseHost,
    isTransactionalSystem,
    getSystemName
} from '../index.js';

export async function waitUntilFileExists(seconds: string, file: string, host: string) {
    const node = await getTarget(host);
    await repeatUntilTimeout(
        async () => {
            return await fileExists(node, file);
        },
        { timeout: parseInt(seconds, 10) }
    );
}

export async function installPackages(packageList: string, host: string, error_control: string) {
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

    const { stdout, returnCode } = await node.run(cmd, { checkErrors: false, successCodes: successcodes });
    if (checkErrors && returnCode !== 0) {
        throw new Error(`Command failed with return code ${returnCode}`);
    }
    if (stdout.includes(notFoundMsg)) {
        throw new Error(`A package was not found. Output:\n ${stdout}`);
    }
}

export async function removePackages(packageList: string, host: string, error_control: string) {
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
    await node.run(cmd, { checkErrors: checkErrors, successCodes: successcodes });
}

export async function waitUntilServiceInactive(service: string, host: string) {
    const node = await getTarget(host);
    const cmd = `systemctl is-active ${service}`;
    await node.runUntilFail(cmd);
}

export async function manageRepositories(action: string, repos: string, host: string, error_control: string) {
    const node = await getTarget(host);
    const checkErrors = error_control === '';
    let cmd: string;
    const repoList = repos.split(' ');

    if (await isSuseHost(host)) {
        const commandRepos = repoList.map(repo => ` ${repo}`).join('');
        cmd = `zypper mr --${action}${commandRepos}`;
    } else if (await isRhHost(host)) {
        cmd = repoList.map(repo => {
            const enabledValue = action === 'enable' ? 1 : 0;
            return `sed -i 's/enabled=.*/enabled=${enabledValue}/g' /etc/yum.repos.d/${repo}.repo`;
        }).join(' && ');
    } else {
        cmd = repoList.map(repo => {
            if (action === 'enable') {
                return `sed -i '/^#\\s*deb.*/ s/^#\\s*deb /deb /' /etc/apt/sources.list.d/${repo}.list`;
            } else {
                return `sed -i '/^deb.*/ s/^deb /# deb /' /etc/apt/sources.list.d/${repo}.list`;
            }
        }).join(' && ');
    }
    await node.run(cmd, { verbose: true, checkErrors });
}

export async function installSaltPillarTopFile(files: string, host: string) {
    const server = await getTarget('server');
    const systemName = host === '*' ? '*' : await getSystemName(host);
    let script = 'base:\n';
    if (systemName === '*') {
        script += '  \'*\':\n';
    } else {
        script += `  '${systemName}':\n`;
    }
    files.split(', ').forEach((file: string) => {
        script += `    - '${file}'\n`;
    });
    // file injection not possible
    throw new Error('This step requires file injection which cannot be performed.');
}
