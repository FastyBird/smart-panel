import { type ZodType, z } from 'zod';

import {
	ChannelPropertyCreateReqSchema,
	ChannelPropertyResSchema,
	ChannelPropertySchema,
	ChannelPropertyUpdateReqSchema,
} from '../../../modules/devices';
import { type components } from '../../../openapi';
import { DEVICES_SHELLY_NG_TYPE } from '../devices-shelly-ng.constants';

type ApiCreateChannelProperty = components['schemas']['DevicesShellyNgPluginDataChannelProperty'];
type ApiUpdateChannelProperty = components['schemas']['DevicesShellyNgPluginDataChannelProperty'];
type ApiChannelProperty = components['schemas']['DevicesShellyNgPluginDataChannelProperty'];

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
