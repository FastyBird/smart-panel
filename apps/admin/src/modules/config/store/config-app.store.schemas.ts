import { type ZodType, z } from 'zod';

import type { ConfigModuleAppSchema } from '../../../openapi.constants';

// Language, weather, and system schemas removed - these configs are now accessed via modules
import { ConfigModuleSchema } from './config-modules.store.schemas';
import { ConfigPluginSchema } from './config-plugins.store.schemas';

type ApiConfigApp = ConfigModuleAppSchema;

// STORE STATE
// ===========
// Note: Display config is now managed via DisplaysModule

export const ConfigAppSchema = z.object({
	path: z.string().nonempty(),
	// Language, weather, and system configs moved to modules (system-module, weather-module)
	// Use passthrough() to preserve plugin-specific fields (apiKey, hostname, etc.)
	plugins: z.array(ConfigPluginSchema.passthrough()),
	modules: z.array(ConfigModuleSchema.passthrough()),
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
		// Use passthrough() to preserve plugin-specific fields
		plugins: z.array(ConfigPluginSchema.passthrough()),
		modules: z.array(ConfigModuleSchema.passthrough()),
	}),
});

export const ConfigAppSetActionPayloadSchema = z.object({
	data: z.object({
		path: z.string().nonempty(),
		// Language, weather, and system configs moved to modules
		// Use passthrough() to preserve plugin-specific fields
		plugins: z.array(ConfigPluginSchema.passthrough()),
		modules: z.array(ConfigModuleSchema.passthrough()),
	}),
});

// BACKEND API
// ===========

// Note: Backend API may still return language/weather/system for backward compatibility, but they're ignored
// Use passthrough schemas to preserve plugin/module-specific fields (apiKey, hostname, etc.)
export const ConfigAppResSchema: ZodType<ApiConfigApp> = z.object({
	path: z.string().nonempty(),
	// Language, weather, and system configs moved to modules - backend may still return them but we ignore them
	plugins: z.array(z.object({ type: z.string(), enabled: z.boolean() }).passthrough()),
	modules: z.array(z.object({ type: z.string(), enabled: z.boolean() }).passthrough()),
}).passthrough(); // Allow extra fields for backward compatibility
