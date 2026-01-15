// Copyright (c) 2025 SUSE LLC.
// Licensed under the terms of the MIT license.

import axios from 'axios';

export class MetricsCollectorHandler {
    private gatewayUrl: string;

    constructor(metricsCollectorUrl?: string) {
        this.gatewayUrl = metricsCollectorUrl || process.env.PROMETHEUS_PUSH_GATEWAY_URL || 'http://nsa.mgr.suse.de:9091';
    }

    /**
     * Push a metric to Prometheus Pushgateway.
     * Builds OpenMetrics/Prometheus exposition format and PUTs to /metrics/job/<job>.
     */
    async pushMetrics(jobName: string, metricName: string, metricValue: number, labels: Record<string, string> = {}): Promise<void> {
        try {
            const labelPairs = Object.entries(labels)
                .map(([k, v]) => `${escapeLabel(k)}="${escapeLabelValue(v)}"`)
                .join(',');
            const labelBlock = labelPairs ? `{${labelPairs}}` : '';
            const body = `# TYPE ${metricName} gauge\n${metricName}${labelBlock} ${metricValue}\n`;
            const url = `${this.gatewayUrl.replace(/\/$/, '')}/metrics/job/${encodeURIComponent(jobName)}`;
            await axios.put(url, body, {headers: {'Content-Type': 'text/plain'}});
            console.debug(`Pushed metric ${metricName}=${metricValue} to ${url}`);
        } catch (e: any) {
            console.error(`Error pushing metric ${metricName}=${metricValue}:`, e?.message || e);
            throw e;
        }
    }
}

function escapeLabel(s: string): string {
    return s.replace(/[^a-zA-Z0-9_]/g, '_');
}

function escapeLabelValue(s: string): string {
    // Escape backslash, double-quote, and newline per exposition format
    return s.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n');
}
