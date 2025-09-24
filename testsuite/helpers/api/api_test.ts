// Copyright (c) 2022-2024 SUSE LLC.
// Licensed under the terms of the MIT license.

import { XmlrpcClient } from './xmlrpc_client';
import { HttpClient } from './http_client';
import { repeatUntilTimeout } from '../core/commonlib';
import { TIMEOUTS, GLOBAL_VARS } from '../core/env';
import { NamespaceApi } from '../namespaces/api';
import { NamespaceChannel } from '../namespaces/channel';
import { NamespaceActionchain } from '../namespaces/actionchain';
import { NamespaceActivationkey } from '../namespaces/activationkey';
import { NamespaceAudit } from '../namespaces/audit';
import { NamespaceConfigchannel } from '../namespaces/configchannel';
import { NamespaceImage } from '../namespaces/image';
import { NamespaceKickstart } from '../namespaces/kickstart';
import { NamespaceSchedule } from '../namespaces/schedule';
import { NamespaceSystem } from '../namespaces/system';
import { NamespaceUser } from '../namespaces/user';

// We'll need to create these namespace classes
// For now, we'll define placeholder interfaces
export interface INamespaceActionchain {
  // Methods will be implemented when we convert the namespace files
}

export interface INamespaceActivationkey {
  // Methods will be implemented when we convert the namespace files
}

export interface INamespaceApi {
  // Methods will be implemented when we convert the namespace files
}

export interface INamespaceAudit {
  // Methods will be implemented when we convert the namespace files
}

export interface INamespaceChannel {
  // Methods will be implemented when we convert the namespace files
}

export interface INamespaceConfigchannel {
  // Methods will be implemented when we convert the namespace files
}

export interface INamespaceImage {
  // Methods will be implemented when we convert the namespace files
}

export interface INamespaceKickstart {
  // Methods will be implemented when we convert the namespace files
}

export interface INamespaceSchedule {
  // Methods will be implemented when we convert the namespace files
}

export interface INamespaceSystem {
  // Methods will be implemented when we convert the namespace files
}

export interface INamespaceUser {
  // Methods will be implemented when we convert the namespace files
}

export interface ApiConnection {
  call(name: string, params: any): Promise<any>;
  close?(): void;
}

export interface ApiCallParams {
  [key: string]: any;
  sessionKey?: string;
}

/**
 * Abstract parent class describing an API test
 */
export abstract class ApiTest {
  protected connection: ApiConnection | null = null;
  protected token: string | null = null;
  private semaphore: boolean = false;

  // Namespace instances - these will be properly implemented when we convert namespace files
  public readonly actionchain: NamespaceActionchain;
  public readonly activationkey: NamespaceActivationkey;
  public readonly api: INamespaceApi;
  public readonly audit: NamespaceAudit;
  public readonly channel: NamespaceChannel;
  public readonly configchannel: NamespaceConfigchannel;
  public readonly image: NamespaceImage;
  public readonly kickstart: NamespaceKickstart;
  public readonly schedule: NamespaceSchedule;
  public readonly system: NamespaceSystem;
  public readonly user: NamespaceUser;

  /**
   * Creates objects that are used to interact with the API.
   * @param _host The hostname of the Spacewalk server
   */
  constructor(_host: string) {
    // For now, these are placeholders - will be implemented when namespace classes are converted
    this.actionchain = new NamespaceActionchain(this);
    this.activationkey = new NamespaceActivationkey(this);
    this.api = new NamespaceApi(this) as unknown as INamespaceApi;
    this.audit = new NamespaceAudit(this);
    this.channel = new NamespaceChannel(this);
    this.configchannel = new NamespaceConfigchannel(this);
    this.image = new NamespaceImage(this);
    this.kickstart = new NamespaceKickstart(this);
    this.schedule = new NamespaceSchedule(this);
    this.system = new NamespaceSystem(this);
    this.user = new NamespaceUser(this);
  }

  /**
   * Calls a function with the given name and parameters, and returns its response.
   * @param name The name of the method you want to call
   * @param params The parameters to pass to the API call
   * @returns Promise with the response from the API call
   */
  async call(name: string, params: ApiCallParams = {}): Promise<any> {
    // Wait for semaphore to be free
    await this.waitForSemaphore();
    
    try {
      this.semaphore = true;
      
      await this.manageApiLock(name);
      const response = await this.makeApiCall(name, params);
      
      return response;
    } finally {
      // Always clean up
      if (this.token && this.connection) {
        try {
          await this.connection.call('auth.logout', { sessionKey: this.token });
        } catch (error) {
          console.warn('Failed to logout:', error);
        }
      }
      
      if (name.includes('user.')) {
        this.apiUnlock();
      }
      
      this.semaphore = false;
    }
  }

  /**
   * Wait for the semaphore to be free
   */
  private async waitForSemaphore(): Promise<void> {
    while (this.semaphore) {
      await new Promise(resolve => setTimeout(resolve, 10));
    }
  }

  /**
   * Handles API lock management
   * @param name The API method name
   */
  private static adminApiLocked: boolean = false;

  private async manageApiLock(name: string): Promise<void> {
    if (!this.connection) {
      throw new Error('API connection not initialized');
    }

    if (name.includes('user.')) {
      // Single-process admin API lock
      await repeatUntilTimeout(async () => {
        if (!ApiTest.adminApiLocked) {
          ApiTest.adminApiLocked = true;
          return true;
        }
        await new Promise(resolve => setTimeout(resolve, 100));
        return false;
      }, {
        timeout: TIMEOUTS.default * 1000,
        message: 'We couldn\'t get access to the API'
      });

      this.token = await this.connection.call('auth.login', {
        login: 'admin',
        password: 'admin'
      });
    } else {
      this.token = await this.connection.call('auth.login', {
        login: GLOBAL_VARS.currentUser,
        password: GLOBAL_VARS.currentPassword
      });
    }
  }

  /**
   * Makes the actual API call
   * @param name The method name
   * @param params The parameters
   * @returns Promise with the API response
   */
  private async makeApiCall(name: string, params: ApiCallParams): Promise<any> {
    if (!this.connection || !this.token) {
      throw new Error('API connection or token not available');
    }

    const callParams = { ...params, sessionKey: this.token };
    return this.connection.call(name, callParams);
  }

  /**
   * Check if API is locked (placeholder implementation)
   * @returns Promise with lock status
   */
  private async isApiLocked(): Promise<boolean> {
    return ApiTest.adminApiLocked;
  }

  /**
   * Release API lock (placeholder implementation)
   */
  private apiUnlock(): void {
    ApiTest.adminApiLocked = false;
  }

  /**
   * Abstract method to check if an attribute is a date
   * @param attribute The attribute to check
   */
  abstract isDate(attribute: any): boolean;

  /**
   * Abstract method to get current date
   */
  abstract getCurrentDate(): any;

  /**
   * Get the current token
   */
  get currentToken(): string | null {
    return this.token;
  }

  /**
   * Close the connection
   */
  async close(): Promise<void> {
    if (this.connection?.close) {
      this.connection.close();
    }
  }
}

/**
 * Derived class for an XML-RPC test
 */
export class ApiTestXmlrpc extends ApiTest {
  /**
   * Creates a new instance with XmlrpcClient
   * @param host The hostname of the server
   */
  constructor(host: string) {
    super(host);
    this.connection = new XmlrpcClient(host);
  }

  /**
   * Returns a boolean on whether the given attribute is an XMLRPC DateTime object or not
   * @param attribute The attribute to check
   * @returns Whether the attribute is an XMLRPC DateTime object or not
   */
  isDate(attribute: any): boolean {
    // Check if it's an XML-RPC DateTime object
    // This is a simplified check - in reality, we'd need to check for specific xmlrpc DateTime structure
    return attribute && 
           typeof attribute === 'object' && 
           attribute.hasOwnProperty('year') &&
           attribute.hasOwnProperty('month') &&
           attribute.hasOwnProperty('day');
  }

  /**
   * Returns the current date and time as an XMLRPC DateTime object
   * @returns The current date and time as an XMLRPC DateTime object
   */
  getCurrentDate(): any {
    const now = new Date();
    return {
      year: now.getFullYear(),
      month: now.getMonth() + 1, // JavaScript months are 0-based
      day: now.getDate(),
      hour: now.getHours(),
      minute: now.getMinutes(),
      second: now.getSeconds()
    };
  }
}

/**
 * Derived class for an HTTP test
 */
export class ApiTestHttp extends ApiTest {
  /**
   * Creates a new instance with HttpClient
   * @param host The hostname of the server
   * @param sslVerify Whether to verify SSL certificates or not
   */
  constructor(host: string, sslVerify: boolean = true) {
    super(host);
    this.connection = new HttpClient(host, sslVerify);
  }

  /**
   * Attempts to parse a given string as a Date object, to validate it.
   * @param attribute The date string to be parsed
   * @returns Whether the attribute is a valid Date or not
   */
  isDate(attribute: any): boolean {
    try {
      const date = new Date(attribute);
      return !isNaN(date.getTime());
    } catch {
      return false;
    }
  }

  /**
   * Returns a string with the current date and time in ISO format
   * @returns The current date and time in ISO format
   */
  getCurrentDate(): string {
    return new Date().toISOString();
  }
}

/**
 * Factory function to create API test instances
 * @param host The hostname
 * @param useHttp Whether to use HTTP (true) or XML-RPC (false)
 * @param sslVerify Whether to verify SSL certificates (only for HTTP)
 * @returns ApiTest instance
 */
export function createApiTest(host: string, useHttp: boolean = false, sslVerify: boolean = true): ApiTest {
  return useHttp ? new ApiTestHttp(host, sslVerify) : new ApiTestXmlrpc(host);
}