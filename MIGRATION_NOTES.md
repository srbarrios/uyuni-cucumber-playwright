# MIGRATION_NOTES.md

This document tracks the Ruby → TypeScript migration for helpers in this repository and highlights notable differences, environment needs, and usage tips.

Scope and status
- Fully migrated to TypeScript
  - API clients: testsuite/helpers/api/{http_client.ts, xmlrpc_client.ts}
  - Namespaces (typed wrappers): actionchain, activationkey, api, audit, channel (software, appstreams), configchannel, image (profile, store), kickstart (profile, tree), schedule, system (config/custominfo/provisioning.powermanagement/scap/search), user
  - Core helpers: commonlib.ts parity functions completed; constants.ts, env.ts, keyvalue_store.ts, navigation_helper.ts
  - Network/System: network_utils.ts, system/remote_node.ts, system/remote_nodes_env.ts, system/system_monitoring.ts
  - Configuration helpers: configuration/{cobbler_test.ts, file_management.ts, kubernetes.ts, retail.ts}
  - Monitoring helpers: monitoring/{code_coverage.ts, metrics_collector_handler.ts, quality_intelligence.ts}

Notable differences vs Ruby
- Test runner and UI
  - CucumberJS + Playwright replaces Ruby Capybara flows; UI helpers are adapted to Playwright APIs (e.g., checkTextAndCatchRequestTimeoutPopup).
  - Ruby formatters (custom_formatter.rb, pretty_formatter.rb) are not ported; reporters are configured in config/cucumber.js.
- API lock behavior
  - Ruby used a file-based mutex (server_api_call.lock) to serialize admin user.* calls. TypeScript uses a single-process static lock in ApiTest (sufficient for this repo’s usage). If multi-process locking is desired later, we can add a file/flock-based approach.
- Package latest selection
  - navigation_helper.ts now compares version-release numerically (similar to Gem::Version) to find the latest package entry.
- Channel sync checks
  - channelIsSynced/channelSyncCompleted reproduce dumpsolv/primary.xml.gz/Release checks. The Ruby EMPTY_CHANNELS list is not explicitly enumerated; current logic is conservative when repo size is 0.
- YAML/xml
  - YAML parsing uses js-yaml. XML-RPC uses xmlrpc npm module; HTTP API uses axios.
- Metrics/Quality Intelligence
  - Prometheus Pushgateway used via HTTP PUT (text exposition format). Configure PROMETHEUS_PUSH_GATEWAY_URL if needed.

Environment and configuration
- Common env flags (see testsuite/helpers/core/env.ts):
  - SERVER (required for many helpers)
  - DEBUG, QUALITY_INTELLIGENCE, CODE_COVERAGE (requires REDIS_HOST), PROVIDER, CONTAINER_RUNTIME, TEST_ENV_NUMBER
- Metrics: PROMETHEUS_PUSH_GATEWAY_URL for QualityIntelligence; SERVER used as an environment label.
- Redis (optional): KeyValueStore utilities require REDIS_HOST/REDIS_PORT/REDIS_USERNAME/REDIS_PASSWORD.

Usage patterns
- Initialize API and set globally for helpers that access the API:
  - setGlobalApiTest(createApiTest(process.env.SERVER || '', /* useHttp? */ true|false))
  - Namespaces are typed classes (e.g., apiTest.system.search_by_name, apiTest.channel.software.list_user_repos).
- UI helpers (Playwright): clickLinkAndWait, clickLinkOrButtonAndWait, checkTextAndCatchRequestTimeoutPopup, etc.
- System/Network helpers: RemoteNode.run/runLocal/scpUpload/scpDownload; network_utils.ts for raw SSH/SCP commands.
- Configuration helpers: CobblerTest (XML-RPC), file management, Kubernetes cert-manager flows, retail YAML readers and image/profile utilities.
- Monitoring: CodeCoverage (XML parsing + Redis), MetricsCollectorHandler (Pushgateway), QualityIntelligence.

Known gaps/notes
- Ruby-only formatters are intentionally not ported.
- If you need multi-process API locking, we can extend ApiTest to use a file lock on disk.
- The channel sync heuristics match common patterns; if you rely on a curated EMPTY_CHANNELS list, we can add a constants_extended mapping and hook it into channelIsSynced.

Contributing tips
- When adding new API calls, prefer extending the typed namespace class that matches the Ruby structure.
- Keep environment-variable-based behavior centralized in env.ts and consume via helpers.
- Prefer Playwright’s locator semantics in new UI helpers (auto-waiting, role-based selectors).