// Copyright (c) 2022-2023 SUSE LLC.
// Licensed under the terms of the MIT license.

import { ApiTest } from '../api/api_test';

export interface ApiNamespace {
  name: string;
  description?: string;
}

export interface ApiCall {
  name: string;
  description?: string;
  parameters?: any[];
}

/**
 * API namespace
 */
export class NamespaceApi {
  private test: ApiTest;

  /**
   * Initializes a new instance of the NamespaceApi class.
   * @param apiTest The test object that is passed to the initialize method
   */
  constructor(apiTest: ApiTest) {
    this.test = apiTest;
  }

  /**
   * Returns the amount of API namespaces.
   * @returns Promise with the count of API namespaces
   */
  async getCountOfApiNamespaces(): Promise<number> {
    try {
      const namespaces = await this.test.call('api.getApiNamespaces', {
        sessionKey: this.test.currentToken || ''
      });
      
      return namespaces ? namespaces.length : 0;
    } catch (error) {
      console.warn('Failed to get API namespaces count:', error);
      return 0;
    }
  }

  /**
   * Returns the amount of available API calls.
   * @returns Promise with the count of API calls
   */
  async getCountOfApiCallListGroups(): Promise<number> {
    try {
      const callList = await this.test.call('api.getApiCallList', {
        sessionKey: this.test.currentToken || ''
      });
      
      return callList ? callList.length : 0;
    } catch (error) {
      console.warn('Failed to get API call list groups count:', error);
      return 0;
    }
  }

  /**
   * Returns the count of the number of API calls in the API namespace call list.
   * @returns Promise with the count of API calls in the API namespace call list
   */
  async getCountOfApiNamespaceCallList(): Promise<number> {
    try {
      let count = 0;
      
      const namespaces = await this.test.call('api.getApiNamespaces', {
        sessionKey: this.test.currentToken || ''
      });
      
      if (namespaces && Array.isArray(namespaces)) {
        for (const ns of namespaces) {
          try {
            const callList = await this.test.call('api.getApiNamespaceCallList', {
              sessionKey: this.test.currentToken || '',
              namespace: ns[0] // First element is typically the namespace name
            });
            
            if (callList && Array.isArray(callList)) {
              count += callList.length;
            }
          } catch (error) {
            console.warn(`Failed to get call list for namespace ${ns[0]}:`, error);
            // Continue with other namespaces
          }
        }
      }
      
      return count;
    } catch (error) {
      console.warn('Failed to get API namespace call list count:', error);
      return 0;
    }
  }

  /**
   * Get all API namespaces
   * @returns Promise with array of API namespaces
   */
  async getApiNamespaces(): Promise<ApiNamespace[]> {
    try {
      const namespaces = await this.test.call('api.getApiNamespaces', {
        sessionKey: this.test.currentToken || ''
      });
      
      if (!namespaces || !Array.isArray(namespaces)) {
        return [];
      }
      
      return namespaces.map(ns => ({
        name: ns[0] || ns.name || 'unknown',
        description: ns[1] || ns.description
      }));
    } catch (error) {
      console.warn('Failed to get API namespaces:', error);
      return [];
    }
  }

  /**
   * Get API calls for a specific namespace
   * @param namespace The namespace to get calls for
   * @returns Promise with array of API calls
   */
  async getApiNamespaceCallList(namespace: string): Promise<ApiCall[]> {
    try {
      const callList = await this.test.call('api.getApiNamespaceCallList', {
        sessionKey: this.test.currentToken || '',
        namespace
      });
      
      if (!callList || !Array.isArray(callList)) {
        return [];
      }
      
      return callList.map(call => ({
        name: call[0] || call.name || 'unknown',
        description: call[1] || call.description,
        parameters: call.parameters || []
      }));
    } catch (error) {
      console.warn(`Failed to get API calls for namespace ${namespace}:`, error);
      return [];
    }
  }

  /**
   * Get the complete API call list
   * @returns Promise with array of all API calls
   */
  async getApiCallList(): Promise<ApiCall[]> {
    try {
      const callList = await this.test.call('api.getApiCallList', {
        sessionKey: this.test.currentToken || ''
      });
      
      if (!callList || !Array.isArray(callList)) {
        return [];
      }
      
      return callList.map(call => ({
        name: call[0] || call.name || 'unknown',
        description: call[1] || call.description,
        parameters: call.parameters || []
      }));
    } catch (error) {
      console.warn('Failed to get API call list:', error);
      return [];
    }
  }

  /**
   * Check if a specific API namespace exists
   * @param namespace The namespace to check
   * @returns Promise with boolean indicating if namespace exists
   */
  async hasNamespace(namespace: string): Promise<boolean> {
    try {
      const namespaces = await this.getApiNamespaces();
      return namespaces.some(ns => ns.name === namespace);
    } catch (error) {
      console.warn(`Failed to check namespace ${namespace}:`, error);
      return false;
    }
  }

  /**
   * Check if a specific API call exists
   * @param apiCall The API call to check (in format "namespace.method")
   * @returns Promise with boolean indicating if API call exists
   */
  async hasApiCall(apiCall: string): Promise<boolean> {
    try {
      const [namespace, method] = apiCall.split('.');
      if (!namespace || !method) {
        return false;
      }
      
      const calls = await this.getApiNamespaceCallList(namespace);
      return calls.some(call => 
        call.name === method || 
        call.name === apiCall ||
        call.name.endsWith(`.${method}`)
      );
    } catch (error) {
      console.warn(`Failed to check API call ${apiCall}:`, error);
      return false;
    }
  }
}