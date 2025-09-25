import {envConfig, getProductVersionFull, getTarget, isBuildValidation,} from '../index.js';

export async function manageBranchServerRepositories(action: string, _when: string) {
    const proxy = await getTarget('proxy');
    const osVersion = proxy.osVersion;
    const osFamily = proxy.osFamily;
    let repos = 'os_pool_repo os_update_repo ';
    if (!isBuildValidation || !envConfig.isContainerizedServer || !(await getProductVersionFull(proxy))?.includes('-released')) {
        repos += 'testing_overlay_devel_repo ';
    }
    if (osFamily?.match(/^sles/) && osVersion?.match(/^15/)) {
        repos += 'proxy_module_pool_repo proxy_module_update_repo ' +
            'proxy_product_pool_repo proxy_product_update_repo ' +
            'module_server_applications_pool_repo module_server_applications_update_repo ';
        if (!isBuildValidation || !(await getProductVersionFull(proxy))?.includes('-released')) {
            repos += 'proxy_devel_releasenotes_repo proxy_devel_repo ';
        }
    } else if (osFamily?.match(/^opensuse/)) {
        if (!envConfig.isContainerizedServer) {
            repos += 'proxy_pool_repo ';
        }
    }
    await proxy.run(`zypper mr --${action} ${repos}`, {verbose: true});
}
