import { type ZodType, z } from 'zod';

import { DeviceCreateReqSchema, DeviceResSchema, DeviceSchema, DeviceUpdateReqSchema } from '../../../modules/devices';
import type {
	DevicesModbusPluginCreateDeviceSchema,
	DevicesModbusPluginDeviceSchema,
	DevicesModbusPluginUpdateDeviceSchema,
} from '../../../openapi.constants';
import { DevicesModbusPluginByteOrder, DevicesModuleDeviceCategory } from '../../../openapi.constants';
import { DEVICES_MODBUS_TYPE } from '../devices-modbus.constants';

type ApiCreateDevice = DevicesModbusPluginCreateDeviceSchema;
type ApiUpdateDevice = DevicesModbusPluginUpdateDeviceSchema;
type ApiDevice = DevicesModbusPluginDeviceSchema;

export const ModbusDeviceSchema = DeviceSchema.extend({
	endpointId: z.string().uuid().nullable().optional(),
	unitId: z.number().int().nullable().optional(),
	pollIntervalMs: z.number().int().nullable().optional(),
	byteOrder: z.nativeEnum(DevicesModbusPluginByteOrder).optional(),
	wordOrder: z.nativeEnum(DevicesModbusPluginByteOrder).optional(),
	maxReadRegisters: z.number().int().nullable().optional(),
	maxReadBits: z.number().int().nullable().optional(),
	maxReadGap: z.number().int().nullable().optional(),
	templateId: z.string().nullable().optional(),
	templateRevision: z.string().nullable().optional(),
});

// BACKEND API
// ===========

// Modbus devices are created through `POST /plugins/devices-modbus/devices` (the wizard); the generic
// create route refuses them, so this request schema only types the contract.
export const ModbusDeviceCreateReqSchema: ZodType<ApiCreateDevice> = DeviceCreateReqSchema.and(
	z.object({
		type: z.literal(DEVICES_MODBUS_TYPE),
		endpoint_id: z.string().uuid(),
		unit_id: z.number().int(),
		poll_interval_ms: z.number().int().optional(),
		byte_order: z.nativeEnum(DevicesModbusPluginByteOrder).optional(),
		word_order: z.nativeEnum(DevicesModbusPluginByteOrder).optional(),
		max_read_registers: z.number().int().optional(),
		max_read_bits: z.number().int().optional(),
		max_read_gap: z.number().int().optional(),
		template_id: z.string().optional(),
		template_revision: z.string().optional(),
	})
);

export const ModbusDeviceUpdateReqSchema: ZodType<ApiUpdateDevice> = DeviceUpdateReqSchema.and(
	z.object({
		type: z.literal(DEVICES_MODBUS_TYPE),
		category: z.nativeEnum(DevicesModuleDeviceCategory).optional(),
		endpoint_id: z.string().uuid().optional(),
		unit_id: z.number().int().optional(),
		poll_interval_ms: z.number().int().optional(),
		byte_order: z.nativeEnum(DevicesModbusPluginByteOrder).optional(),
		word_order: z.nativeEnum(DevicesModbusPluginByteOrder).optional(),
		max_read_registers: z.number().int().optional(),
		max_read_bits: z.number().int().optional(),
		max_read_gap: z.number().int().optional(),
	})
);

export const ModbusDeviceResSchema: ZodType<ApiDevice> = DeviceResSchema.and(
	z.object({
		type: z.literal(DEVICES_MODBUS_TYPE),
		endpoint_id: z.string().uuid().nullable().optional(),
		unit_id: z.number().int().nullable().optional(),
		poll_interval_ms: z.number().int().nullable().optional(),
		byte_order: z.nativeEnum(DevicesModbusPluginByteOrder).optional(),
		word_order: z.nativeEnum(DevicesModbusPluginByteOrder).optional(),
		max_read_registers: z.number().int().nullable().optional(),
		max_read_bits: z.number().int().nullable().optional(),
		max_read_gap: z.number().int().nullable().optional(),
		template_id: z.string().nullable().optional(),
		template_revision: z.string().nullable().optional(),
	})
);
