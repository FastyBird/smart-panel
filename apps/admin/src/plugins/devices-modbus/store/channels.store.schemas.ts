import { type ZodType, z } from 'zod';

import { ChannelCreateReqSchema, ChannelResSchema, ChannelSchema, ChannelUpdateReqSchema } from '../../../modules/devices';
import type {
	DevicesModbusPluginChannelSchema,
	DevicesModbusPluginCreateChannelSchema,
	DevicesModbusPluginUpdateChannelSchema,
} from '../../../openapi.constants';
import { DEVICES_MODBUS_TYPE } from '../devices-modbus.constants';

type ApiCreateChannel = DevicesModbusPluginCreateChannelSchema;
type ApiUpdateChannel = DevicesModbusPluginUpdateChannelSchema;
type ApiChannel = DevicesModbusPluginChannelSchema;

export const ModbusChannelSchema = ChannelSchema;

// BACKEND API
// ===========

export const ModbusChannelCreateReqSchema: ZodType<ApiCreateChannel> = ChannelCreateReqSchema.and(
	z.object({
		type: z.literal(DEVICES_MODBUS_TYPE),
	})
);

export const ModbusChannelUpdateReqSchema: ZodType<ApiUpdateChannel> = ChannelUpdateReqSchema.and(
	z.object({
		type: z.literal(DEVICES_MODBUS_TYPE),
	})
);

export const ModbusChannelResSchema: ZodType<ApiChannel> = ChannelResSchema.and(
	z.object({
		type: z.literal(DEVICES_MODBUS_TYPE),
	})
);
