import { type ZodType, z } from 'zod';

import { DeviceCreateReqSchema, DeviceResSchema, DeviceSchema, DeviceUpdateReqSchema } from '../../../modules/devices';
import { type components } from '../../../openapi';
import { DEVICES_HOME_ASSISTANT_TYPE } from '../devices-home-assistant.constants';

type ApiCreateDevice = components['schemas']['DevicesHomeAssistantPluginDataDevice'];
type ApiUpdateDevice = components['schemas']['DevicesHomeAssistantPluginDataDevice'];
type ApiDevice = components['schemas']['DevicesHomeAssistantPluginDataDevice'];

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
