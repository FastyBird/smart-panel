import { type ZodType, z } from 'zod';

import {
	ChannelPropertyCreateReqSchema,
	ChannelPropertyResSchema,
	ChannelPropertySchema,
	ChannelPropertyUpdateReqSchema,
} from '../../../modules/devices';
import type {
	DevicesModbusPluginChannelPropertySchema,
	DevicesModbusPluginCreateChannelPropertySchema,
	DevicesModbusPluginUpdateChannelPropertySchema,
} from '../../../openapi.constants';
import { DEVICES_MODBUS_TYPE } from '../devices-modbus.constants';

type ApiCreateChannelProperty = DevicesModbusPluginCreateChannelPropertySchema;
type ApiUpdateChannelProperty = DevicesModbusPluginUpdateChannelPropertySchema;
type ApiChannelProperty = DevicesModbusPluginChannelPropertySchema;

export const ModbusChannelPropertySchema = ChannelPropertySchema;

// BACKEND API
// ===========

export const ModbusChannelPropertyCreateReqSchema: ZodType<ApiCreateChannelProperty> = ChannelPropertyCreateReqSchema.and(
	z.object({
		type: z.literal(DEVICES_MODBUS_TYPE),
	})
);

export const ModbusChannelPropertyUpdateReqSchema: ZodType<ApiUpdateChannelProperty> = ChannelPropertyUpdateReqSchema.and(
	z.object({
		type: z.literal(DEVICES_MODBUS_TYPE),
	})
);

export const ModbusChannelPropertyResSchema: ZodType<ApiChannelProperty> = ChannelPropertyResSchema.and(
	z.object({
		type: z.literal(DEVICES_MODBUS_TYPE),
	})
);
