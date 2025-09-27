import { type ZodType, z } from 'zod';

import { DeviceCreateReqSchema, DeviceResSchema, DeviceSchema, DeviceUpdateReqSchema } from '../../../modules/devices';
import { DevicesThirdPartyPluginThirdPartyDeviceType, type components } from '../../../openapi';

type ApiCreateDevice = components['schemas']['DevicesThirdPartyPluginCreateThirdPartyDevice'];
type ApiUpdateDevice = components['schemas']['DevicesThirdPartyPluginUpdateThirdPartyDevice'];
type ApiDevice = components['schemas']['DevicesThirdPartyPluginThirdPartyDevice'];

export const ThirdPartyDeviceSchema = DeviceSchema.extend({
	serviceAddress: z.string().trim().url(),
});

// BACKEND API
// ===========

export const ThirdPartyDeviceCreateReqSchema: ZodType<ApiCreateDevice> = DeviceCreateReqSchema.and(
	z.object({
		type: z.nativeEnum(DevicesThirdPartyPluginThirdPartyDeviceType),
		service_address: z.string().trim().url(),
	})
);

export const ThirdPartyDeviceUpdateReqSchema: ZodType<ApiUpdateDevice> = DeviceUpdateReqSchema.and(
	z.object({
		type: z.nativeEnum(DevicesThirdPartyPluginThirdPartyDeviceType),
		service_address: z.string().trim().url().optional(),
	})
);

export const ThirdPartyDeviceResSchema: ZodType<ApiDevice> = DeviceResSchema.and(
	z.object({
		type: z.nativeEnum(DevicesThirdPartyPluginThirdPartyDeviceType),
		service_address: z.string().trim().url(),
	})
);
