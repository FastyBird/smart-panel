import { type ZodType, z } from 'zod';

import type { components } from '../../../openapi';

import { HomeAssistantStateResSchema } from './home-assistant-states.store.schemas';

type ApiDiscoveredDevice = components['schemas']['DevicesHomeAssistantPluginDataDiscoveredDevice'];

// STORE STATE
// ===========

export const HomeAssistantDiscoveredDeviceSchema = z.object({
	id: z.string().trim().nonempty(),
	name: z.string().trim().nonempty(),
	entities: z.array(z.string().trim().nonempty()),
	adoptedDeviceId: z.string().uuid().nullable(),
});

export const HomeAssistantDiscoveredDevicesStateSemaphoreSchema = z.object({
	fetching: z.object({
		items: z.boolean().default(false),
		item: z.array(z.string()),
	}),
});

// STORE ACTIONS
// =============

export const HomeAssistantDiscoveredDevicesSetActionPayloadSchema = z.object({
	id: z.string().trim().nonempty(),
	data: z.object({
		name: z.string().trim().nonempty(),
		entities: z.array(z.string().trim().nonempty()),
		adoptedDeviceId: z.string().uuid().nullable(),
	}),
});

export const HomeAssistantDiscoveredDevicesUnsetActionPayloadSchema = z.object({
	id: z.string().trim().nonempty(),
});

export const HomeAssistantDiscoveredDevicesGetActionPayloadSchema = z.object({
	id: z.string().trim().nonempty(),
});

// BACKEND API
// ===========

export const HomeAssistantDiscoveredDeviceResSchema: ZodType<ApiDiscoveredDevice> = z.object({
	id: z.string().trim().nonempty(),
	name: z.string().trim().nonempty(),
	entities: z.array(z.string().trim().nonempty()),
	adopted_device_id: z.string().uuid().nullable(),
	states: z.array(HomeAssistantStateResSchema),
});
