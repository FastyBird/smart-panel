import { z } from 'zod';

import { ConfigPluginResSchema, ConfigPluginSchema, ConfigPluginUpdateReqSchema } from '../../../modules/config/store/config-plugins.store.schemas';
import { DEVICES_ZIGBEE_HERDSMAN_PLUGIN_NAME } from '../devices-zigbee-herdsman.constants';

export const ZigbeeHerdsmanConfigSchema = ConfigPluginSchema.extend({
	serial: z.object({
		path: z.string(),
		baudRate: z.number(),
		adapterType: z.string(),
	}),
	network: z.object({
		channel: z.number(),
	}),
	discovery: z.object({
		permitJoinTimeout: z.number(),
		mainsDeviceTimeout: z.number(),
		batteryDeviceTimeout: z.number(),
		commandRetries: z.number(),
		syncOnStartup: z.boolean(),
	}),
	databasePath: z.string(),
});

// BACKEND API
// ===========

export const ZigbeeHerdsmanConfigUpdateReqSchema = ConfigPluginUpdateReqSchema.and(
	z.object({
		type: z.literal(DEVICES_ZIGBEE_HERDSMAN_PLUGIN_NAME),
		serial: z
			.object({
				path: z.string().optional(),
				baud_rate: z.number().optional(),
				adapter_type: z.string().optional(),
			})
			.optional(),
		network: z
			.object({
				channel: z.number().optional(),
			})
			.optional(),
		discovery: z
			.object({
				permit_join_timeout: z.number().optional(),
				mains_device_timeout: z.number().optional(),
				battery_device_timeout: z.number().optional(),
				command_retries: z.number().optional(),
				sync_on_startup: z.boolean().optional(),
			})
			.optional(),
		database_path: z.string().optional(),
	})
);

export const ZigbeeHerdsmanConfigResSchema = ConfigPluginResSchema.and(
	z.object({
		type: z.literal(DEVICES_ZIGBEE_HERDSMAN_PLUGIN_NAME),
		serial: z.object({
			path: z.string(),
			baud_rate: z.number(),
			adapter_type: z.string(),
		}),
		network: z.object({
			channel: z.number(),
		}),
		discovery: z.object({
			permit_join_timeout: z.number(),
			mains_device_timeout: z.number(),
			battery_device_timeout: z.number(),
			command_retries: z.number(),
			sync_on_startup: z.boolean(),
		}),
		database_path: z.string(),
	})
);
