import { type ZodType, z } from 'zod';

import {
	SystemModuleExtensionAdminSurface,
	SystemModuleExtensionBackendSurface,
	SystemModuleDataExtensionBaseKind,
	SystemModuleDataExtensionBaseSource,
	type components,
} from '../../../openapi';

type ApiExtensionAdmin = components['schemas']['SystemModuleDataExtensionAdmin'];
type ApiExtensionBackend = components['schemas']['SystemModuleDataExtensionBackend'];

export const ExtensionNameSchema = z.string();

// STORE STATE
// ===========

export const ExtensionBaseSchema = z.object({
	name: ExtensionNameSchema,
	kind: z.nativeEnum(SystemModuleDataExtensionBaseKind),
	surface: z.string(),
	displayName: z.string(),
	description: z.string().nullable(),
	version: z.string().nullable(),
	source: z.nativeEnum(SystemModuleDataExtensionBaseSource),
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
	kind: z.nativeEnum(SystemModuleDataExtensionBaseKind),
	surface: z.nativeEnum(SystemModuleExtensionAdminSurface),
	display_name: z.string(),
	description: z.string().nullable(),
	version: z.string().nullable(),
	source: z.nativeEnum(SystemModuleDataExtensionBaseSource),
	remote_url: z.string(),
});

export const ExtensionBackendResSchema: ZodType<ApiExtensionBackend> = z.object({
	name: z.string(),
	kind: z.nativeEnum(SystemModuleDataExtensionBaseKind),
	surface: z.nativeEnum(SystemModuleExtensionBackendSurface),
	display_name: z.string(),
	description: z.string().nullable(),
	version: z.string().nullable(),
	source: z.nativeEnum(SystemModuleDataExtensionBaseSource),
	route_prefix: z.string(),
});

export const ExtensionResSchema: ZodType<ApiExtensionAdmin | ApiExtensionBackend> = z.union([ExtensionAdminResSchema, ExtensionBackendResSchema]);
