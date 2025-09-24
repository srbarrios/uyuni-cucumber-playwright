// Copyright (c) 2025 SUSE LLC.
// Licensed under the terms of the MIT license.

import { getTarget } from '../system/remote_nodes_env';
import { repeatUntilTimeout } from '../core/commonlib';

// Create an SSL certificate using cert-manager and return the paths on the server
export async function generateCertificate(name: string, fqdn: string): Promise<[string, string, string]> {
  const server = getTarget('server');
  const certificate = [
    'apiVersion: cert-manager.io/v1',
    'kind: Certificate',
    'metadata:',
    `  name: uyuni-${name}`,
    'spec:',
    `  secretName: uyuni-${name}-cert`,
    '  subject:',
    "    countries: ['DE']",
    "    provinces: ['Bayern']",
    "    localities: ['Nuernberg']",
    "    organizations: ['SUSE']",
    "    organizationalUnits: ['SUSE']",
    '  emailAddresses:',
    '    - galaxy-noise@suse.de',
    `  commonName: ${fqdn}`,
    '  dnsNames:',
    `    - ${fqdn}`,
    '  issuerRef:',
    '    name: uyuni-ca-issuer',
    '    kind: Issuer',
  ].join('\n');

  const applyCmd = `echo -e "${certificate.replace(/"/g, '\\"')}" | kubectl apply -f -`;
  const { exitCode } = await server.runLocal(applyCmd);
  if (exitCode !== 0) {
    throw new Error(`Failed to define ${name} Certificate resource`);
  }

  // Wait for secret to be created
  await repeatUntilTimeout(async () => {
    const res = await server.runLocal(`kubectl get secret uyuni-${name}-cert`, { checkErrors: false });
    return res.exitCode === 0;
  }, { timeout: 600000, message: `Kubernetes uyuni-${name}-cert secret has not been defined` });

  const crtPath = `/tmp/${name}.crt`;
  const keyPath = `/tmp/${name}.key`;
  const caPath = '/tmp/ca.crt';

  let rc = (await server.runLocal(`kubectl get secret uyuni-${name}-cert -o jsonpath='{.data.tls\\.crt}' | base64 -d >${crtPath}`)).exitCode;
  if (rc !== 0) throw new Error(`Failed to store ${name} certificate`);
  rc = (await server.runLocal(`kubectl get secret uyuni-${name}-cert -o jsonpath='{.data.tls\\.key}' | base64 -d >${keyPath}`)).exitCode;
  if (rc !== 0) throw new Error(`Failed to store ${name} key`);
  await server.runLocal(`kubectl get secret uyuni-${name}-cert -o jsonpath='{.data.ca\\.crt}' | base64 -d >${caPath}`);

  return [crtPath, keyPath, caPath];
}

// Returns whether the server is running k3s service
export async function runningK3s(): Promise<boolean> {
  const server = getTarget('server');
  const res = await server.runLocal('systemctl is-active k3s', { checkErrors: false });
  return res.exitCode === 0;
}
