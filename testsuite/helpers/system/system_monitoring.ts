// Copyright (c) 2024 SUSE LLC.
// Licensed under the terms of the MIT license.

import * as fs from 'fs';
import { getTarget } from './remote_nodes_env';
import { getGlobalApiTest } from '../core/commonlib';

export interface BootstrapDuration {
  host: string;
  duration: number; // in seconds
  timestamp: Date;
}

export interface OnboardingDuration {
  host: string;
  duration: number; // in seconds
  eventId: string;
  completedTime: Date;
  pickedUpTime: Date;
}

export interface SynchronizationDuration {
  channel?: string;
  osProductVersion?: string;
  duration: number; // in seconds
  channels: string[];
}

export interface SystemEvent {
  id: string;
  summary: string;
  completed: Date | string;
  picked_up: Date | string;
}

/**
 * Returns the last bootstrap duration for the given host
 * @param host The hostname
 * @returns Promise with the duration in seconds
 */
export async function getLastBootstrapDuration(host: string): Promise<number> {
  try {
    const serverNode = await getTarget('server');
    const { stdout } = await serverNode.run('tail -n100 /var/log/rhn/rhn_web_api.log');
    
    // This would be replaced with actual system name resolution
    const systemName = await getSystemName(host);
    let duration: number | null = null;
    
    const lines = stdout.split('\n');
    for (const line of lines) {
      if (line.includes(systemName) && line.includes('systems.bootstrap')) {
        const match = line.match(/TIME: (\d+\.?\d*) seconds/);
        if (match) {
          duration = parseFloat(match[1]);
        }
      }
    }
    
    if (duration === null) {
      throw new Error(`Bootstrap duration not found for ${host}`);
    }
    
    return duration;
  } catch (error) {
    throw new Error(`Error extracting bootstrap duration for ${host}: ${error}`);
  }
}

/**
 * Returns the last onboarding duration for the given host
 * @param host The hostname
 * @returns Promise with the duration in seconds
 */
export async function getLastOnboardingDuration(host: string): Promise<number> {
  try {
    const node = await getTarget(host);
    const apiTest = getGlobalApiTest();
    
    if (!apiTest) {
      throw new Error('API test client not available');
    }
    
    const systemId = await getSystemId(node);
    const events = await apiTest.system.get_event_history(systemId, 0, 10);
    
    // Find onboarding events (events with 'certs, channels, packages' in summary)
    const onboardingEvents = events.filter((event: SystemEvent) => 
      event.summary.includes('certs, channels, packages')
    );
    
    if (onboardingEvents.length === 0) {
      throw new Error(`No onboarding events found for ${host}`);
    }
    
    const lastEvent = onboardingEvents[onboardingEvents.length - 1];
    const eventDetails = await apiTest.system.get_event_details(systemId, lastEvent.id);
    
    // Handle different date formats (XMLRPC DateTime vs ISO string)
    const completedTime = parseEventDate(eventDetails.completed);
    const pickedUpTime = parseEventDate(eventDetails.picked_up);
    
    return (completedTime.getTime() - pickedUpTime.getTime()) / 1000; // Convert to seconds
    
  } catch (error) {
    throw new Error(`Error extracting onboarding duration for ${host}: ${error}`);
  }
}

/**
 * Returns the synchronization duration for the given product
 * @param osProductVersion The product name
 * @returns Promise with the duration in seconds
 */
export async function getProductSynchronizationDuration(osProductVersion: string): Promise<number> {
  try {
    // This would need to be implemented based on the actual channel mapping
    // For now, we'll create a placeholder implementation
    const channelsToEvaluate = await getChannelsForProduct(osProductVersion);
    
    if (channelsToEvaluate.length === 0) {
      throw new Error(`Synchronization error, channels for ${osProductVersion} not found`);
    }
    
    const serverNode = await getTarget('server');
    
    // Extract reposync log
    const success = await serverNode.extract('/var/log/rhn/reposync.log', '/tmp/reposync.log');
    if (!success) {
      throw new Error('The file with repository synchronization logs doesn\'t exist or is empty');
    }
    
    if (!fs.existsSync('/tmp/reposync.log') || fs.statSync('/tmp/reposync.log').size === 0) {
      throw new Error('The file with repository synchronization logs doesn\'t exist or is empty');
    }
    
    let duration = 0;
    let channelToEvaluate = false;
    let matches = 0;
    let channelName = '';
    
    const logContent = fs.readFileSync('/tmp/reposync.log', 'utf8');
    const lines = logContent.split('\n');
    
    for (const line of lines) {
      if (line.includes('Channel: ')) {
        channelName = line.split('Channel: ')[1]?.trim() || '';
        channelToEvaluate = channelsToEvaluate.includes(channelName);
      }
      
      if (line.includes('Total time: ') && channelToEvaluate) {
        const match = line.match(/Total time: (\d+):(\d+):(\d+)/);
        if (match) {
          const hours = parseInt(match[1], 10);
          const minutes = parseInt(match[2], 10);
          const seconds = parseInt(match[3], 10);
          const totalSeconds = (hours * 3600) + (minutes * 60) + seconds;
          
          console.log(`Channel ${channelName} synchronization duration: ${totalSeconds} seconds`);
          duration += totalSeconds;
          matches++;
          channelToEvaluate = false;
        }
      }
    }
    
    if (matches < channelsToEvaluate.length) {
      console.log(`Error extracting the synchronization duration of ${osProductVersion}`);
      console.log(`Content of reposync.log:\n${logContent}`);
    }
    
    return duration;
  } catch (error) {
    throw new Error(`Error extracting product synchronization duration for ${osProductVersion}: ${error}`);
  }
}

/**
 * Returns the synchronization duration for the given channel
 * @param channel The channel name
 * @returns Promise with the duration in seconds
 */
export async function getChannelSynchronizationDuration(channel: string): Promise<number> {
  try {
    const serverNode = await getTarget('server');
    
    // Extract reposync log
    const success = await serverNode.extract('/var/log/rhn/reposync.log', '/tmp/reposync.log');
    if (!success) {
      throw new Error('The file with repository synchronization logs doesn\'t exist or is empty');
    }
    
    if (!fs.existsSync('/tmp/reposync.log') || fs.statSync('/tmp/reposync.log').size === 0) {
      throw new Error('The file with repository synchronization logs doesn\'t exist or is empty');
    }
    
    let channelFound = false;
    let duration = 0;
    let matches = 0;
    
    const logContent = fs.readFileSync('/tmp/reposync.log', 'utf8');
    const lines = logContent.split('\n');
    
    for (const line of lines) {
      if (line.includes('Channel: ')) {
        const channelName = line.split('Channel: ')[1]?.trim() || '';
        if (channelName === channel) {
          channelFound = true;
          duration = 0;
          matches++;
        }
      }
      
      if (line.includes('Total time: ') && channelFound) {
        const match = line.match(/Total time: (\d+):(\d+):(\d+)/);
        if (match) {
          const hours = parseInt(match[1], 10);
          const minutes = parseInt(match[2], 10);
          const seconds = parseInt(match[3], 10);
          duration = (hours * 3600) + (minutes * 60) + seconds;
          channelFound = false;
        }
      }
    }
    
    if (matches > 1) {
      console.log(`Channel ${channel} was found ${matches} times in the logs, we return the last synchronization time.`);
    }
    
    if (matches === 0) {
      throw new Error(`Error extracting the synchronization duration of ${channel}`);
    }
    
    return duration;
  } catch (error) {
    throw new Error(`Error extracting channel synchronization duration for ${channel}: ${error}`);
  }
}

/**
 * Get system name for a host (placeholder implementation)
 * @param host The host identifier
 * @returns Promise with system name
 */
async function getSystemName(host: string): Promise<string> {
  try {
    const node = await getTarget(host);
    return node.hostname;
  } catch (error) {
    throw new Error(`Failed to get system name for ${host}: ${error}`);
  }
}

/**
 * Get system ID for a node (placeholder implementation)
 * @param node The remote node
 * @returns Promise with system ID
 */
async function getSystemId(node: any): Promise<string> {
  // This would need to be implemented based on the actual system ID resolution
  // For now, return a placeholder
  return `system_${node.hostname}`;
}

/**
 * Parse event date from various formats
 * @param dateValue The date value (could be XMLRPC DateTime, ISO string, etc.)
 * @returns Parsed Date object
 */
function parseEventDate(dateValue: any): Date {
  if (dateValue instanceof Date) {
    return dateValue;
  }
  
  // Handle XMLRPC DateTime-like objects
  if (typeof dateValue === 'object' && dateValue.year) {
    return new Date(
      dateValue.year,
      dateValue.month - 1, // JavaScript months are 0-based
      dateValue.day,
      dateValue.hour || 0,
      dateValue.minute || 0,
      dateValue.second || 0
    );
  }
  
  // Handle string dates
  if (typeof dateValue === 'string') {
    return new Date(dateValue);
  }
  
  throw new Error(`Unable to parse date value: ${dateValue}`);
}

/**
 * Get channels for a product (placeholder implementation)
 * @param osProductVersion The OS product version
 * @returns Promise with array of channel names
 */
async function getChannelsForProduct(osProductVersion: string): Promise<string[]> {
  // This would need to be implemented based on the actual channel mapping
  // For now, return a placeholder
  console.log(`Getting channels for product: ${osProductVersion}`);
  return [`${osProductVersion}-base`, `${osProductVersion}-updates`];
}

/**
 * Filter channels based on criteria (e.g., exclude beta channels)
 * @param channels Array of channel names
 * @param filters Array of filter terms to exclude
 * @returns Filtered array of channel names
 */
function filterChannelsList(channels: string[], filters: string[]): string[] {
  return channels.filter(channel => {
    return !filters.some(filter => channel.toLowerCase().includes(filter.toLowerCase()));
  });
}

/**
 * Create a bootstrap duration report
 * @param host The host identifier
 * @returns Promise with bootstrap duration report
 */
export async function createBootstrapReport(host: string): Promise<BootstrapDuration> {
  const duration = await getLastBootstrapDuration(host);
  
  return {
    host,
    duration,
    timestamp: new Date()
  };
}

/**
 * Create an onboarding duration report
 * @param host The host identifier
 * @returns Promise with onboarding duration report
 */
export async function createOnboardingReport(host: string): Promise<OnboardingDuration> {
  const duration = await getLastOnboardingDuration(host);
  const node = await getTarget(host);
  
  // This would need more detailed implementation for actual event tracking
  return {
    host,
    duration,
    eventId: 'placeholder_event_id',
    completedTime: new Date(),
    pickedUpTime: new Date(Date.now() - (duration * 1000))
  };
}

/**
 * Create a synchronization duration report
 * @param options Either channel name or OS product version
 * @returns Promise with synchronization duration report
 */
export async function createSynchronizationReport(options: {
  channel?: string;
  osProductVersion?: string;
}): Promise<SynchronizationDuration> {
  let duration: number;
  let channels: string[];
  
  if (options.channel) {
    duration = await getChannelSynchronizationDuration(options.channel);
    channels = [options.channel];
  } else if (options.osProductVersion) {
    duration = await getProductSynchronizationDuration(options.osProductVersion);
    channels = await getChannelsForProduct(options.osProductVersion);
  } else {
    throw new Error('Either channel or osProductVersion must be specified');
  }
  
  return {
    channel: options.channel,
    osProductVersion: options.osProductVersion,
    duration,
    channels
  };
}