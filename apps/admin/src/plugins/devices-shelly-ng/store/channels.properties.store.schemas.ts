import { type ZodType, z } from 'zod';

import {
	ChannelPropertyCreateReqSchema,
	ChannelPropertyResSchema,
	ChannelPropertySchema,
	ChannelPropertyUpdateReqSchema,
} from '../../../modules/devices';
import { DevicesShellyNgPluginShellyNgDeviceType, type components } from '../../../openapi';

type ApiCreateChannelProperty = components['schemas']['DevicesShellyNgPluginCreateShellyNgChannelProperty'];
type ApiUpdateChannelProperty = components['schemas']['DevicesShellyNgPluginUpdateShellyNgChannelProperty'];
type ApiChannelProperty = components['schemas']['DevicesShellyNgPluginShellyNgChannelProperty'];

export const ShellyNgChannelPropertySchema = ChannelPropertySchema;

// BACKEND API
// ===========

export const ShellyNgChannelPropertyCreateReqSchema: ZodType<ApiCreateChannelProperty> = ChannelPropertyCreateReqSchema.and(
	z.object({
		type: z.nativeEnum(DevicesShellyNgPluginShellyNgDeviceType),
	})
);

export const ShellyNgChannelPropertyUpdateReqSchema: ZodType<ApiUpdateChannelProperty> = ChannelPropertyUpdateReqSchema.and(
	z.object({
		type: z.nativeEnum(DevicesShellyNgPluginShellyNgDeviceType),
	})
);

export const ShellyNgChannelPropertyResSchema: ZodType<ApiChannelProperty> = ChannelPropertyResSchema.and(
	z.object({
		type: z.nativeEnum(DevicesShellyNgPluginShellyNgDeviceType),
	})
);
