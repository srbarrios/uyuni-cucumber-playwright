import {getTarget, globalVars} from '../index.js';

export async function storeFileInSaltMinionConfig(content: string, filename: string, host: string) {
    const node = await getTarget(host);
    const saltConfig = globalVars.useSaltBundle ? '/etc/venv-salt-minion/minion.d/' : '/etc/salt/minion.d/';
    await node.run(`echo "${content}" > ${saltConfig}${filename}`);
}
