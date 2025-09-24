// Copyright (c) 2019-2025 SUSE LLC
// Licensed under the terms of the MIT license.

// Extended constants that are too large to fit in the main constants.ts file
// These are the remaining large constant objects from the Ruby version

export interface ChannelSyncMapping {
  [productType: string]: {
    [productVersion: string]: string[];
  };
}

export interface TimeoutByChannel {
  [channelName: string]: number;
}

export interface PkgArchByClient {
  [clientType: string]: string;
}

// Used for creating activation keys
// The keys are the values of BASE_CHANNEL_BY_CLIENT
// SUMA: The values can be found under Admin -> Setup Wizard -> Products
// Select the desired product and have a look at its product channels
// The required product has to be synced before
// Uyuni: You have to use `spacewalk-common-channels -l` to get the proper values
// NOTE: To avoid duplicate symbol conflicts with core/constants.ts, this extended mapping is
// exported under a different name. Prefer importing LABEL_BY_BASE_CHANNEL from core/constants.
export const LABEL_BY_BASE_CHANNEL_EXT = {
  'SUSE Manager': {
    'SLE-Product-SUSE-Manager-Proxy-4.3-Pool for x86_64': 'sle-product-suse-manager-proxy-4.3-pool-x86_64',
    'SLES12-SP5-Pool for x86_64': 'sles12-sp5-pool-x86_64',
    'SLE-Product-SLES15-SP3-Pool for x86_64': 'sle-product-sles15-sp3-pool-x86_64',
    'SLE-Product-SLES15-SP4-Pool for x86_64': 'sle-product-sles15-sp4-pool-x86_64',
    'SLE-Product-SLES15-SP5-Pool for x86_64': 'sle-product-sles15-sp5-pool-x86_64',
    'SLE-Product-SLES15-SP6-Pool for x86_64': 'sle-product-sles15-sp6-pool-x86_64',
    'SLE-Product-SLES15-SP7-Pool for x86_64': 'sle-product-sles15-sp7-pool-x86_64',
    'SLE-Product-SLES15-SP5-Pool for s390x': 'sle-product-sles15-sp5-pool-s390x',
    'SUSE-MicroOS-5.1-Pool for x86_64': 'suse-microos-5.1-pool-x86_64',
    'SUSE-MicroOS-5.2-Pool for x86_64': 'suse-microos-5.2-pool-x86_64',
    'SLE-Micro-5.3-Pool for x86_64': 'sle-micro-5.3-pool-x86_64',
    'SLE-Micro-5.4-Pool for x86_64': 'sle-micro-5.4-pool-x86_64',
    'SLE-Micro-5.5-Pool for x86_64': 'sle-micro-5.5-pool-x86_64',
    'SL-Micro-6.0-Pool for x86_64': 'sl-micro-6.0-pool-x86_64',
    'SL-Micro-6.1-Pool for x86_64': 'sl-micro-6.1-pool-x86_64',
    'almalinux8 for x86_64': 'almalinux8-x86_64',
    'almalinux9 for x86_64': 'almalinux9-x86_64',
    'amazonlinux2023 for x86_64': 'amazonlinux2023-x86_64',
    'Fake-Base-Channel-SUSE-like': 'fake-base-channel-suse-like',
    'RHEL x86_64 Server 7': 'rhel-x86_64-server-7',
    'EL9-Pool for x86_64': 'el9-pool-x86_64',
    'oraclelinux9 for x86_64': 'oraclelinux9-x86_64',
    'rockylinux-8 for x86_64': 'rockylinux-8-x86_64',
    'rockylinux-9 for x86_64': 'rockylinux-9-x86_64',
    'ubuntu-2004-amd64-main for amd64': 'ubuntu-2004-amd64-main-amd64',
    'ubuntu-2204-amd64-main for amd64': 'ubuntu-2204-amd64-main-amd64',
    'ubuntu-2404-amd64-main for amd64': 'ubuntu-2404-amd64-main-amd64',
    'debian-12-pool for amd64': 'debian-12-pool-amd64',
    'openSUSE-Leap-15.6-Pool for aarch64': 'opensuse-leap-15.6-pool-aarch64'
  },
  'Uyuni': {
    'openSUSE Leap 15.6 (x86_64)': 'opensuse_leap15_6-x86_64',
    'openSUSE Leap Micro 5.5 (x86_64)': 'opensuse_micro5_5-x86_64',
    'SLES12-SP5-Pool for x86_64': 'sles12-sp5-pool-x86_64',
    'SLE-Product-SLES15-SP3-Pool for x86_64': 'sle-product-sles15-sp3-pool-x86_64',
    'SLE-Product-SLES15-SP4-Pool for x86_64': 'sle-product-sles15-sp4-pool-x86_64',
    'SLE-Product-SLES15-SP5-Pool for x86_64': 'sle-product-sles15-sp5-pool-x86_64',
    'SLE-Product-SLES15-SP6-Pool for x86_64': 'sle-product-sles15-sp6-pool-x86_64',
    'SLE-Product-SLES15-SP7-Pool for x86_64': 'sle-product-sles15-sp7-pool-x86_64',
    'SLE-Product-SLES15-SP5-Pool for s390x': 'sle-product-sles15-sp5-pool-s390x',
    'SUSE-MicroOS-5.1-Pool for x86_64': 'suse-microos-5.1-pool-x86_64',
    'SUSE-MicroOS-5.2-Pool for x86_64': 'suse-microos-5.2-pool-x86_64',
    'SLE-Micro-5.3-Pool for x86_64': 'sle-micro-5.3-pool-x86_64',
    'SLE-Micro-5.4-Pool for x86_64': 'sle-micro-5.4-pool-x86_64',
    'SLE-Micro-5.5-Pool for x86_64': 'sle-micro-5.5-pool-x86_64',
    'SL-Micro-6.0-Pool for x86_64': 'sl-micro-6.0-pool-x86_64',
    'SL-Micro-6.1-Pool for x86_64': 'sl-micro-6.1-pool-x86_64',
    'AlmaLinux 8 (x86_64)': 'almalinux8-x86_64',
    'AlmaLinux 9 (x86_64)': 'almalinux9-x86_64',
    'Amazon Linux 2023 x86_64': 'amazonlinux2023-x86_64',
    'Fake-Base-Channel-SUSE-like': 'fake-base-base-channel-suse-like',
    'CentOS 7 (x86_64)': 'centos7-x86_64',
    'EL9-Pool for x86_64': 'el9-pool-x86_64',
    'Oracle Linux 9 (x86_64)': 'oraclelinux9-x86_64',
    'Rocky Linux 8 (x86_64)': 'rockylinux8-x86_64',
    'Rocky Linux 9 (x86_64)': 'rockylinux9-x86_64',
    'Ubuntu 20.04 LTS AMD64 Base for Uyuni': 'ubuntu-2004-pool-amd64-uyuni',
    'Ubuntu 22.04 LTS AMD64 Base for Uyuni': 'ubuntu-2204-pool-amd64-uyuni',
    'Ubuntu 24.04 LTS AMD64 Base for Uyuni': 'ubuntu-2404-pool-amd64-uyuni',
    'Debian 12 (bookworm) pool for amd64 for Uyuni': 'debian-12-pool-amd64-uyuni',
    'openSUSE Leap 15.6 (aarch64)': 'opensuse_leap15_6-aarch64'
  }
} as const;

export const PKGARCH_BY_CLIENT: PkgArchByClient = {
  'proxy': 'x86_64',
  'sle_minion': 'x86_64',
  'ssh_minion': 'x86_64',
  'rhlike_minion': 'x86_64',
  'deblike_minion': 'amd64',
  'sle12sp5_minion': 'x86_64',
  'sle12sp5_ssh_minion': 'x86_64',
  'sle15_ssh_minion': 'x86_64',
  'sle15sp3_minion': 'x86_64',
  'sle15sp3_ssh_minion': 'x86_64',
  'sle15sp4_minion': 'x86_64',
  'sle15sp4_ssh_minion': 'x86_64',
  'sle15sp5_minion': 'x86_64',
  'sle15sp5_ssh_minion': 'x86_64',
  'sle15sp6_minion': 'x86_64',
  'sle15sp6_ssh_minion': 'x86_64',
  'sle15sp7_minion': 'x86_64',
  'sle15sp7_ssh_minion': 'x86_64',
  'slemicro51_minion': 'x86_64',
  'slemicro51_ssh_minion': 'x86_64',
  'slemicro52_minion': 'x86_64',
  'slemicro52_ssh_minion': 'x86_64',
  'slemicro53_minion': 'x86_64',
  'slemicro53_ssh_minion': 'x86_64',
  'slemicro54_minion': 'x86_64',
  'slemicro54_ssh_minion': 'x86_64',
  'slemicro55_minion': 'x86_64',
  'slemicro55_ssh_minion': 'x86_64',
  'slmicro60_minion': 'x86_64',
  'slmicro60_ssh_minion': 'x86_64',
  'slmicro61_minion': 'x86_64',
  'slmicro61_ssh_minion': 'x86_64',
  'alma8_minion': 'x86_64',
  'alma8_ssh_minion': 'x86_64',
  'alma9_minion': 'x86_64',
  'alma9_ssh_minion': 'x86_64',
  'amazon2023_minion': 'x86_64',
  'amazon2023_ssh_minion': 'x86_64',
  'centos7_minion': 'x86_64',
  'centos7_ssh_minion': 'x86_64',
  'liberty9_minion': 'x86_64',
  'liberty9_ssh_minion': 'x86_64',
  'oracle9_minion': 'x86_64',
  'oracle9_ssh_minion': 'x86_64',
  'rhel9_minion': 'x86_64',
  'rhel9_ssh_minion': 'x86_64',
  'rocky8_minion': 'x86_64',
  'rocky8_ssh_minion': 'x86_64',
  'rocky9_minion': 'x86_64',
  'rocky9_ssh_minion': 'x86_64',
  'ubuntu2004_minion': 'amd64',
  'ubuntu2004_ssh_minion': 'amd64',
  'ubuntu2204_minion': 'amd64',
  'ubuntu2204_ssh_minion': 'amd64',
  'ubuntu2404_minion': 'amd64',
  'ubuntu2404_ssh_minion': 'amd64',
  'debian12_minion': 'amd64',
  'debian12_ssh_minion': 'amd64',
  'opensuse156arm_minion': 'aarch64',
  'opensuse156arm_ssh_minion': 'aarch64',
  'sle15sp5s390_minion': 's390x',
  'sle15sp5s390_ssh_minion': 's390x'
} as const;

// The timeouts are determining experimentally, by looking at the files in /var/log/rhn/reposync on the server
// Formula: (end date - startup date) * 2, rounded to upper 60 seconds
// Please keep this list sorted alphabetically
export const TIMEOUT_BY_CHANNEL_NAME: TimeoutByChannel = {
  'almalinux8-appstream-x86_64': 1680,
  'almalinux8-uyuni-client-devel-x86_64': 60,
  'almalinux8-x86_64': 900,
  'almalinux8-x86_64-appstream': 1740,
  'almalinux8-x86_64-extras': 60,
  'almalinux9-appstream-x86_64': 1260,
  'almalinux9-uyuni-client-devel-x86_64': 60,
  'almalinux9-x86_64': 540,
  'almalinux9-x86_64-appstream': 720,
  'almalinux9-x86_64-extras': 60,
  'amazonlinux2023-uyuni-client-devel-x86_64': 60,
  'amazonlinux2023-x86_64': 3120,
  'centos-7-iso': 540,
  'centos7-uyuni-client-devel-x86_64': 60,
  'centos7-x86_64': 960,
  'centos7-x86_64-extras': 120,
  'debian-12-amd64-main-security-uyuni': 240,
  'debian-12-amd64-main-updates-uyuni': 120,
  'debian-12-amd64-uyuni-client-devel': 60,
  'debian-12-main-security-amd64': 480,
  'debian-12-main-updates-amd64': 120,
  'debian-12-pool-amd64': 27960,
  'debian-12-pool-amd64-uyuni': 28260,
  'devel-build-host-channel': 120,
  'devel-debian-like-channel': 120,
  'devel-rh-like-channel': 120,
  'devel-suse-channel': 120,
  'el9-pool-x86_64': 60,
  'fake-base-channel-appstream': 360,
  'fake-base-channel-debian-like': 300,
  'fake-base-channel-rh-like': 360,
  'fake-child-channel-i586': 300,
  'fake-child-channel-suse-like': 240,
  'fake-rpm-suse-channel': 120,
  'fake-rpm-terminal-channel': 360
} as const;

export const EMPTY_CHANNELS = [
  'suse-multi-linux-manager-proxy-sle-5.1-updates-x86_64-sp7',
  'suse-multi-linux-manager-proxy-sle-5.2-updates-x86_64-sp7',
  'suse-multi-linux-manager-retail-branch-server-sle-5.1-updates-x86_64-sp7',
  'suse-multi-linux-manager-retail-branch-server-sle-5.2-updates-x86_64-sp7',
  'managertools-sle15-updates-x86_64-sp7',
  'suse-manager-proxy-5.0-updates-x86_64',
  'suse-manager-retail-branch-server-5.0-updates-x86_64',
  'sle-module-suse-manager-retail-branch-server-4.3-updates-x86_64',
  'fake-base-channel-suse-like',
  'fake-base-channel-i586',
  'test-base-channel-x86_64',
  'managertools-sle15-updates-x86_64-sp4',
  'managertools-beta-sle15-updates-x86_64-sp4'
] as const;