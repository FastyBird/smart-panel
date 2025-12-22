import { type ZodType, z } from 'zod';

import {
	ChannelPropertyCreateReqSchema,
	ChannelPropertyResSchema,
	ChannelPropertySchema,
	ChannelPropertyUpdateReqSchema,
} from '../../../modules/devices';
import type {
	DevicesZigbee2mqttPluginCreateChannelPropertySchema,
	DevicesZigbee2mqttPluginUpdateChannelPropertySchema,
	DevicesZigbee2mqttPluginChannelPropertySchema,
} from '../../../openapi.constants';
import { DEVICES_ZIGBEE2MQTT_TYPE } from '../devices-zigbee2mqtt.constants';

type ApiCreateChannelProperty = DevicesZigbee2mqttPluginCreateChannelPropertySchema;
type ApiUpdateChannelProperty = DevicesZigbee2mqttPluginUpdateChannelPropertySchema;
type ApiChannelProperty = DevicesZigbee2mqttPluginChannelPropertySchema;

// Property identifier = z2m property name (for matching MQTT state keys)
export const Zigbee2mqttChannelPropertySchema = ChannelPropertySchema;

// BACKEND API
// ===========

export const Zigbee2mqttChannelPropertyCreateReqSchema: ZodType<ApiCreateChannelProperty> = ChannelPropertyCreateReqSchema.and(
	z.object({
		type: z.literal(DEVICES_ZIGBEE2MQTT_TYPE),
	})
);

export const Zigbee2mqttChannelPropertyUpdateReqSchema: ZodType<ApiUpdateChannelProperty> = ChannelPropertyUpdateReqSchema.and(
	z.object({
		type: z.literal(DEVICES_ZIGBEE2MQTT_TYPE),
	})
);

export const Zigbee2mqttChannelPropertyResSchema: ZodType<ApiChannelProperty> = ChannelPropertyResSchema.and(
	z.object({
		type: z.literal(DEVICES_ZIGBEE2MQTT_TYPE),
	})
);
