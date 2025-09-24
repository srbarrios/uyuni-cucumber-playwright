// Copyright (c) 2025 SUSE LLC.
// Licensed under the terms of the MIT license.

import { ApiTest, ApiCallParams } from '../api/api_test';

/**
 * Creates a dynamic namespace proxy that forwards any chained method call
 * to ApiTest.call with a fully qualified name like "namespace.sub.method".
 *
 * Usage:
 * const ns = createDynamicNamespace(apiTest, 'system');
 * await ns.get_event_history({ systemId: 1, start: 0, limit: 10 });
 * await ns.profile.create({ ... });
 */
export function createDynamicNamespace(apiTest: ApiTest, root: string): any {
  const buildInvoker = (qualified: string) => {
    const invoker = (params: ApiCallParams = {}) => apiTest.call(qualified, params);
    // Allow explicit call via .call('sub.method', params)
    (invoker as any).call = (method: string, params: ApiCallParams = {}) => apiTest.call(`${root}.${method}`, params);
    return new Proxy(invoker, handler(qualified));
  };

  const handler = (prefix: string) => ({
    get(_target: any, prop: PropertyKey) {
      if (prop === 'call') {
        // already attached on the invoker function
        return (method: string, params: ApiCallParams = {}) => apiTest.call(`${root}.${method}`, params);
      }
      if (prop === Symbol.toStringTag) return 'DynamicNamespace';
      // Build next chained segment
      const next = `${prefix}.${String(prop)}`;
      return buildInvoker(next);
    },
    apply(target: any, _thisArg: any, argArray?: any) {
      // Directly calling the proxy invokes the API
      const params: ApiCallParams = (argArray && argArray[0]) || {};
      return apiTest.call(prefix, params);
    }
  });

  return buildInvoker(root);
}
