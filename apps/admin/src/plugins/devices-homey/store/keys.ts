import type { InjectionKey } from 'vue';

import type { useHomeyInventory } from './homey-inventory.store';
import type { useHomeyStatus } from './homey-status.store';

export const homeyInventoryStoreKey: InjectionKey<ReturnType<typeof useHomeyInventory>> = Symbol('devices_homey_plugin-inventory');
export const homeyStatusStoreKey: InjectionKey<ReturnType<typeof useHomeyStatus>> = Symbol('devices_homey_plugin-status');
