import { type ZodType, z } from 'zod';

import { DeviceCreateReqSchema, DeviceResSchema, DeviceSchema, DeviceUpdateReqSchema } from '../../../modules/devices';
import type {
	DevicesZigbee2mqttPluginCreateDeviceSchema,
	DevicesZigbee2mqttPluginUpdateDeviceSchema,
	DevicesZigbee2mqttPluginDeviceSchema,
} from '../../../openapi.constants';
import { DevicesModuleDeviceCategory } from '../../../openapi.constants';
import { DEVICES_ZIGBEE2MQTT_TYPE } from '../devices-zigbee2mqtt.constants';

type ApiCreateDevice = DevicesZigbee2mqttPluginCreateDeviceSchema;
type ApiUpdateDevice = DevicesZigbee2mqttPluginUpdateDeviceSchema;
type ApiDevice = DevicesZigbee2mqttPluginDeviceSchema;

// Device identifier = friendly_name (for MQTT topic matching)
export const Zigbee2mqttDeviceSchema = DeviceSchema;

// BACKEND API
// ===========

export const Zigbee2mqttDeviceCreateReqSchema: ZodType<ApiCreateDevice> = DeviceCreateReqSchema.and(
	z.object({
		type: z.literal(DEVICES_ZIGBEE2MQTT_TYPE),
	})
);

export const Zigbee2mqttDeviceUpdateReqSchema: ZodType<ApiUpdateDevice> = DeviceUpdateReqSchema.and(
	z.object({
		type: z.literal(DEVICES_ZIGBEE2MQTT_TYPE),
		category: z.nativeEnum(DevicesModuleDeviceCategory).optional(),
	})
);

export const Zigbee2mqttDeviceResSchema: ZodType<ApiDevice> = DeviceResSchema.and(
	z.object({
		type: z.literal(DEVICES_ZIGBEE2MQTT_TYPE),
	})
);
