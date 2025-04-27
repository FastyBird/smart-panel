import { type ZodType, z } from 'zod';

import { type components } from '../../../openapi';

type ApiConfigPlugin = components['schemas']['ConfigModulePlugin'];
type ApiConfigUpdatePlugin = components['schemas']['ConfigModuleUpdatePlugin'];

// STORE STATE
// ===========

export const ConfigPluginSchema = z.object({
	type: z.string(),
});

export const ConfigPluginsStateSemaphoreSchema = z.object({
	getting: z.array(z.string()),
	updating: z.array(z.string()),
});

// STORE ACTIONS
// =============

export const ConfigPluginsSetActionPayloadSchema = z.object({
	data: z.object({
		type: z.string(),
	}),
});

export const ConfigPluginsGetActionPayloadSchema = z.object({
	type: z.string(),
});

export const ConfigPluginsEditActionPayloadSchema = z.object({
	data: z.object({
		type: z.string(),
	}),
});

// BACKEND API
// ===========

export const ConfigPluginUpdateReqSchema: ZodType<ApiConfigUpdatePlugin> = z.object({
	type: z.string(),
});

export const ConfigPluginResSchema: ZodType<ApiConfigPlugin> = z.object({
	type: z.string(),
});
