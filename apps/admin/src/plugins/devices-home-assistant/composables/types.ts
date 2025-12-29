import type { ComputedRef, Reactive, Ref } from 'vue';

import type { FormInstance } from 'element-plus';

import type { FormResultType, IDevice } from '../../../modules/devices';
import type { DevicesModuleDeviceCategory } from '../../../openapi.constants';
import type { IAdoptDeviceRequest, IMappingEntityOverride, IMappingPreviewRequest, IMappingPreviewResponse } from '../schemas/mapping-preview.types';
import type { IHomeAssistantDiscoveredDevice } from '../store/home-assistant-discovered-devices.store.types';
import type { IHomeAssistantDiscoveredHelper } from '../store/home-assistant-discovered-helpers.store.types';
import type { IHomeAssistantState } from '../store/home-assistant-states.store.types';
import type { IDeviceAddForm } from '../../../modules/devices/schemas/devices.types';

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

export interface IUseDiscoveredHelpers {
	helpers: ComputedRef<IHomeAssistantDiscoveredHelper[]>;
	areLoading: ComputedRef<boolean>;
	fetchDiscoveredHelpers: () => Promise<void>;
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

export interface IDiscoveryOptionGroup {
	label: string;
	options: { value: string; label: string; type: 'device' | 'helper' }[];
}

export interface IUseDiscoveredItemsOptions {
	itemsOptions: ComputedRef<IDiscoveryOptionGroup[]>;
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

export interface IUseMappingPreview {
	preview: Ref<IMappingPreviewResponse | null>;
	isLoading: Ref<boolean>;
	error: Ref<Error | null>;
	fetchPreview: (haDeviceId: string, overrides?: IMappingPreviewRequest) => Promise<IMappingPreviewResponse>;
	updatePreview: (haDeviceId: string, overrides: IMappingPreviewRequest) => Promise<IMappingPreviewResponse>;
	clearPreview: () => void;
}

export interface IUseDeviceAdoption {
	isAdopting: Ref<boolean>;
	error: Ref<Error | null>;
	adoptDevice: (request: IAdoptDeviceRequest) => Promise<IDevice>;
}

export interface IUseDeviceAddForm<TForm extends IDeviceAddForm = IDeviceAddForm> {
	categoriesOptions: ComputedRef<{ value: DevicesModuleDeviceCategory; label: string }[]>;
	activeStep: Ref<'one' | 'two' | 'three' | 'four' | 'five'>;
	reachedSteps: Ref<Set<'one' | 'two' | 'three' | 'four' | 'five'>>;
	preview: Ref<IMappingPreviewResponse | null>;
	suggestedCategory: Ref<DevicesModuleDeviceCategory | null>;
	isPreviewLoading: Ref<boolean>;
	previewError: Ref<Error | null>;
	isAdopting: Ref<boolean>;
	adoptionError: Ref<Error | null>;
	itemsOptions: ComputedRef<IDiscoveryOptionGroup[]>;
	itemsOptionsLoading: ComputedRef<boolean>;
	entityOverrides: Ref<IMappingEntityOverride[] | undefined>;
	model: Reactive<TForm>;
	stepOneFormEl: Ref<FormInstance | undefined>;
	stepTwoFormEl: Ref<FormInstance | undefined>;
	stepThreeFormEl: Ref<FormInstance | undefined>;
	stepFourFormEl: Ref<FormInstance | undefined>;
	stepFiveFormEl: Ref<FormInstance | undefined>;
	formChanged: Ref<boolean>;
	submitStep: (step: 'one' | 'two' | 'three' | 'four' | 'five', formEl?: FormInstance) => Promise<'ok' | 'added'>;
	clear: () => void;
	clearPreview: () => void;
	formResult: Ref<FormResultType>;
}
