/*
eslint-disable @typescript-eslint/no-empty-object-type
*/
import type { ComponentOptionsMixin, DefineComponent } from 'vue';
import type { RouteLocationRaw } from 'vue-router';

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

export type IDevicePluginsComponents = {
	deviceAddForm?: DefineComponent<IDeviceAddFormProps, {}, {}, {}, {}, ComponentOptionsMixin, ComponentOptionsMixin, typeof deviceAddFormEmits>;
	deviceEditForm?: DefineComponent<IDeviceEditFormProps, {}, {}, {}, {}, ComponentOptionsMixin, ComponentOptionsMixin, typeof deviceEditFormEmits>;
	deviceWizardAdapter?: () => IDeviceWizardAdapter;
};

export type IDevicePluginsSchemas = {
	deviceSchema?: typeof DeviceSchema;
	deviceAddFormSchema?: typeof DeviceAddFormSchema;
	deviceEditFormSchema?: typeof DeviceEditFormSchema;
	deviceCreateReqSchema?: typeof DeviceCreateReqSchema;
	deviceUpdateReqSchema?: typeof DeviceUpdateReqSchema;
};

export interface IDeviceWizardRouteLauncher {
	/** Translation key rendered by the Devices view. */
	label: string;
	icon: string;
	to: RouteLocationRaw;
	/** Stable base id; the small-screen launcher appends `-small`. */
	testId: string;
}

export type IDevicePluginRoutes = {
	wizard?: IDeviceWizardRouteLauncher;
};

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
