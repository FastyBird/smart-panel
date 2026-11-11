import { type ZodType, z } from 'zod';

import { ConfigPluginResSchema, ConfigPluginSchema, ConfigPluginUpdateReqSchema } from '../../../modules/config/store/config-plugins.store.schemas';
import type { DevicesModbusPluginConfigSchema, DevicesModbusPluginUpdateConfigSchema } from '../../../openapi.constants';
import { DEVICES_MODBUS_PLUGIN_NAME } from '../devices-modbus.constants';

type ApiUpdateConfig = DevicesModbusPluginUpdateConfigSchema;
type ApiConfig = DevicesModbusPluginConfigSchema;

export const ModbusConfigSchema = ConfigPluginSchema.extend({
	defaultConnectTimeoutMs: z.number(),
	defaultRequestTimeoutMs: z.number(),
	defaultPollIntervalMs: z.number(),
});

// BACKEND API
// ===========

export const ModbusConfigUpdateReqSchema: ZodType<ApiUpdateConfig> = ConfigPluginUpdateReqSchema.and(
	z.object({
		type: z.literal(DEVICES_MODBUS_PLUGIN_NAME),
		default_connect_timeout_ms: z.number().optional(),
		default_request_timeout_ms: z.number().optional(),
		default_poll_interval_ms: z.number().optional(),
	})
);

export const ModbusConfigResSchema: ZodType<ApiConfig> = ConfigPluginResSchema.and(
	z.object({
		type: z.literal(DEVICES_MODBUS_PLUGIN_NAME),
		default_connect_timeout_ms: z.number(),
		default_request_timeout_ms: z.number(),
		default_poll_interval_ms: z.number(),
	})
);
