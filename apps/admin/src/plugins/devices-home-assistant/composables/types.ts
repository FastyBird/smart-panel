import type { ComputedRef, Ref } from 'vue';

import type { IHomeAssistantDiscoveredDevice } from '../store/home-assistant-discovered-devices.store.types';

export interface IDiscoveredDevicesFilter {
	search: string | undefined;
	adopted: boolean | undefined;
}

export interface IUseDiscoveredDevice {
	device: ComputedRef<IHomeAssistantDiscoveredDevice | null>;
	isLoading: ComputedRef<boolean>;
	fetchDevice: () => Promise<void>;
}

export interface IUseDiscoveredDevices {
	devices: ComputedRef<IHomeAssistantDiscoveredDevice[]>;
	areLoading: ComputedRef<boolean>;
	loaded: ComputedRef<boolean>;
	fetchDiscoveredDevices: () => Promise<void>;
}

export interface IUseDiscoveredDevicesDataSource {
	discoveredDevices: ComputedRef<IHomeAssistantDiscoveredDevice[]>;
	discoveredDevicesPaginated: ComputedRef<IHomeAssistantDiscoveredDevice[]>;
	totalRows: ComputedRef<number>;
	areLoading: ComputedRef<boolean>;
	loaded: ComputedRef<boolean>;
	fetchDiscoveredDevices: () => Promise<void>;
	filters: Ref<IDiscoveredDevicesFilter>;
	filtersActive: ComputedRef<boolean>;
	paginateSize: Ref<number>;
	paginatePage: Ref<number>;
	sortBy: Ref<'name' | 'adoptedDeviceId'>;
	sortDir: Ref<'ascending' | 'descending' | null>;
	resetFilter: () => void;
}
