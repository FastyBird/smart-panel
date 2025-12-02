import { type ZodType, z } from 'zod';

import { type components } from '../../../openapi.constants';
import { ItemIdSchema } from '../../devices';

type ApiConfigPlugin = components['schemas']['ConfigModuleDataPlugin'];
type ApiConfigUpdatePlugin = components['schemas']['ConfigModuleUpdatePlugin'];

// STORE STATE
// ===========

export const ConfigPluginSchema = z.object({
	type: z.string(),
	enabled: z.boolean().default(false),
});

export const ConfigPluginsStateSemaphoreSchema = z.object({
	fetching: z.object({
		items: z.boolean().default(false),
		item: z.array(ItemIdSchema),
	}),
	updating: z.array(z.string()),
});

// STORE ACTIONS
// =============

export const ConfigPluginsOnEventActionPayloadSchema = z.object({
	type: z.string(),
	data: z.object({}),
});

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
	enabled: z.boolean().optional(),
});

export const ConfigPluginResSchema: ZodType<ApiConfigPlugin> = z.object({
	type: z.string(),
	enabled: z.boolean(),
});
