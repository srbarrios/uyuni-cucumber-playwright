// Copyright (c) 2022-2023 SUSE LLC.
// Licensed under the terms of the MIT license.

import * as xmlrpc from 'xmlrpc';
import { TIMEOUTS, ENV_CONFIG } from '../core/env';

export interface XmlrpcParams {
  [key: string]: any;
}

/**
 * Represents an XMLRPC client object that is used to communicate with the Spacewalk server.
 */
export class XmlrpcClient {
  private client: xmlrpc.Client;

  /**
   * Initializes a new XmlrpcClient object.
   * @param host The hostname of the Spacewalk server
   */
  constructor(host: string) {
    console.log('Activating XML-RPC API');
    
    const protocol = ENV_CONFIG.debug ? 'http' : 'https';
    const port = ENV_CONFIG.debug ? 80 : 443;
    
    // Create XML-RPC client
    this.client = xmlrpc.createClient({
      host,
      port,
      path: '/rpc/api',
      headers: {
        'Content-Type': 'text/xml',
        'User-Agent': 'Uyuni-Cucumber-Playwright-Tests/1.0'
      }
    });
  }

  /**
   * Calls a remote method with a list of parameters.
   * @param name The name of the method to call
   * @param params A hash of parameters
   * @returns Promise with the result of the method call
   */
  async call(name: string, params: XmlrpcParams): Promise<any> {
    return new Promise((resolve, reject) => {
      // Convert params object to array of values
      const paramValues = Object.values(params);
      
      this.client.methodCall(name, paramValues, (error: any, value: any) => {
        if (error) {
          // Handle XML-RPC fault exceptions
          if (error.message && error.message.includes('fault')) {
            reject(new Error(`API failure: ${error.message}`));
          } else {
            reject(new Error(String(error)));
          }
        } else {
          resolve(value);
        }
      });
    });
  }

  /**
   * Close the client connection
   */
  close(): void {
    // The xmlrpc client doesn't have an explicit close method
    console.log('XML-RPC client closed');
  }
}