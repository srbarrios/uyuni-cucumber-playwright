// Copyright (c) 2022-2023 SUSE LLC.
// Licensed under the terms of the MIT license.

import axios, { AxiosInstance, AxiosResponse } from 'axios';
import https from 'https';
import { TIMEOUTS } from '../core/env';

export interface ApiCallResult {
  success: boolean;
  result?: any;
  message?: string;
}

export interface CallParams {
  [key: string]: any;
  sessionKey?: string;
}

/**
 * Wrapper class for HTTP client library (Axios)
 */
export class HttpClient {
  private httpClient: AxiosInstance;

  /**
   * Creates a new HTTP client using the Axios library.
   * @param host The host to connect to
   * @param sslVerify Whether to verify SSL certificates (default is true)
   */
  constructor(host: string, sslVerify: boolean = true) {
    console.log('Activating HTTP API');
    
    this.httpClient = axios.create({
      baseURL: `https://${host}`,
      timeout: TIMEOUTS.default * 1000, // Convert to milliseconds
      httpsAgent: new https.Agent({
        rejectUnauthorized: sslVerify
      }),
      headers: {
        'Content-Type': 'application/json'
      }
    });
  }

  /**
   * Prepares a Spacewalk API call and returns the HTTP method and URL.
   * @param name The name of the API call
   * @param params The parameters for the call
   * @returns An array containing the call type and the URL
   */
  private prepareCall(name: string, params?: CallParams): [string, string] {
    const shortName = name.split('.').pop() || '';
    
    // Determine if this should be a GET or POST request
    const isGetCall = 
      shortName.startsWith('list') || 
      shortName.startsWith('get') || 
      shortName.startsWith('is') || 
      shortName.startsWith('find') ||
      name.startsWith('system.search.') ||
      name.startsWith('packages.search.') ||
      ['auth.logout', 'errata.applicableToChannels'].includes(name);

    const callType = isGetCall ? 'GET' : 'POST';
    let url = `/rhn/manager/api/${name.replace(/\./g, '/')}`;

    // For GET requests, add parameters to query string
    if (callType === 'GET' && params) {
      const queryParams = new URLSearchParams();
      
      Object.entries(params).forEach(([key, value]) => {
        if (Array.isArray(value)) {
          value.forEach(v => queryParams.append(key, String(v)));
        } else {
          queryParams.append(key, String(value));
        }
      });

      const queryString = queryParams.toString();
      if (queryString) {
        url += `?${queryString}`;
      }
    }

    return [callType, url];
  }

  /**
   * Calls the API with the given name and parameters.
   * @param name The name of the API call
   * @param params The parameters for the API call
   * @returns The session cookie if the API call is 'auth.login', otherwise the result of the API call
   */
  async call(name: string, params?: CallParams): Promise<any> {
    // Extract session cookie from parameters
    let sessionCookie: string | undefined;
    let requestParams = { ...params };
    
    if (requestParams?.sessionKey) {
      sessionCookie = requestParams.sessionKey;
      delete requestParams.sessionKey;
    }

    // If no parameters after removing sessionKey, set to undefined
    if (Object.keys(requestParams).length === 0) {
      requestParams = undefined as any;
    }

    // Prepare the API call
    const [callType, url] = this.prepareCall(name, requestParams);

    try {
      let response: AxiosResponse;
      const headers: Record<string, string> = {};
      
      if (sessionCookie) {
        headers['Cookie'] = sessionCookie;
      }

      if (callType === 'GET') {
        response = await this.httpClient.get(url, { headers });
      } else {
        response = await this.httpClient.post(url, requestParams, { headers });
      }

      // Handle auth.login specially to return session cookie
      if (name === 'auth.login') {
        const setCookieHeader = response.headers['set-cookie'];
        if (setCookieHeader) {
          // Find the session cookie
          for (const cookie of setCookieHeader) {
            if (cookie.includes('pxt-session-cookie=') && !cookie.includes('Max-Age=0;')) {
              return cookie.split(';')[0];
            }
          }
        }
        throw new Error('Failed to extract session cookie from auth.login response');
      }

      // For all other calls, parse and return the result
      const jsonBody = response.data as ApiCallResult;
      
      if (!jsonBody.success) {
        throw new Error(`API failure: ${jsonBody.message}`);
      }

      return jsonBody.result;

    } catch (error) {
      if (axios.isAxiosError(error)) {
        if (error.response) {
          const status = error.response.status;
          if (error.response.data) {
            const errorData = error.response.data as ApiCallResult;
            throw new Error(`Unexpected HTTP status code ${status}, message: ${errorData.message}`);
          } else {
            throw new Error(`Unexpected HTTP status code ${status}`);
          }
        } else if (error.request) {
          throw new Error(`Network error: ${error.message}`);
        }
      }
      throw error;
    }
  }

  /**
   * Close the HTTP client (cleanup method)
   */
  close(): void {
    // Axios doesn't need explicit cleanup, but this method provides consistency
    console.log('HTTP client closed');
  }
}