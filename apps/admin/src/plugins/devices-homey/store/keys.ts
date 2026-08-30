import type { InjectionKey } from 'vue';

import type { useHomeyCloudAuthorization } from './homey-cloud-authorization.store';
import type { useHomeyInventory } from './homey-inventory.store';
import type { useHomeyStatus } from './homey-status.store';

export const homeyCloudAuthorizationStoreKey: InjectionKey<ReturnType<typeof useHomeyCloudAuthorization>> = Symbol(
	'devices_homey_plugin-cloud-authorization'
);
export const homeyInventoryStoreKey: InjectionKey<ReturnType<typeof useHomeyInventory>> = Symbol('devices_homey_plugin-inventory');
export const homeyStatusStoreKey: InjectionKey<ReturnType<typeof useHomeyStatus>> = Symbol('devices_homey_plugin-status');
