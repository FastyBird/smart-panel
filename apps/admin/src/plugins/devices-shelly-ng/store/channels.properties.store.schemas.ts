import { type ZodType, z } from 'zod';

import {
	ChannelPropertyCreateReqSchema,
	ChannelPropertyResSchema,
	ChannelPropertySchema,
	ChannelPropertyUpdateReqSchema,
} from '../../../modules/devices';
import type {
	DevicesShellyNgPluginCreateChannelPropertySchema,
	DevicesShellyNgPluginUpdateChannelPropertySchema,
	DevicesShellyNgPluginChannelPropertySchema,
} from '../../../openapi.constants';
import { DEVICES_SHELLY_NG_TYPE } from '../devices-shelly-ng.constants';

type ApiCreateChannelProperty = DevicesShellyNgPluginCreateChannelPropertySchema;
type ApiUpdateChannelProperty = DevicesShellyNgPluginUpdateChannelPropertySchema;
type ApiChannelProperty = DevicesShellyNgPluginChannelPropertySchema;

export const ShellyNgChannelPropertySchema = ChannelPropertySchema;

// BACKEND API
// ===========

export const ShellyNgChannelPropertyCreateReqSchema: ZodType<ApiCreateChannelProperty> = ChannelPropertyCreateReqSchema.and(
	z.object({
		type: z.literal(DEVICES_SHELLY_NG_TYPE),
	})
);

export const ShellyNgChannelPropertyUpdateReqSchema: ZodType<ApiUpdateChannelProperty> = ChannelPropertyUpdateReqSchema.and(
	z.object({
		type: z.literal(DEVICES_SHELLY_NG_TYPE),
	})
);

export const ShellyNgChannelPropertyResSchema: ZodType<ApiChannelProperty> = ChannelPropertyResSchema.and(
	z.object({
		type: z.literal(DEVICES_SHELLY_NG_TYPE),
	})
);
