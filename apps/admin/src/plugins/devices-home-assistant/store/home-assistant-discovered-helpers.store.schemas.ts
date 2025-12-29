import { type ZodType, z } from 'zod';

import type { DevicesHomeAssistantPluginDiscoveredHelperSchema } from '../../../openapi.constants';

import { HomeAssistantStateSchema } from './home-assistant-states.store.schemas';

type ApiDiscoveredHelper = DevicesHomeAssistantPluginDiscoveredHelperSchema;

// STORE STATE
// ===========

export const HomeAssistantDiscoveredHelperSchema = z.object({
	entityId: z.string().trim().nonempty(),
	name: z.string().trim(),
	domain: z.string().trim().nonempty(),
	adoptedDeviceId: z.string().uuid().nullable(),
	state: HomeAssistantStateSchema.nullable().optional(),
});

export const HomeAssistantDiscoveredHelpersStateSemaphoreSchema = z.object({
	fetching: z.object({
		items: z.boolean().default(false),
		item: z.array(z.string()),
	}),
});

// STORE ACTIONS
// =============

export const HomeAssistantDiscoveredHelpersSetActionPayloadSchema = z.object({
	entityId: z.string().trim().nonempty(),
	data: z.object({
		name: z.string().trim(),
		domain: z.string().trim().nonempty(),
		adoptedDeviceId: z.string().uuid().nullable(),
	}),
});

export const HomeAssistantDiscoveredHelpersUnsetActionPayloadSchema = z.object({
	entityId: z.string().trim().nonempty(),
});

export const HomeAssistantDiscoveredHelpersGetActionPayloadSchema = z.object({
	entityId: z.string().trim().nonempty(),
});

// BACKEND API
// ===========

export const HomeAssistantDiscoveredHelperResSchema: ZodType<ApiDiscoveredHelper> = z.object({
	entity_id: z.string().trim().nonempty(),
	name: z.string().trim(),
	domain: z.string().trim().nonempty(),
	adopted_device_id: z.string().uuid().nullable(),
	state: z
		.object({
			entity_id: z.string().trim().nonempty(),
			state: z.union([z.string(), z.number(), z.boolean()]).nullable(),
			attributes: z.record(z.string(), z.unknown()),
			last_changed: z.string().datetime().nullable().optional(),
			last_reported: z.string().datetime().nullable().optional(),
			last_updated: z.string().datetime().nullable().optional(),
		})
		.nullable()
		.optional(),
});
