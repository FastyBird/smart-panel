import { type ZodType, z } from 'zod';

import { DeviceCreateReqSchema, DeviceResSchema, DeviceSchema, DeviceUpdateReqSchema } from '../../../modules/devices';
import { type components } from '../../../openapi';
import { DEVICES_THIRD_PARTY_TYPE } from '../devices-third-party.constants';

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
		type: z.string().trim().nonempty().default(DEVICES_THIRD_PARTY_TYPE),
		service_address: z.string().trim().url(),
	})
);

export const ThirdPartyDeviceUpdateReqSchema: ZodType<ApiUpdateDevice> = DeviceUpdateReqSchema.and(
	z.object({
		type: z.string().trim().nonempty().default(DEVICES_THIRD_PARTY_TYPE),
		service_address: z.string().trim().url().optional(),
	})
);

export const ThirdPartyDeviceResSchema: ZodType<ApiDevice> = DeviceResSchema.and(
	z.object({
		type: z.string().trim().nonempty().default(DEVICES_THIRD_PARTY_TYPE),
		service_address: z.string().trim().url(),
	})
);
