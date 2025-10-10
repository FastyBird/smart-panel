import { z } from 'zod';

import {
	DevicesModuleChannelCategory,
	DevicesModuleChannelPropertyCategory,
	DevicesModuleChannelPropertyData_type,
	DevicesModuleChannelPropertyPermissions,
	DevicesModuleDeviceCategory,
} from '../../../openapi';
import { ConnectionState } from '../devices.constants';

export const DevicesFilterSchema = z.object({
	search: z.string().optional(),
	types: z.array(z.string()),
	state: z.enum(['all', 'offline', 'online']).default('all'),
	states: z.array(z.nativeEnum(ConnectionState)),
	categories: z.array(z.nativeEnum(DevicesModuleDeviceCategory)),
	enabled: z.enum(['all', 'enabled', 'disabled']).default('all'),
});

export const ChannelsFilterSchema = z.object({
	search: z.string().optional(),
	devices: z.array(z.string()),
	categories: z.array(z.nativeEnum(DevicesModuleChannelCategory)),
});

export const ChannelsPropertiesFilterSchema = z.object({
	search: z.string().optional(),
	channels: z.array(z.string()),
	categories: z.array(z.nativeEnum(DevicesModuleChannelPropertyCategory)),
	permissions: z.array(z.nativeEnum(DevicesModuleChannelPropertyPermissions)),
	dataTypes: z.array(z.nativeEnum(DevicesModuleChannelPropertyData_type)),
});
