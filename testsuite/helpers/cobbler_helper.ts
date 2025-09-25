import {getTarget} from './index.js';

export async function runCobblerBuildisoAllProfiles(distro: string) {
    const tmpDir = '/var/cache/cobbler/buildiso';
    const isoDir = '/var/cache/cobbler';
    const server = await getTarget('server');
    const {
        stdout,
        returnCode
    } = await server.run(`cobbler buildiso --tempdir=${tmpDir} --iso ${isoDir}/profile_all.iso --distro=${distro}`, {verbose: true});
    if (returnCode !== 0) {
        throw new Error(`error in cobbler buildiso.\nLogs:\n${stdout}`);
    }
    const profiles = ['orchid', 'flame', 'pearl'];
    const isolinuxProfiles = [];
    const cobblerProfiles = [];
    for (const profile of profiles) {
        const {
            stdout: cobblerResult,
            returnCode: cobblerCode
        } = await server.run(`cobbler profile list | grep -o ${profile}`, {verbose: true});
        if (cobblerCode === 0) {
            cobblerProfiles.push(cobblerResult);
        }
        const {stdout: isolinuxResult} = await server.run(`cat ${tmpDir}/isolinux/isolinux.cfg | grep -o ${profile} | cut -c -6 | head -n 1`);
        if (isolinuxResult) {
            isolinuxProfiles.push(isolinuxResult);
        }
    }
    if (cobblerProfiles.join() !== isolinuxProfiles.join()) {
        throw new Error(`error during comparison of Cobbler profiles.\nLogs:\nCobbler profiles:\n${cobblerProfiles}\nisolinux profiles:\n${isolinuxProfiles}`);
    }
}
