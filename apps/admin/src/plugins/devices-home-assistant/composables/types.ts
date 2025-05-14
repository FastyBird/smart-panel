import type { ComputedRef, Ref } from 'vue';

import type { IHomeAssistantDiscoveredDevice } from '../store/home-assistant-discovered-devices.store.types';
import type { IHomeAssistantState } from '../store/home-assistant-states.store.types';

export interface IDiscoveredDevicesFilter {
	search: string | undefined;
	adopted: boolean | undefined;
}

export interface IStatesFilter {
	search: string | undefined;
	lastChangedFrom: Date | undefined;
	lastChangedTo: Date | undefined;
	lastReportedFrom: Date | undefined;
	lastReportedTo: Date | undefined;
	lastUpdatedFrom: Date | undefined;
	lastUpdatedTo: Date | undefined;
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

export interface IUseState {
	state: ComputedRef<IHomeAssistantState | null>;
	isLoading: ComputedRef<boolean>;
	fetchState: () => Promise<void>;
}

export interface IUseStates {
	states: ComputedRef<IHomeAssistantState[]>;
	areLoading: ComputedRef<boolean>;
	loaded: ComputedRef<boolean>;
	fetchStates: () => Promise<void>;
}

export interface IUseStatesDataSource {
	states: ComputedRef<IHomeAssistantState[]>;
	statesPaginated: ComputedRef<IHomeAssistantState[]>;
	totalRows: ComputedRef<number>;
	areLoading: ComputedRef<boolean>;
	loaded: ComputedRef<boolean>;
	fetchStates: () => Promise<void>;
	filters: Ref<IStatesFilter>;
	filtersActive: ComputedRef<boolean>;
	paginateSize: Ref<number>;
	paginatePage: Ref<number>;
	sortBy: Ref<'entityId' | 'lastChanged' | 'lastReported' | 'lastUpdated'>;
	sortDir: Ref<'ascending' | 'descending' | null>;
	resetFilter: () => void;
}

export interface IUseDiscoveredDevicesOptions {
	devicesOptions: ComputedRef<{ value: IHomeAssistantDiscoveredDevice['id']; label: IHomeAssistantDiscoveredDevice['name'] }[]>;
	areLoading: ComputedRef<boolean>;
}

export interface IUseEntitiesOptions {
	entitiesOptions: ComputedRef<{ value: IHomeAssistantState['entityId']; label: IHomeAssistantState['entityId'] | string }[]>;
	areLoading: ComputedRef<boolean>;
}

export interface IUseAttributesOptions {
	attributesOptions: ComputedRef<{ value: string; label: string }[]>;
	isLoading: ComputedRef<boolean>;
}
