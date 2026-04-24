import { z } from 'zod';

import { DeviceCreateReqSchema, DeviceResSchema, DeviceSchema, DeviceUpdateReqSchema } from '../../../modules/devices';
import { DevicesModuleDeviceCategory } from '../../../openapi.constants';
import { DEVICES_ZIGBEE_HERDSMAN_TYPE } from '../devices-zigbee-herdsman.constants';

export const ZigbeeHerdsmanDeviceSchema = DeviceSchema;

// BACKEND API
// ===========

export const ZigbeeHerdsmanDeviceCreateReqSchema = DeviceCreateReqSchema.and(
	z.object({
		type: z.literal(DEVICES_ZIGBEE_HERDSMAN_TYPE),
	})
);

export const ZigbeeHerdsmanDeviceUpdateReqSchema = DeviceUpdateReqSchema.and(
	z.object({
		type: z.literal(DEVICES_ZIGBEE_HERDSMAN_TYPE),
		category: z.nativeEnum(DevicesModuleDeviceCategory).optional(),
	})
);

export const ZigbeeHerdsmanDeviceResSchema = DeviceResSchema.and(
	z.object({
		type: z.literal(DEVICES_ZIGBEE_HERDSMAN_TYPE),
	})
);
