// Copyright (c) 2025 SUSE LLC.
// Licensed under the terms of the MIT license.

import { MetricsCollectorHandler } from './metrics_collector_handler';

/**
 * Quality Intelligence handler to produce and push key timing metrics
 */
export class QualityIntelligence {
  private mc: MetricsCollectorHandler;
  private environment: string | undefined;
  private static readonly JOB = 'quality_intelligence';

  constructor() {
    this.mc = new MetricsCollectorHandler(process.env.PROMETHEUS_PUSH_GATEWAY_URL);
    this.environment = process.env.SERVER;
  }

  /** Report time to complete bootstrap of a system (seconds) */
  async pushBootstrapDuration(system: string, timeSeconds: number): Promise<void> {
    await this.mc.pushMetrics(QualityIntelligence.JOB, 'system_bootstrap_duration_seconds', timeSeconds, {
      system,
      environment: this.environment || 'unknown',
    });
  }

  /** Report time to complete onboarding of a system (seconds) */
  async pushOnboardingDuration(system: string, timeSeconds: number): Promise<void> {
    await this.mc.pushMetrics(QualityIntelligence.JOB, 'system_onboarding_duration_seconds', timeSeconds, {
      system,
      environment: this.environment || 'unknown',
    });
  }

  /** Report time to complete synchronization of a product (seconds) */
  async pushSynchronizationDuration(product: string, timeSeconds: number): Promise<void> {
    await this.mc.pushMetrics(QualityIntelligence.JOB, 'product_synch_duration_seconds', timeSeconds, {
      system: product,
      environment: this.environment || 'unknown',
    });
  }
}
