import { type ZodType, z } from 'zod';

import { ConfigPluginResSchema, ConfigPluginSchema, ConfigPluginUpdateReqSchema } from '../../../modules/config/store/config-plugins.store.schemas';
import { Zigbee2mqttConnectionType, type DevicesZigbee2mqttPluginUpdateConfigSchema, type DevicesZigbee2mqttPluginConfigSchema } from '../../../openapi.constants';
import { DEVICES_ZIGBEE2MQTT_PLUGIN_NAME } from '../devices-zigbee2mqtt.constants';

type ApiUpdateConfig = DevicesZigbee2mqttPluginUpdateConfigSchema;
type ApiConfig = DevicesZigbee2mqttPluginConfigSchema;

export const Zigbee2mqttConfigSchema = ConfigPluginSchema.extend({
	connectionType: z.enum(['mqtt', 'ws']),
	mqtt: z.object({
		host: z.string(),
		port: z.number(),
		username: z.string().nullable(),
		// The backend redacts the password on read and answers with passwordConfigured
		// instead, so the stored config has no password at all. It stays declared
		// because the edit form writes a replacement into it before submitting.
		password: z.string().nullable().optional(),
		passwordConfigured: z.boolean().default(false),
		baseTopic: z.string(),
		clientId: z.string().nullable(),
		cleanSession: z.boolean(),
		keepalive: z.number(),
		connectTimeout: z.number(),
		reconnectInterval: z.number(),
	}),
	ws: z.object({
		host: z.string(),
		port: z.number(),
		baseTopic: z.string(),
		secure: z.boolean(),
		connectTimeout: z.number(),
		reconnectInterval: z.number(),
	}),
	tls: z.object({
		enabled: z.boolean(),
		rejectUnauthorized: z.boolean(),
		ca: z.string().nullable(),
		cert: z.string().nullable(),
		// The backend redacts the key on read and answers with keyConfigured
		// instead, so the stored config has no key at all. It stays declared
		// because the edit form writes a replacement into it before submitting.
		key: z.string().nullable().optional(),
		keyConfigured: z.boolean().default(false),
	}),
	discovery: z.object({
		autoAdd: z.boolean(),
		syncOnStartup: z.boolean(),
	}),
});

// BACKEND API
// ===========

export const Zigbee2mqttConfigUpdateReqSchema: ZodType<ApiUpdateConfig> = ConfigPluginUpdateReqSchema.and(
	z.object({
		type: z.literal(DEVICES_ZIGBEE2MQTT_PLUGIN_NAME),
		connection_type: z.nativeEnum(Zigbee2mqttConnectionType).optional(),
		mqtt: z
			.object({
				host: z.string().optional(),
				port: z.number().optional(),
				username: z.string().nullable().optional(),
				password: z.string().nullable().optional(),
				base_topic: z.string().optional(),
				client_id: z.string().nullable().optional(),
				clean_session: z.boolean().optional(),
				keepalive: z.number().optional(),
				connect_timeout: z.number().optional(),
				reconnect_interval: z.number().optional(),
			})
			.optional(),
		ws: z
			.object({
				host: z.string().optional(),
				port: z.number().optional(),
				base_topic: z.string().optional(),
				secure: z.boolean().optional(),
				connect_timeout: z.number().optional(),
				reconnect_interval: z.number().optional(),
			})
			.optional(),
		tls: z
			.object({
				enabled: z.boolean().optional(),
				reject_unauthorized: z.boolean().optional(),
				ca: z.string().nullable().optional(),
				cert: z.string().nullable().optional(),
				key: z.string().nullable().optional(),
			})
			.optional(),
		discovery: z
			.object({
				auto_add: z.boolean().optional(),
				sync_on_startup: z.boolean().optional(),
			})
			.optional(),
	})
);

export const Zigbee2mqttConfigResSchema: ZodType<ApiConfig> = ConfigPluginResSchema.and(
	z.object({
		type: z.literal(DEVICES_ZIGBEE2MQTT_PLUGIN_NAME),
		connection_type: z.nativeEnum(Zigbee2mqttConnectionType),
		mqtt: z.object({
			host: z.string(),
			port: z.number(),
			username: z.string().nullable(),
			password: z.string().nullable().optional(),
			password_configured: z.boolean(),
			base_topic: z.string(),
			client_id: z.string().nullable(),
			clean_session: z.boolean(),
			keepalive: z.number(),
			connect_timeout: z.number(),
			reconnect_interval: z.number(),
		}),
		ws: z.object({
			host: z.string(),
			port: z.number(),
			base_topic: z.string(),
			secure: z.boolean(),
			connect_timeout: z.number(),
			reconnect_interval: z.number(),
		}),
		tls: z.object({
			enabled: z.boolean(),
			reject_unauthorized: z.boolean(),
			ca: z.string().nullable(),
			cert: z.string().nullable(),
			key: z.string().nullable().optional(),
			key_configured: z.boolean(),
		}),
		discovery: z.object({
			auto_add: z.boolean(),
			sync_on_startup: z.boolean(),
		}),
	})
);
