import { type ZodType, z } from 'zod';

import { ConfigPluginResSchema, ConfigPluginSchema, ConfigPluginUpdateReqSchema } from '../../../modules/config/store/config-plugins.store.schemas';
import type { DevicesHomeKitPluginConfigSchema, DevicesHomeKitPluginUpdateConfigSchema } from '../../../openapi.constants';
import { DEVICES_HOMEKIT_PLUGIN_NAME } from '../devices-homekit.constants';

type ApiUpdateConfig = DevicesHomeKitPluginUpdateConfigSchema;
type ApiConfig = DevicesHomeKitPluginConfigSchema;

export const HomeKitConfigSchema = ConfigPluginSchema.extend({
	bridgeName: z.string().trim().min(1).default('Smart Panel Bridge'),
	port: z.number().int().min(1024).max(65535).default(51826),
	pincode: z.string().trim().optional(),
	pincodeConfigured: z.boolean().default(false),
	username: z.string().trim().default('1A:2B:3C:4D:5E:6F'),
	setupId: z.string().trim().default('SP01'),
	mappedDeviceIds: z.array(z.string().uuid()).default([]),
});

// BACKEND API
// ===========

export const HomeKitConfigUpdateReqSchema: ZodType<ApiUpdateConfig> = ConfigPluginUpdateReqSchema.and(
	z.object({
		type: z.literal(DEVICES_HOMEKIT_PLUGIN_NAME),
		bridge_name: z.string().trim().min(1).optional(),
		port: z.number().int().min(1024).max(65535).optional(),
		pincode: z.string().trim().optional(),
		username: z.string().trim().optional(),
		setup_id: z.string().trim().optional(),
		mapped_device_ids: z.array(z.string().uuid()).optional(),
	})
);

export const HomeKitConfigResSchema: ZodType<ApiConfig> = ConfigPluginResSchema.and(
	z.object({
		type: z.literal(DEVICES_HOMEKIT_PLUGIN_NAME),
		bridge_name: z.string().trim().min(1),
		port: z.number(),
		pincode: z.string().optional(),
		pincode_configured: z.boolean(),
		username: z.string(),
		setup_id: z.string(),
		mapped_device_ids: z.array(z.string()),
	})
);

