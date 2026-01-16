import { type ZodType, z } from 'zod';

import { DeviceCreateReqSchema, DeviceResSchema, DeviceSchema, DeviceUpdateReqSchema } from '../../../modules/devices';
import type {
	DevicesHomeAssistantPluginCreateDeviceSchema,
	DevicesHomeAssistantPluginDeviceSchema,
	DevicesHomeAssistantPluginUpdateDeviceSchema,
} from '../../../openapi.constants';
import { DEVICES_HOME_ASSISTANT_TYPE } from '../devices-home-assistant.constants';

type ApiCreateDevice = DevicesHomeAssistantPluginCreateDeviceSchema;
type ApiUpdateDevice = DevicesHomeAssistantPluginUpdateDeviceSchema;
type ApiDevice = DevicesHomeAssistantPluginDeviceSchema;

export const HomeAssistantDeviceSchema = DeviceSchema.extend({
	haDeviceId: z.string().trim().nonempty(),
});

// BACKEND API
// ===========

export const HomeAssistantDeviceCreateReqSchema: ZodType<ApiCreateDevice> = DeviceCreateReqSchema.and(
	z.object({
		type: z.literal(DEVICES_HOME_ASSISTANT_TYPE),
		ha_device_id: z.string().trim().nonempty(),
	})
);

export const HomeAssistantDeviceUpdateReqSchema: ZodType<ApiUpdateDevice> = DeviceUpdateReqSchema.and(
	z.object({
		type: z.literal(DEVICES_HOME_ASSISTANT_TYPE),
	})
);

export const HomeAssistantDeviceResSchema: ZodType<ApiDevice> = DeviceResSchema.and(
	z.object({
		type: z.literal(DEVICES_HOME_ASSISTANT_TYPE),
		ha_device_id: z.string().trim().nonempty(),
	})
);
