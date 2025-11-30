import { type ZodType, z } from 'zod';

import { ChannelCreateReqSchema, ChannelResSchema, ChannelSchema, ChannelUpdateReqSchema } from '../../../modules/devices';
import { DevicesShellyNgPluginShellyNgDeviceType, type components } from '../../../openapi';

type ApiCreateChannel = components['schemas']['DevicesShellyNgPluginDataChannel'];
type ApiUpdateChannel = components['schemas']['DevicesShellyNgPluginDataChannel'];
type ApiChannel = components['schemas']['DevicesShellyNgPluginDataChannel'];

export const ShellyNgChannelSchema = ChannelSchema;

// BACKEND API
// ===========

export const ShellyNgChannelCreateReqSchema: ZodType<ApiCreateChannel> = ChannelCreateReqSchema.and(
	z.object({
		type: z.nativeEnum(DevicesShellyNgPluginShellyNgDeviceType),
	})
);

export const ShellyNgChannelUpdateReqSchema: ZodType<ApiUpdateChannel> = ChannelUpdateReqSchema.and(
	z.object({
		type: z.nativeEnum(DevicesShellyNgPluginShellyNgDeviceType),
	})
);

export const ShellyNgChannelResSchema: ZodType<ApiChannel> = ChannelResSchema.and(
	z.object({
		type: z.nativeEnum(DevicesShellyNgPluginShellyNgDeviceType),
	})
);
