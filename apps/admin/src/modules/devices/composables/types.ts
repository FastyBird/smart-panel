import type { ComputedRef, Ref } from 'vue';

import type { FormInstance } from 'element-plus';

import type { IPlugin } from '../../../common';
import {
	DevicesModuleChannelCategory,
	DevicesModuleChannelPropertyCategory,
	DevicesModuleChannelPropertyData_type,
	DevicesModuleChannelPropertyPermissions,
	DevicesModuleDeviceCategory,
} from '../../../openapi';
import type { ConnectionState, FormResultType } from '../devices.constants';
import type { IPluginsComponents, IPluginsSchemas } from '../devices.types';
import type { IChannelProperty } from '../store/channels.properties.store.types';
import type { IChannel } from '../store/channels.store.types';
import type { IDevice } from '../store/devices.store.types';

export interface IChannelsFilter {
	search: string | undefined;
	devices: IDevice['id'][];
	categories: DevicesModuleChannelCategory[];
}

export interface IChannelAddForm {
	id: IChannel['id'];
	device?: IDevice['id'];
	category?: DevicesModuleChannelCategory;
	name: string;
	description: string;
}

export interface IChannelEditForm {
	id: IChannel['id'];
	device: IDevice['id'];
	category: DevicesModuleChannelCategory;
	name: string;
	description: string;
}

export interface IChannelsPropertiesFilter {
	search: string | undefined;
	channels: IChannel['id'][];
	categories: DevicesModuleChannelPropertyCategory[];
	permissions: DevicesModuleChannelPropertyPermissions[];
	dataTypes: DevicesModuleChannelPropertyData_type[];
}

export interface IChannelPropertyAddForm {
	id: IChannelProperty['id'];
	channel?: IChannel['id'];
	category?: DevicesModuleChannelPropertyCategory;
	name: string;
	permissions: DevicesModuleChannelPropertyPermissions[];
	dataType: DevicesModuleChannelPropertyData_type;
	unit: string;
	format: string[] | number[] | null;
	invalid: string;
	step: string;
	enumValues: string[];
	minValue: string;
	maxValue: string;
}

export interface IChannelPropertyEditForm {
	id: IChannelProperty['id'];
	channel: IChannel['id'];
	category: DevicesModuleChannelPropertyCategory;
	name: string;
	permissions: DevicesModuleChannelPropertyPermissions[];
	dataType: DevicesModuleChannelPropertyData_type;
	unit: string;
	format: string[] | number[] | null;
	invalid: string;
	step: string;
	enumValues: string[];
	minValue: string;
	maxValue: string;
}

export interface IDevicesFilter {
	search: string | undefined;
	types: IPlugin['type'][];
	state: 'all' | 'offline' | 'online';
	states: ConnectionState[];
	categories: DevicesModuleDeviceCategory[];
}

export interface IDeviceAddForm {
	id: IDevice['id'];
	type: string;
	category: DevicesModuleDeviceCategory;
	name: string;
	description: string;
}

export interface IDeviceEditForm {
	id: IDevice['id'];
	type: string;
	category: DevicesModuleDeviceCategory;
	name: string;
	description: string;
}

export interface IUseChannel {
	channel: ComputedRef<IChannel | null>;
	isLoading: ComputedRef<boolean>;
	fetchChannel: () => Promise<void>;
}

export interface IUseChannels {
	channels: ComputedRef<IChannel[]>;
	areLoading: ComputedRef<boolean>;
	loaded: ComputedRef<boolean>;
	fetchChannels: () => Promise<void>;
}

export interface IUseChannelsDataSource {
	channels: ComputedRef<IChannel[]>;
	channelsPaginated: ComputedRef<IChannel[]>;
	totalRows: ComputedRef<number>;
	areLoading: ComputedRef<boolean>;
	loaded: ComputedRef<boolean>;
	fetchChannels: () => Promise<void>;
	filters: Ref<IChannelsFilter>;
	filtersActive: ComputedRef<boolean>;
	paginateSize: Ref<number>;
	paginatePage: Ref<number>;
	sortBy: Ref<'name' | 'description' | 'category'>;
	sortDir: Ref<'ascending' | 'descending' | null>;
	resetFilter: () => void;
}

export interface IUseChannelsActions {
	remove: (id: IChannel['id']) => Promise<void>;
}

export interface IUseChannelIcon {
	icon: ComputedRef<string>;
}

export interface IUseChannelSpecification {
	canAddAnotherProperty: ComputedRef<boolean>;
	missingRequiredProperties: ComputedRef<DevicesModuleChannelPropertyCategory[]>;
}

export interface IUseChannelAddForm {
	categoriesOptions: ComputedRef<{ value: DevicesModuleChannelCategory; label: string }[]>;
	devicesOptions: ComputedRef<{ value: IDevice['id']; label: string }[]>;
	model: IChannelAddForm;
	formEl: Ref<FormInstance | undefined>;
	formChanged: Ref<boolean>;
	submit: () => Promise<'added'>;
	clear: () => void;
	formResult: Ref<FormResultType>;
	loadingDevices: ComputedRef<boolean>;
}

export interface IUseChannelEditForm {
	categoriesOptions: ComputedRef<{ value: DevicesModuleChannelCategory; label: string }[]>;
	devicesOptions: ComputedRef<{ value: IDevice['id']; label: string }[]>;
	model: IChannelEditForm;
	formEl: Ref<FormInstance | undefined>;
	formChanged: Ref<boolean>;
	submit: () => Promise<'added' | 'saved'>;
	clear: () => void;
	formResult: Ref<FormResultType>;
	loadingDevices: ComputedRef<boolean>;
}

export interface IUseChannelProperty {
	property: ComputedRef<IChannelProperty | null>;
	isLoading: ComputedRef<boolean>;
	fetchProperty: () => Promise<void>;
}

export interface IUseChannelsProperties {
	properties: ComputedRef<IChannelProperty[]>;
	areLoading: ComputedRef<boolean>;
	loaded: ComputedRef<boolean>;
	fetchProperties: () => Promise<void>;
}

export interface IUseChannelsPropertiesDataSource {
	properties: ComputedRef<IChannelProperty[]>;
	propertiesPaginated: ComputedRef<IChannelProperty[]>;
	totalRows: ComputedRef<number>;
	areLoading: ComputedRef<boolean>;
	loaded: ComputedRef<boolean>;
	fetchProperties: () => Promise<void>;
	filters: Ref<IChannelsPropertiesFilter>;
	filtersActive: ComputedRef<boolean>;
	paginateSize: Ref<number>;
	paginatePage: Ref<number>;
	sortBy: Ref<'name' | 'category'>;
	sortDir: Ref<'ascending' | 'descending' | null>;
	resetFilter: () => void;
}

export interface IUseChannelsPropertiesActions {
	remove: (id: IChannelProperty['id']) => Promise<void>;
}

export interface IUseChannelPropertyIcon {
	icon: ComputedRef<string>;
}

export interface IUseChannelPropertyAddForm {
	categoriesOptions: ComputedRef<{ value: DevicesModuleChannelPropertyCategory; label: string }[]>;
	channelsOptions: ComputedRef<{ value: IChannel['id']; label: string }[]>;
	permissionsOptions: { value: DevicesModuleChannelPropertyPermissions; label: string }[];
	dataTypesOptions: { value: DevicesModuleChannelPropertyData_type; label: string }[];
	model: IChannelPropertyAddForm;
	formEl: Ref<FormInstance | undefined>;
	formChanged: Ref<boolean>;
	submit: () => Promise<'added'>;
	clear: () => void;
	formResult: Ref<FormResultType>;
	loadingChannels: ComputedRef<boolean>;
}

export interface IUseChannelPropertyEditForm {
	categoriesOptions: ComputedRef<{ value: DevicesModuleChannelPropertyCategory; label: string }[]>;
	channelsOptions: ComputedRef<{ value: IChannel['id']; label: string }[]>;
	permissionsOptions: { value: DevicesModuleChannelPropertyPermissions; label: string }[];
	dataTypesOptions: { value: DevicesModuleChannelPropertyData_type; label: string }[];
	model: IChannelPropertyEditForm;
	formEl: Ref<FormInstance | undefined>;
	formChanged: Ref<boolean>;
	submit: () => Promise<'added' | 'saved'>;
	clear: () => void;
	formResult: Ref<FormResultType>;
	loadingChannels: ComputedRef<boolean>;
}

export interface IUseDevice {
	device: ComputedRef<IDevice | null>;
	isLoading: ComputedRef<boolean>;
	fetchDevice: () => Promise<void>;
}

export interface IUseDevices {
	devices: ComputedRef<IDevice[]>;
	areLoading: ComputedRef<boolean>;
	loaded: ComputedRef<boolean>;
	fetchDevices: () => Promise<void>;
}

export interface IUseDevicesDataSource {
	devices: ComputedRef<IDevice[]>;
	devicesPaginated: ComputedRef<IDevice[]>;
	totalRows: ComputedRef<number>;
	areLoading: ComputedRef<boolean>;
	loaded: ComputedRef<boolean>;
	fetchDevices: () => Promise<void>;
	filters: Ref<IDevicesFilter>;
	filtersActive: ComputedRef<boolean>;
	paginateSize: Ref<number>;
	paginatePage: Ref<number>;
	sortBy: Ref<'name' | 'description' | 'type' | 'category'>;
	sortDir: Ref<'ascending' | 'descending' | null>;
	resetFilter: () => void;
}

export interface IUseDevicesActions {
	remove: (id: IDevice['id']) => Promise<void>;
}

export interface IUseDeviceIcon {
	icon: ComputedRef<string>;
}

export interface IUseDeviceSpecification {
	canAddAnotherChannel: ComputedRef<boolean>;
	missingRequiredChannels: ComputedRef<DevicesModuleChannelCategory[]>;
}

export interface IUseDeviceState {
	state: ComputedRef<ConnectionState>;
	isReady: ComputedRef<boolean>;
}

export interface IUseDeviceAddForm {
	categoriesOptions: { value: DevicesModuleDeviceCategory; label: string }[];
	model: IDeviceAddForm;
	formEl: Ref<FormInstance | undefined>;
	formChanged: Ref<boolean>;
	submit: () => Promise<'added'>;
	clear: () => void;
	formResult: Ref<FormResultType>;
}

export interface IUseDeviceEditForm {
	categoriesOptions: { value: DevicesModuleDeviceCategory; label: string }[];
	model: IDeviceEditForm;
	formEl: Ref<FormInstance | undefined>;
	formChanged: Ref<boolean>;
	submit: () => Promise<'added' | 'saved'>;
	clear: () => void;
	formResult: Ref<FormResultType>;
}

export interface IUsePlugin {
	plugin: ComputedRef<IPlugin<IPluginsComponents, IPluginsSchemas> | undefined>;
}

export interface IUsePlugins {
	plugins: ComputedRef<IPlugin<IPluginsComponents, IPluginsSchemas>[]>;
	options: ComputedRef<{ value: IPlugin['type']; label: IPlugin['name'] }[]>;
	getByType: (type: IPlugin['type']) => IPlugin<IPluginsComponents, IPluginsSchemas> | undefined;
}
