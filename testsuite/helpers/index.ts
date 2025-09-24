// Copyright (c) 2025 SUSE LLC.
// Licensed under the terms of the MIT license.

// Export core utilities
export * from './core/constants';
export * from './core/constants_extended';
export * from './core/commonlib';
export * from './core/env';
export * from './core/keyvalue_store';

// Export API utilities
export * from './api/http_client';
export * from './api/xmlrpc_client';
export * from './api/api_test';

// Export network utilities
export * from './network/network_utils';

// Export system utilities
export * from './system/remote_node';
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
} from './system/remote_nodes_env';
export * from './system/system_monitoring';

// Export configuration helpers
export * from './configuration/file_management';
export * from './configuration/kubernetes';
export * from './configuration/retail';
export { CobblerTest } from './configuration/cobbler_test';

// Export namespace utilities
export * from './namespaces/api';

// Export monitoring helpers
export * from './monitoring/code_coverage';
export * from './monitoring/metrics_collector_handler';
export * from './monitoring/quality_intelligence';
export * from './namespaces/channel';
export * from './namespaces/actionchain';
export * from './namespaces/activationkey';
export * from './namespaces/audit';
export * from './namespaces/configchannel';
export * from './namespaces/image';
export * from './namespaces/kickstart';
export * from './namespaces/schedule';
export * from './namespaces/system';
export * from './namespaces/user';

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
} from './core/constants';

export type {
  ChannelSyncMapping,
  TimeoutByChannel,
  PkgArchByClient
} from './core/constants_extended';

export type {
  UptimeInfo,
  TimeoutOptions,
  CommandResult as CommonLibCommandResult
} from './core/commonlib';

export type {
  EnvironmentConfig,
  TestTimeout,
  GlobalVariables
} from './core/env';

export type {
  ApiCallResult,
  CallParams
} from './api/http_client';

export type {
  SshResult,
  SshOptions
} from './network/network_utils';

export type {
  CommandResult,
  OsInfo,
  RunOptions
} from './system/remote_node';

export type {
  NodeRegistries,
  SccCredentials,
  CustomRepositories
} from './system/remote_nodes_env';

export type {
  BootstrapDuration,
  OnboardingDuration,
  SynchronizationDuration,
  SystemEvent
} from './system/system_monitoring';

export type {
  KeyValueStoreConfig
} from './core/keyvalue_store';

export type {
  XmlrpcParams
} from './api/xmlrpc_client';

export type {
  INamespaceActionchain,
  INamespaceActivationkey,
  INamespaceApi,
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
} from './api/api_test';

export type {
  ApiNamespace,
  ApiCall
} from './namespaces/api';
