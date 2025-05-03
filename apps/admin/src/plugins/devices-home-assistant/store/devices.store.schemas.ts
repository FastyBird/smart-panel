import { type ZodType, z } from 'zod';

import { DeviceCreateReqSchema, DeviceResSchema, DeviceSchema, DeviceUpdateReqSchema } from '../../../modules/devices';
import { type components } from '../../../openapi';
import { DEVICES_HOME_ASSISTANT_PLUGIN_TYPE } from '../devices-home-assistant.constants';

type ApiCreateDevice = components['schemas']['DevicesHomeAssistantPluginCreateHomeAssistantDevice'];
type ApiUpdateDevice = components['schemas']['DevicesHomeAssistantPluginUpdateHomeAssistantDevice'];
type ApiDevice = components['schemas']['DevicesHomeAssistantPluginHomeAssistantDevice'];

export const HomeAssistantDeviceSchema = DeviceSchema.extend({
	haDeviceId: z.string().trim().nonempty(),
});

// BACKEND API
// ===========

export const HomeAssistantDeviceCreateReqSchema: ZodType<ApiCreateDevice> = DeviceCreateReqSchema.and(
	z.object({
		type: z.string().trim().nonempty().default(DEVICES_HOME_ASSISTANT_PLUGIN_TYPE),
		ha_device_id: z.string().trim().nonempty(),
	})
);

export const HomeAssistantDeviceUpdateReqSchema: ZodType<ApiUpdateDevice> = DeviceUpdateReqSchema.and(
	z.object({
		type: z.string().trim().nonempty().default(DEVICES_HOME_ASSISTANT_PLUGIN_TYPE),
	})
);

export const HomeAssistantDeviceResSchema: ZodType<ApiDevice> = DeviceResSchema.and(
	z.object({
		type: z.string().trim().nonempty().default(DEVICES_HOME_ASSISTANT_PLUGIN_TYPE),
		ha_device_id: z.string().trim().nonempty(),
	})
);
