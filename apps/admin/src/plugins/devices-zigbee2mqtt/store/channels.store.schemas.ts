import { type ZodType, z } from 'zod';

import { ChannelCreateReqSchema, ChannelResSchema, ChannelSchema, ChannelUpdateReqSchema } from '../../../modules/devices';
import type {
	DevicesZigbee2mqttPluginCreateChannelSchema,
	DevicesZigbee2mqttPluginUpdateChannelSchema,
	DevicesZigbee2mqttPluginChannelSchema,
} from '../../../openapi.constants';
import { DEVICES_ZIGBEE2MQTT_TYPE } from '../devices-zigbee2mqtt.constants';

type ApiCreateChannel = DevicesZigbee2mqttPluginCreateChannelSchema;
type ApiUpdateChannel = DevicesZigbee2mqttPluginUpdateChannelSchema;
type ApiChannel = DevicesZigbee2mqttPluginChannelSchema;

// Channel identifier = channel category or type_endpoint
export const Zigbee2mqttChannelSchema = ChannelSchema;

// BACKEND API
// ===========

export const Zigbee2mqttChannelCreateReqSchema: ZodType<ApiCreateChannel> = ChannelCreateReqSchema.and(
	z.object({
		type: z.literal(DEVICES_ZIGBEE2MQTT_TYPE),
	})
);

export const Zigbee2mqttChannelUpdateReqSchema: ZodType<ApiUpdateChannel> = ChannelUpdateReqSchema.and(
	z.object({
		type: z.literal(DEVICES_ZIGBEE2MQTT_TYPE),
	})
);

export const Zigbee2mqttChannelResSchema: ZodType<ApiChannel> = ChannelResSchema.and(
	z.object({
		type: z.literal(DEVICES_ZIGBEE2MQTT_TYPE),
	})
);
