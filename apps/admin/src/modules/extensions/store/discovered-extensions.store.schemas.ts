import { z } from 'zod';

import { ExtensionKind, ExtensionSource, ExtensionSurface } from '../extensions.constants';

export const DiscoveredExtensionNameSchema = z.string();

// STORE STATE
// ===========

export const DiscoveredExtensionBaseSchema = z.object({
	name: DiscoveredExtensionNameSchema,
	kind: z.nativeEnum(ExtensionKind),
	surface: z.nativeEnum(ExtensionSurface),
	displayName: z.string(),
	description: z.string().nullable(),
	version: z.string().nullable(),
	source: z.nativeEnum(ExtensionSource),
});

export const DiscoveredExtensionAdminSchema = DiscoveredExtensionBaseSchema.extend({
	remoteUrl: z.string(),
});

export const DiscoveredExtensionBackendSchema = DiscoveredExtensionBaseSchema.extend({
	routePrefix: z.string(),
});

export const DiscoveredExtensionSchema = z.union([
	DiscoveredExtensionAdminSchema,
	DiscoveredExtensionBackendSchema,
]);

export const DiscoveredExtensionsStateSemaphoreSchema = z.object({
	fetching: z.object({
		items: z.boolean().default(false),
		item: z.array(DiscoveredExtensionNameSchema),
	}),
});

// STORE ACTIONS
// =============

export const DiscoveredExtensionsGetActionPayloadSchema = z.object({
	name: DiscoveredExtensionNameSchema,
});

// BACKEND API
// ===========

export const DiscoveredExtensionAdminResSchema = z.object({
	name: z.string(),
	kind: z.nativeEnum(ExtensionKind),
	surface: z.nativeEnum(ExtensionSurface),
	display_name: z.string(),
	description: z.string().nullable(),
	version: z.string().nullable(),
	source: z.nativeEnum(ExtensionSource),
	remote_url: z.string(),
	type: z.literal('admin'),
});

export const DiscoveredExtensionBackendResSchema = z.object({
	name: z.string(),
	kind: z.nativeEnum(ExtensionKind),
	surface: z.nativeEnum(ExtensionSurface),
	display_name: z.string(),
	description: z.string().nullable(),
	version: z.string().nullable(),
	source: z.nativeEnum(ExtensionSource),
	route_prefix: z.string(),
	type: z.literal('backend'),
});

export const DiscoveredExtensionResSchema = z.union([
	DiscoveredExtensionAdminResSchema,
	DiscoveredExtensionBackendResSchema,
]);
