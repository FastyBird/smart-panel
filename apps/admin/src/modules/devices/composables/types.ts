import type { ComputedRef, Reactive, Ref } from 'vue';

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
import type {
	IChannelPluginsComponents,
	IChannelPluginsSchemas,
	IChannelPropertyPluginsComponents,
	IChannelPropertyPluginsSchemas,
	IDevicePluginsComponents,
	IDevicePluginsSchemas,
} from '../devices.types';
import type { IChannelPropertyAddForm, IChannelPropertyEditForm } from '../schemas/channels.properties.types';
import type { IChannelAddForm, IChannelEditForm } from '../schemas/channels.types';
import type { IDeviceAddForm, IDeviceEditForm } from '../schemas/devices.types';
import type { IChannelProperty } from '../store/channels.properties.store.types';
import type { IChannel } from '../store/channels.store.types';
import type { IDevice } from '../store/devices.store.types';

export interface IChannelsFilter {
	search: string | undefined;
	devices: IDevice['id'][];
	categories: DevicesModuleChannelCategory[];
}

export interface IChannelsPropertiesFilter {
	search: string | undefined;
	channels: IChannel['id'][];
	categories: DevicesModuleChannelPropertyCategory[];
	permissions: DevicesModuleChannelPropertyPermissions[];
	dataTypes: DevicesModuleChannelPropertyData_type[];
}

export interface IDevicesFilter {
	search: string | undefined;
	types: IPlugin['type'][];
	state: 'all' | 'offline' | 'online';
	states: ConnectionState[];
	categories: DevicesModuleDeviceCategory[];
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

export interface IUseChannelAddForm<TForm extends IChannelAddForm = IChannelAddForm> {
	categoriesOptions: ComputedRef<{ value: DevicesModuleChannelCategory; label: string }[]>;
	devicesOptions: ComputedRef<{ value: IDevice['id']; label: string }[]>;
	model: Reactive<TForm>;
	formEl: Ref<FormInstance | undefined>;
	formChanged: Ref<boolean>;
	submit: () => Promise<'added'>;
	clear: () => void;
	formResult: Ref<FormResultType>;
	loadingDevices: ComputedRef<boolean>;
}

export interface IUseChannelEditForm<TForm extends IChannelEditForm = IChannelEditForm> {
	categoriesOptions: ComputedRef<{ value: DevicesModuleChannelCategory; label: string }[]>;
	devicesOptions: ComputedRef<{ value: IDevice['id']; label: string }[]>;
	model: Reactive<TForm>;
	formEl: Ref<FormInstance | undefined>;
	formChanged: Ref<boolean>;
	submit: () => Promise<'added' | 'saved'>;
	clear: () => void;
	formResult: Ref<FormResultType>;
	loadingDevices: ComputedRef<boolean>;
}

export interface IUseChannelsPlugin {
	plugin: ComputedRef<IPlugin<IChannelPluginsComponents, IChannelPluginsSchemas> | undefined>;
}

export interface IUseChannelsPlugins {
	plugins: ComputedRef<IPlugin<IChannelPluginsComponents, IChannelPluginsSchemas>[]>;
	options: ComputedRef<{ value: IPlugin['type']; label: IPlugin['name'] }[]>;
	getByType: (type: IPlugin['type']) => IPlugin<IChannelPluginsComponents, IChannelPluginsSchemas> | undefined;
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

export interface IUseChannelPropertyAddForm<TForm extends IChannelPropertyAddForm = IChannelPropertyAddForm> {
	categoriesOptions: ComputedRef<{ value: DevicesModuleChannelPropertyCategory; label: string }[]>;
	channelsOptions: ComputedRef<{ value: IChannel['id']; label: string }[]>;
	permissionsOptions: { value: DevicesModuleChannelPropertyPermissions; label: string }[];
	dataTypesOptions: { value: DevicesModuleChannelPropertyData_type; label: string }[];
	model: Reactive<TForm>;
	formEl: Ref<FormInstance | undefined>;
	formChanged: Ref<boolean>;
	submit: () => Promise<'added'>;
	clear: () => void;
	formResult: Ref<FormResultType>;
	loadingChannels: ComputedRef<boolean>;
}

export interface IUseChannelPropertyEditForm<TForm extends IChannelPropertyEditForm = IChannelPropertyEditForm> {
	categoriesOptions: ComputedRef<{ value: DevicesModuleChannelPropertyCategory; label: string }[]>;
	channelsOptions: ComputedRef<{ value: IChannel['id']; label: string }[]>;
	permissionsOptions: { value: DevicesModuleChannelPropertyPermissions; label: string }[];
	dataTypesOptions: { value: DevicesModuleChannelPropertyData_type; label: string }[];
	model: Reactive<TForm>;
	formEl: Ref<FormInstance | undefined>;
	formChanged: Ref<boolean>;
	submit: () => Promise<'added' | 'saved'>;
	clear: () => void;
	formResult: Ref<FormResultType>;
	loadingChannels: ComputedRef<boolean>;
}

export interface IUseChannelsPropertiesPlugin {
	plugin: ComputedRef<IPlugin<IChannelPropertyPluginsComponents, IChannelPropertyPluginsSchemas> | undefined>;
}

export interface IUseChannelsPropertiesPlugins {
	plugins: ComputedRef<IPlugin<IChannelPropertyPluginsComponents, IChannelPropertyPluginsSchemas>[]>;
	options: ComputedRef<{ value: IPlugin['type']; label: IPlugin['name'] }[]>;
	getByType: (type: IPlugin['type']) => IPlugin<IChannelPropertyPluginsComponents, IChannelPropertyPluginsSchemas> | undefined;
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

export interface IUseDeviceAddForm<TForm extends IDeviceAddForm = IDeviceAddForm> {
	categoriesOptions: { value: DevicesModuleDeviceCategory; label: string }[];
	model: Reactive<TForm>;
	formEl: Ref<FormInstance | undefined>;
	formChanged: Ref<boolean>;
	submit: () => Promise<'added'>;
	clear: () => void;
	formResult: Ref<FormResultType>;
}

export interface IUseDeviceEditForm<TForm extends IDeviceEditForm = IDeviceEditForm> {
	categoriesOptions: { value: DevicesModuleDeviceCategory; label: string }[];
	model: Reactive<TForm>;
	formEl: Ref<FormInstance | undefined>;
	formChanged: Ref<boolean>;
	submit: () => Promise<'added' | 'saved'>;
	clear: () => void;
	formResult: Ref<FormResultType>;
}

export interface IUseDevicesPlugin {
	plugin: ComputedRef<IPlugin<IDevicePluginsComponents, IDevicePluginsSchemas> | undefined>;
}

export interface IUseDevicesPlugins {
	plugins: ComputedRef<IPlugin<IDevicePluginsComponents, IDevicePluginsSchemas>[]>;
	options: ComputedRef<{ value: IPlugin['type']; label: IPlugin['name'] }[]>;
	getByType: (type: IPlugin['type']) => IPlugin<IDevicePluginsComponents, IDevicePluginsSchemas> | undefined;
}
