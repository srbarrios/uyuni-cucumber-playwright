// Copyright (c) 2025 SUSE LLC.
// Licensed under the terms of the MIT license.

// Export core utilities
export * from './core/constants.js';
export * from './core/commonlib.js';
export * from './core/env.js';
export * from './core/keyvalue_store.js';

// Export API utilities
export * from './api/http_client.js';
export * from './api/xmlrpc_client.js';
export * from './api/api_test.js';

// Export network utilities
export * from './network/network_utils.js';

// Export system utilities
export * from './system/remote_node.js';
export {
    getTarget,
    getAllNodes,
    getNodeByHostname,
    getHostByNode,
    getNamedNodes,
    isHostDefined,
    getSccCredentials,
    getCustomRepositoriesFromEnv,
    hasCustomRepositories,
    cleanupNodes,
    getEnvironmentVariable,
    getAvailableHosts,
    initializeNode
} from './system/remote_nodes_env.js';
export * from './system/system_monitoring.js';

// Export configuration helpers
export * from './configuration/file_management.js';
export * from './configuration/kubernetes.js';
export * from './configuration/retail.js';
export {default as CobblerTest} from './configuration/cobbler_test.js'

// Export namespace utilities
export * from './namespaces/api.js';

// Export monitoring helpers
export * from './monitoring/code_coverage.js';
export * from './monitoring/metrics_collector_handler.js';
export * from './monitoring/quality_intelligence.js';
export * from './namespaces/channel.js';
export * from './namespaces/actionchain.js';
export * from './namespaces/activationkey.js';
export * from './namespaces/audit.js';
export * from './namespaces/configchannel.js';
export * from './namespaces/image.js';
export * from './namespaces/kickstart.js';
export * from './namespaces/schedule.js';
export * from './namespaces/system.js';
export * from './namespaces/user.js';

// Re-export commonly used interfaces and types
export type {
    HostMapping,
    PrivateAddresses,
    FieldIds,
    BoxIds,
    BulletStyle,
    PackageByClient,
    BaseChannelByClient,
    LabelByBaseChannel
} from './core/constants.js';

export type {
    ChannelSyncMapping,
    TimeoutByChannel,
    PkgArchByClient
} from './core/constants.js';

export type {
    UptimeInfo,
    TimeoutOptions,
    CommandResult as CommonLibCommandResult
} from './core/commonlib.js';

export type {
    EnvironmentConfig,
    TestTimeout,
    GlobalVariables
} from './core/env.js';

export type {
    ApiCallResult,
    CallParams
} from './api/http_client.js';

export type {
    SshResult,
    SshOptions
} from './network/network_utils.js';

export type {
    CommandResult,
    OsInfo,
    RunOptions
} from './system/remote_node.js';

export type {
    SccCredentials,
    CustomRepositories
} from './system/remote_nodes_env.js';

export type {
    BootstrapDuration,
    OnboardingDuration,
    SynchronizationDuration,
    SystemEvent
} from './system/system_monitoring.js';

export type {
    KeyValueStoreConfig
} from './core/keyvalue_store.js';

export type {
    XmlrpcParams
} from './api/xmlrpc_client.js';

export type {
    INamespaceActionchain,
    INamespaceActivationkey,
    INamespaceAudit,
    INamespaceChannel,
    INamespaceConfigchannel,
    INamespaceImage,
    INamespaceKickstart,
    INamespaceSchedule,
    INamespaceSystem,
    INamespaceUser,
    ApiConnection,
    ApiCallParams
} from './api/api_test.js';

export type {
    ApiNamespace,
    ApiCall
} from './namespaces/api.js';
