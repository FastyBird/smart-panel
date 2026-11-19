/*
eslint-disable @typescript-eslint/no-empty-object-type
*/
import type { Component, ComponentOptionsMixin, DefineComponent } from 'vue';

import type { DevicesModuleDeviceCategory } from '../../openapi.constants';

import { type IChannelAddFormProps, channelAddFormEmits } from './components/channels/channel-add-form.types';
import { type IChannelEditFormProps, channelEditFormEmits } from './components/channels/channel-edit-form.types';
import { type IChannelPropertyAddFormProps, channelPropertyAddFormEmits } from './components/channels/channel-property-add-form.types';
import { type IChannelPropertyEditFormProps, channelPropertyEditFormEmits } from './components/channels/channel-property-edit-form.types';
import { type IDeviceAddFormProps, deviceAddFormEmits } from './components/devices/device-add-form.types';
import { type IDeviceEditFormProps, deviceEditFormEmits } from './components/devices/device-edit-form.types';
import type { IDeviceWizardAdapter } from './components/wizard/device-wizard.types';
import { ChannelPropertyAddFormSchema, ChannelPropertyEditFormSchema } from './schemas/channels.properties.schemas';
import { ChannelAddFormSchema, ChannelEditFormSchema } from './schemas/channels.schemas';
import { DeviceAddFormSchema, type DeviceEditFormSchema } from './schemas/devices.schemas';
import {
	ChannelPropertyCreateReqSchema,
	type ChannelPropertySchema,
	ChannelPropertyUpdateReqSchema,
} from './store/channels.properties.store.schemas';
import { ChannelCreateReqSchema, type ChannelSchema, ChannelUpdateReqSchema } from './store/channels.store.schemas';
import { DeviceCreateReqSchema, DeviceSchema, DeviceUpdateReqSchema } from './store/devices.store.schemas';
import type { IDevice } from './store/devices.store.types';

/** Props passed to plugin-owned content inside a device detail tab. */
export interface IDeviceDetailSectionProps {
	device: IDevice;
}

export type IDevicePluginsComponents = {
	deviceAddForm?: DefineComponent<IDeviceAddFormProps, {}, {}, {}, {}, ComponentOptionsMixin, ComponentOptionsMixin, typeof deviceAddFormEmits>;
	deviceEditForm?: DefineComponent<IDeviceEditFormProps, {}, {}, {}, {}, ComponentOptionsMixin, ComponentOptionsMixin, typeof deviceEditFormEmits>;
	deviceWizard?: IDeviceWizardDefinition;
	deviceDetailTabs?: IDeviceDetailTab[];
};

export type IDevicePluginsSchemas = {
	deviceSchema?: typeof DeviceSchema;
	deviceAddFormSchema?: typeof DeviceAddFormSchema;
	deviceEditFormSchema?: typeof DeviceEditFormSchema;
	deviceCreateReqSchema?: typeof DeviceCreateReqSchema;
	deviceUpdateReqSchema?: typeof DeviceUpdateReqSchema;
};

/** Translation keys and plugin-owned content, rendered inside the shared wizard. */
export interface IDeviceWizardVariant {
	id: string;
	label: string;
	description: string;
	icon: string;
	component: Component;
	props?: Record<string, unknown>;
}

/** Picker presentation belongs to the plugin; it does not change the plugin's device capabilities. */
export type IDeviceWizardSelection = {
	label?: string;
	description?: string;
	icon?: string;
	order?: number;
} & ({ kind: 'integration' } | { kind: 'section'; section: { label: string; description: string } });

export type IDeviceWizardDefinition = {
	capabilities?: { discovery?: boolean; batch?: boolean; manual?: boolean };
	selection?: IDeviceWizardSelection;
} & (
	| { component: Component; props?: { adapterFactory?: () => IDeviceWizardAdapter } & Record<string, unknown>; variants?: never }
	| { variants: IDeviceWizardVariant[]; component?: never; props?: never }
);

export interface IDeviceDetailTab {
	id: string;
	label: string;
	icon: string;
	component: Component;
	visible?: (device: IDevice) => boolean;
}

/**
 * Content a module renders on the device detail page for every device of the listed categories, regardless of the
 * device's plugin. The host owns the page chrome and the order; the section renders cards only.
 *
 * The component receives `device` and `active`. The overview tab that holds it stays mounted while another tab is
 * open, so `active` is `false` then and the section must stop anything that runs in the background, such as a stream.
 */
export interface IDeviceCategorySection {
	id: string;
	categories: DevicesModuleDeviceCategory[];
	component: Component;
	order?: number;
}

export type IDevicesModuleElementComponents = {
	deviceCategorySection?: IDeviceCategorySection;
};

export type IDevicePluginRoutes = Record<string, never>;

export type IChannelPluginsComponents = {
	channelAddForm?: DefineComponent<IChannelAddFormProps, {}, {}, {}, {}, ComponentOptionsMixin, ComponentOptionsMixin, typeof channelAddFormEmits>;
	channelEditForm?: DefineComponent<IChannelEditFormProps, {}, {}, {}, {}, ComponentOptionsMixin, ComponentOptionsMixin, typeof channelEditFormEmits>;
};

export type IChannelPluginsSchemas = {
	channelSchema?: typeof ChannelSchema;
	channelAddFormSchema?: typeof ChannelAddFormSchema;
	channelEditFormSchema?: typeof ChannelEditFormSchema;
	channelCreateReqSchema?: typeof ChannelCreateReqSchema;
	channelUpdateReqSchema?: typeof ChannelUpdateReqSchema;
};

export type IChannelPropertyPluginsComponents = {
	channelPropertyAddForm?: DefineComponent<
		IChannelPropertyAddFormProps,
		{},
		{},
		{},
		{},
		ComponentOptionsMixin,
		ComponentOptionsMixin,
		typeof channelPropertyAddFormEmits
	>;
	channelPropertyEditForm?: DefineComponent<
		IChannelPropertyEditFormProps,
		{},
		{},
		{},
		{},
		ComponentOptionsMixin,
		ComponentOptionsMixin,
		typeof channelPropertyEditFormEmits
	>;
};

export type IChannelPropertyPluginsSchemas = {
	channelPropertySchema?: typeof ChannelPropertySchema;
	channelPropertyAddFormSchema?: typeof ChannelPropertyAddFormSchema;
	channelPropertyEditFormSchema?: typeof ChannelPropertyEditFormSchema;
	channelPropertyCreateReqSchema?: typeof ChannelPropertyCreateReqSchema;
	channelPropertyUpdateReqSchema?: typeof ChannelPropertyUpdateReqSchema;
};
