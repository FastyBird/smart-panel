import type { ComputedRef, Reactive, Ref } from 'vue';

import type { FormInstance } from 'element-plus';
import { z } from 'zod';

import type { IPlugin, IPluginElement } from '../../../common';
import {
	DevicesModuleChannelCategory,
	DevicesModuleChannelPropertyCategory,
	DevicesModuleChannelPropertyDataType,
	DevicesModuleChannelPropertyPermissions,
	DevicesModuleDeviceCategory,
	DevicesModuleDeviceConnectionStatus,
} from '../../../openapi.constants';
import type { FormResultType } from '../devices.constants';
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

import { ChannelsFilterSchema, ChannelsPropertiesFilterSchema, type DevicesFilterSchema } from './schemas';

export type IChannelsFilter = z.infer<typeof ChannelsFilterSchema>;

export type IChannelsPropertiesFilter = z.infer<typeof ChannelsPropertiesFilterSchema>;

export type IDevicesFilter = z.infer<typeof DevicesFilterSchema>;

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
	sortBy: Ref<'name' | 'description' | 'category' | undefined>;
	sortDir: Ref<'asc' | 'desc' | null>;
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
	element: ComputedRef<IPluginElement<IChannelPluginsComponents, IChannelPluginsSchemas> | undefined>;
}

export interface IUseChannelsPlugins {
	plugins: ComputedRef<IPlugin<IChannelPluginsComponents, IChannelPluginsSchemas>[]>;
	options: ComputedRef<{ value: IPluginElement['type']; label: string; disabled: boolean }[]>;
	getByName: (type: IPlugin['type']) => IPlugin<IChannelPluginsComponents, IChannelPluginsSchemas> | undefined;
	getByType: (type: IPluginElement['type']) => IPlugin<IChannelPluginsComponents, IChannelPluginsSchemas> | undefined;
	getElement: (type: IPluginElement['type']) => IPluginElement<IChannelPluginsComponents, IChannelPluginsSchemas> | undefined;
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
	sortBy: Ref<'name' | 'category' | undefined>;
	sortDir: Ref<'asc' | 'desc' | null>;
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
	dataTypesOptions: { value: DevicesModuleChannelPropertyDataType; label: string }[];
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
	dataTypesOptions: { value: DevicesModuleChannelPropertyDataType; label: string }[];
	model: Reactive<TForm>;
	formEl: Ref<FormInstance | undefined>;
	formChanged: Ref<boolean>;
	submit: () => Promise<'added' | 'saved'>;
	clear: () => void;
	formResult: Ref<FormResultType>;
	loadingChannels: ComputedRef<boolean>;
}

export interface IUseChannelPropertyFormSpec<TValue> {
	required: boolean;
	description: { en?: string } | undefined;
	value: TValue | undefined;
}

export interface IUseChannelsPropertiesPlugin {
	plugin: ComputedRef<IPlugin<IChannelPropertyPluginsComponents, IChannelPropertyPluginsSchemas> | undefined>;
	element: ComputedRef<IPluginElement<IChannelPropertyPluginsComponents, IChannelPropertyPluginsSchemas> | undefined>;
}

export interface IUseChannelsPropertiesPlugins {
	plugins: ComputedRef<IPlugin<IChannelPropertyPluginsComponents, IChannelPropertyPluginsSchemas>[]>;
	options: ComputedRef<{ value: IPluginElement['type']; label: string; disabled: boolean }[]>;
	getByName: (type: IPlugin['type']) => IPlugin<IChannelPropertyPluginsComponents, IChannelPropertyPluginsSchemas> | undefined;
	getByType: (type: IPluginElement['type']) => IPlugin<IChannelPropertyPluginsComponents, IChannelPropertyPluginsSchemas> | undefined;
	getElement: (type: IPluginElement['type']) => IPluginElement<IChannelPropertyPluginsComponents, IChannelPropertyPluginsSchemas> | undefined;
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
	sortBy: Ref<'name' | 'description' | 'type' | 'state' | 'category' | undefined>;
	sortDir: Ref<'asc' | 'desc' | null>;
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
	state: ComputedRef<DevicesModuleDeviceConnectionStatus>;
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
	element: ComputedRef<IPluginElement<IDevicePluginsComponents, IDevicePluginsSchemas> | undefined>;
}

export interface IUseDevicesPlugins {
	plugins: ComputedRef<IPlugin<IDevicePluginsComponents, IDevicePluginsSchemas>[]>;
	options: ComputedRef<{ value: IPluginElement['type']; label: string; disabled: boolean }[]>;
	getByName: (type: IPlugin['type']) => IPlugin<IDevicePluginsComponents, IDevicePluginsSchemas> | undefined;
	getByType: (type: IPluginElement['type']) => IPlugin<IDevicePluginsComponents, IDevicePluginsSchemas> | undefined;
	getElement: (type: IPluginElement['type']) => IPluginElement<IDevicePluginsComponents, IDevicePluginsSchemas> | undefined;
}

export interface IUseDeviceControl {
	device: ComputedRef<IDevice | null>;
	channels: ComputedRef<IChannel[]>;
	controllableChannels: ComputedRef<IChannel[]>;
	hasControllableProperties: ComputedRef<boolean>;
	isLoading: ComputedRef<boolean>;
	areChannelsLoaded: ComputedRef<boolean>;
	fetchDevice: () => Promise<void>;
	fetchChannels: () => Promise<void>;
	fetchProperties: () => Promise<void>;
	getPropertiesForChannel: (channelId: IChannel['id']) => IChannelProperty[];
	isPropertyWritable: (property: IChannelProperty) => boolean;
	getPropertyValue: (propertyId: IChannelProperty['id']) => string | number | boolean | null;
	isPropertyLoading: (propertyId: IChannelProperty['id']) => boolean;
	setPropertyValue: (channelId: IChannel['id'], propertyId: IChannelProperty['id'], value: string | number | boolean | null) => Promise<boolean>;
}
