// Copyright (c) 2022-2025 SUSE LLC.
// Licensed under the terms of the MIT license.

import { ApiTest } from '../api/api_test';

export class NamespaceActivationkey {
  constructor(private test: ApiTest) {}

  create(id: string, descr: string, baseChannel: string, limit: number): Promise<any> {
    return this.test.call('activationkey.create', {
      sessionKey: this.test.currentToken || '',
      key: id,
      description: descr,
      baseChannelLabel: baseChannel,
      usageLimit: limit,
      entitlements: [],
      universalDefault: false,
    });
  }

  async delete(id: string): Promise<any> {
    const res = await this.test.call('activationkey.delete', { sessionKey: this.test.currentToken || '', key: id });
    // Refresh keys (side-effect kept for parity)
    await this.test.call('activationkey.listActivationKeys', { sessionKey: this.test.currentToken || '' });
    return res;
  }

  async get_activation_keys_count(): Promise<number> {
    const keys = await this.test.call('activationkey.listActivationKeys', { sessionKey: this.test.currentToken || '' });
    return Array.isArray(keys) ? keys.length : 0;
  }

  async get_activated_systems_count(id: string): Promise<number> {
    const systems = await this.test.call('activationkey.listActivatedSystems', { sessionKey: this.test.currentToken || '', key: id });
    return Array.isArray(systems) ? systems.length : 0;
  }

  async get_config_channels_count(id: string): Promise<number> {
    const channels = await this.test.call('activationkey.listConfigChannels', { sessionKey: this.test.currentToken || '', key: id });
    return Array.isArray(channels) ? channels.length : 0;
  }

  async verify(id: string): Promise<boolean> {
    const list = await this.test.call('activationkey.listActivationKeys', { sessionKey: this.test.currentToken || '' });
    return Array.isArray(list) ? list.map((k: any) => k.key || k['key']).includes(id) : false;
  }

  add_config_channels(id: string, configChannelLabels: string[]): Promise<any> {
    return this.test.call('activationkey.addConfigChannels', {
      sessionKey: this.test.currentToken || '',
      keys: id,
      configChannelLabels,
      addToTop: false,
    });
  }

  add_child_channels(id: string, childChannelLabels: string[]): Promise<any> {
    return this.test.call('activationkey.addChildChannels', { sessionKey: this.test.currentToken || '', key: id, childChannelLabels });
  }

  get_details(id: string): Promise<any> {
    return this.test.call('activationkey.getDetails', { sessionKey: this.test.currentToken || '', key: id });
  }

  async set_details(id: string, description: string, baseChannelLabel: string, usageLimit: number, contactMethod: 'default' | 'ssh-push' | 'ssh-push-tunnel'): Promise<boolean> {
    const details = { description, base_channel_label: baseChannelLabel, usage_limit: usageLimit, universal_default: false, contact_method: contactMethod };
    const res = await this.test.call('activationkey.setDetails', { sessionKey: this.test.currentToken || '', key: id, details });
    return Number(res) === 1;
  }

  set_entitlement(id: string, entitlements: string[]): Promise<any> {
    return this.test.call('activationkey.addEntitlements', { sessionKey: this.test.currentToken || '', key: id, entitlements });
  }
}
