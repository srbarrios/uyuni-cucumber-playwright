// Copyright (c) 2025 SUSE LLC.
// Licensed under the terms of the MIT license.

import * as fs from 'fs';
import {parseISO} from 'date-fns';
import {getTarget} from './remote_nodes_env.js';
import {getApiTest, getSystemId, getSystemName} from '../core/commonlib.js';
import {CHANNEL_TO_SYNC_BY_OS_PRODUCT_VERSION} from "../core/constants.js";
import {envConfig, globalVars} from "../core/env.js";
import {existsSync, readFileSync, statSync} from "node:fs";

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
        const {stdout} = await serverNode.run('tail -n100 /var/log/rhn/rhn_web_api.log');

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
        const apiTest = getApiTest();

        if (!apiTest) {
            throw new Error('API test client not available');
        }

        const systemId = await getSystemId(node);
        const events = await getApiTest().system.getEventHistory(systemId, 0, 10);

        // Find onboarding events (events with 'certs, channels, packages' in summary)
        const onboardingEvents = events.filter((event: SystemEvent) =>
            event.summary.includes('certs, channels, packages')
        );

        if (onboardingEvents.length === 0) {
            throw new Error(`No onboarding events found for ${host}`);
        }

        const lastEvent = onboardingEvents[onboardingEvents.length - 1];
        const eventDetails = await getApiTest().system.getEventDetails(systemId, lastEvent.id);

        // Handle different date formats (XMLRPC DateTime vs ISO string)
        const completedTime = parseISO(eventDetails.completed);
        const pickedUpTime = parseISO(eventDetails.picked_up);

        return (completedTime.getTime() - pickedUpTime.getTime()) / 1000; // Convert to seconds

    } catch (error) {
        throw new Error(`Error extracting onboarding duration for ${host}: ${error}`);
    }
}

/**
 * Filters out beta channels from a list of channels.
 * @param channels The array of channel names.
 * @param filterKeywords The keywords to filter out.
 * @returns A new array with filtered channels.
 */
function filterChannels(channels: string[], filterKeywords: string[]): string[] {
    return channels.filter(channel => !filterKeywords.some(keyword => channel.includes(keyword)));
}

/**
 * Calculates the total synchronization duration for a given OS product version.
 * @param osProductVersion The OS product version string.
 * @returns The total duration in seconds.
 * @throws {Error} If channels are not found or the log file is inaccessible.
 */
export async function getProductSynchronizationDuration(osProductVersion: string): Promise<number> {
    let channelsToEvaluate: string[] | undefined = CHANNEL_TO_SYNC_BY_OS_PRODUCT_VERSION[globalVars.product]?.[osProductVersion];

    if (!channelsToEvaluate) {
        console.log(`Product: ${globalVars.product}\n${JSON.stringify(CHANNEL_TO_SYNC_BY_OS_PRODUCT_VERSION, null, 2)}\n${JSON.stringify(CHANNEL_TO_SYNC_BY_OS_PRODUCT_VERSION[globalVars.product]?.[osProductVersion])}`);
        throw new Error(`Synchronization error, channels for ${osProductVersion} in ${globalVars.product} not found`);
    }

    // Clone the array to avoid modifying the original data
    channelsToEvaluate = [...channelsToEvaluate];

    if (!envConfig.betaEnabled) {
        channelsToEvaluate = filterChannels(channelsToEvaluate, ['beta']);
    }

    console.log(`Channels to evaluate:\n${channelsToEvaluate.join('\n')}`);

    const logFilePath = '/tmp/reposync.log';
    const server = await getTarget('server');

    try {
        await server.extract('/var/log/rhn/reposync.log', logFilePath);
    } catch (error) {
        throw new Error('Failed to extract reposync.log from server.');
    }

    if (!existsSync(logFilePath) || statSync(logFilePath).size === 0) {
        throw new Error('The file with repository synchronization logs doesn\'t exist or is empty');
    }

    const logContent = readFileSync(logFilePath, 'utf-8').split('\n');

    let duration = 0;
    let channelToEvaluate = false;
    let matches = 0;
    let channelName = '';

    for (const line of logContent) {
        if (line.includes('Channel: ')) {
            channelName = line.split('Channel: ')[1]?.trim();
            channelToEvaluate = channelsToEvaluate.includes(channelName);
        }

        if (line.includes('Total time: ') && channelToEvaluate) {
            const match = line.match(/Total time: (\d+):(\d+):(\d+)/);
            if (match) {
                const [, hours, minutes, seconds] = match.map(Number);
                const totalSeconds = (hours * 3600) + (minutes * 60) + seconds;
                console.log(`Channel ${channelName} synchronization duration: ${totalSeconds} seconds`);
                duration += totalSeconds;
                matches += 1;
                channelToEvaluate = false;
            }
        }
    }

    if (matches < channelsToEvaluate.length) {
        console.log(`Error extracting the synchronization duration of ${osProductVersion}`);
        console.log(`Content of reposync.log:\n${logContent.join('\n')}`);
    }

    return duration;
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
