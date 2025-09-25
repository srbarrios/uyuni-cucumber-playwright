import { getTarget, globalVars, getSystemName } from '../index.js';

export async function storeFileInSaltMinionConfig(content: string, filename: string, host: string) {
    const node = await getTarget(host);
    const saltConfig = globalVars.useSaltBundle ? '/etc/venv-salt-minion/minion.d/' : '/etc/salt/minion.d/';
    // file injection not possible
    throw new Error('This step requires file injection which cannot be performed.');
}
