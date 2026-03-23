import { type ZodType, z } from 'zod';

import { ConfigPluginResSchema, ConfigPluginSchema, ConfigPluginUpdateReqSchema } from '../../../modules/config/store/config-plugins.store.schemas';
import { MEMORY_STORAGE_PLUGIN_NAME } from '../memory-storage.constants';

type ApiUpdateConfig = {
	type: typeof MEMORY_STORAGE_PLUGIN_NAME;
	enabled?: boolean;
};

type ApiConfig = {
	type: typeof MEMORY_STORAGE_PLUGIN_NAME;
	enabled: boolean;
};

export const MemoryStorageConfigSchema = ConfigPluginSchema.extend({});

// BACKEND API
// ===========

export const MemoryStorageConfigUpdateReqSchema: ZodType<ApiUpdateConfig> = ConfigPluginUpdateReqSchema.and(
	z.object({
		type: z.literal(MEMORY_STORAGE_PLUGIN_NAME),
	})
);

export const MemoryStorageConfigResSchema: ZodType<ApiConfig> = ConfigPluginResSchema.and(
	z.object({
		type: z.literal(MEMORY_STORAGE_PLUGIN_NAME),
	})
);
