import type { InjectionKey } from 'vue';

import type { useProtectDiscovery } from './protect-discovery.store';
import type { useProtectStatus } from './protect-status.store';

export const protectStatusStoreKey: InjectionKey<ReturnType<typeof useProtectStatus>> = Symbol('devices_unifi_protect_plugin-status');
export const protectDiscoveryStoreKey: InjectionKey<ReturnType<typeof useProtectDiscovery>> = Symbol('devices_unifi_protect_plugin-discovery');
