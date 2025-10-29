import { type ZodType, z } from 'zod';

import {
	SystemModuleExtensionAdminSurface,
	SystemModuleExtensionBackendSurface,
	SystemModuleExtensionBaseKind,
	SystemModuleExtensionBaseSource,
	type components,
} from '../../../openapi';

type ApiExtensionAdmin = components['schemas']['SystemModuleExtensionAdmin'];
type ApiExtensionBackend = components['schemas']['SystemModuleExtensionBackend'];

export const ExtensionNameSchema = z.string();

// STORE STATE
// ===========

export const ExtensionBaseSchema = z.object({
	name: ExtensionNameSchema,
	kind: z.nativeEnum(SystemModuleExtensionBaseKind),
	surface: z.string(),
	displayName: z.string(),
	description: z.string().nullable(),
	version: z.string().nullable(),
	source: z.nativeEnum(SystemModuleExtensionBaseSource),
});

export const ExtensionSchema = z.union([
	ExtensionBaseSchema.extend({
		surface: z.nativeEnum(SystemModuleExtensionAdminSurface),
		remoteUrl: z.string(),
	}),
	ExtensionBaseSchema.extend({
		surface: z.nativeEnum(SystemModuleExtensionBackendSurface),
		routePrefix: z.string(),
	}),
]);

export const ExtensionsStateSemaphoreSchema = z.object({
	fetching: z.object({
		items: z.boolean().default(false),
		item: z.array(ExtensionNameSchema),
	}),
});

// STORE ACTIONS
// =============

export const ExtensionsGetActionPayloadSchema = z.object({
	name: ExtensionNameSchema,
});

// BACKEND API
// ===========

export const ExtensionAdminResSchema: ZodType<ApiExtensionAdmin> = z.object({
	name: z.string(),
	kind: z.nativeEnum(SystemModuleExtensionBaseKind),
	surface: z.nativeEnum(SystemModuleExtensionAdminSurface),
	display_name: z.string(),
	description: z.string().nullable(),
	version: z.string().nullable(),
	source: z.nativeEnum(SystemModuleExtensionBaseSource),
	remote_url: z.string(),
});

export const ExtensionBackendResSchema: ZodType<ApiExtensionBackend> = z.object({
	name: z.string(),
	kind: z.nativeEnum(SystemModuleExtensionBaseKind),
	surface: z.nativeEnum(SystemModuleExtensionBackendSurface),
	display_name: z.string(),
	description: z.string().nullable(),
	version: z.string().nullable(),
	source: z.nativeEnum(SystemModuleExtensionBaseSource),
	route_prefix: z.string(),
});

export const ExtensionResSchema: ZodType<ApiExtensionAdmin | ApiExtensionBackend> = z.union([ExtensionAdminResSchema, ExtensionBackendResSchema]);
