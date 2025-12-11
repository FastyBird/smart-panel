import { type ZodType, z } from 'zod';

import type { ConfigModuleAppSchema } from '../../../openapi.constants';

// Language, weather, and system schemas removed - these configs are now accessed via modules
import { ConfigModuleResSchema, ConfigModuleSchema } from './config-modules.store.schemas';
import { ConfigPluginResSchema, ConfigPluginSchema } from './config-plugins.store.schemas';

type ApiConfigApp = ConfigModuleAppSchema;

// STORE STATE
// ===========
// Note: Display config is now managed via DisplaysModule

export const ConfigAppSchema = z.object({
	path: z.string().nonempty(),
	// Language, weather, and system configs moved to modules (system-module, weather-module)
	plugins: z.array(ConfigPluginSchema),
	modules: z.array(ConfigModuleSchema),
});

export const ConfigAppStateSemaphoreSchema = z.object({
	getting: z.boolean(),
});

// STORE ACTIONS
// =============

export const ConfigAppOnEventActionPayloadSchema = z.object({
	data: z.object({
		path: z.string().nonempty(),
		// Language, weather, and system configs moved to modules
		plugins: z.array(ConfigPluginSchema),
		modules: z.array(ConfigModuleSchema),
	}),
});

export const ConfigAppSetActionPayloadSchema = z.object({
	data: z.object({
		path: z.string().nonempty(),
		// Language, weather, and system configs moved to modules
		plugins: z.array(ConfigPluginSchema),
		modules: z.array(ConfigModuleSchema),
	}),
});

// BACKEND API
// ===========

// Note: Backend API may still return language/weather/system for backward compatibility, but they're ignored
export const ConfigAppResSchema: ZodType<ApiConfigApp> = z.object({
	path: z.string().nonempty(),
	// Language, weather, and system configs moved to modules - backend may still return them but we ignore them
	plugins: z.array(ConfigPluginResSchema),
	modules: z.array(ConfigModuleResSchema),
}).passthrough(); // Allow extra fields for backward compatibility
