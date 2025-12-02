import { type ZodType, z } from 'zod';

import { SystemModuleDataExtensionAdminType, SystemModuleDataExtensionBackendType, type components } from '../../../openapi.constants';
import { SystemModuleExtensionKind, SystemModuleExtensionSource, SystemModuleExtensionSurface } from '../../../openapi.constants';

type ApiExtensionAdmin = components['schemas']['SystemModuleDataExtensionAdmin'];
type ApiExtensionBackend = components['schemas']['SystemModuleDataExtensionBackend'];

export const ExtensionNameSchema = z.string();

// STORE STATE
// ===========

export const ExtensionBaseSchema = z.object({
	name: ExtensionNameSchema,
	kind: z.nativeEnum(SystemModuleExtensionKind),
	surface: z.string(),
	displayName: z.string(),
	description: z.string().nullable(),
	version: z.string().nullable(),
	source: z.nativeEnum(SystemModuleExtensionSource),
});

export const ExtensionSchema = z.union([
	ExtensionBaseSchema.extend({
		surface: z.nativeEnum(SystemModuleExtensionSurface),
		remoteUrl: z.string(),
	}),
	ExtensionBaseSchema.extend({
		surface: z.nativeEnum(SystemModuleExtensionSurface),
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
	kind: z.nativeEnum(SystemModuleExtensionKind),
	surface: z.nativeEnum(SystemModuleExtensionSurface),
	display_name: z.string(),
	description: z.string().nullable(),
	version: z.string().nullable(),
	source: z.nativeEnum(SystemModuleExtensionSource),
	remote_url: z.string(),
	type: z.nativeEnum(SystemModuleDataExtensionAdminType),
});

export const ExtensionBackendResSchema: ZodType<ApiExtensionBackend> = z.object({
	name: z.string(),
	kind: z.nativeEnum(SystemModuleExtensionKind),
	surface: z.nativeEnum(SystemModuleExtensionSurface),
	display_name: z.string(),
	description: z.string().nullable(),
	version: z.string().nullable(),
	source: z.nativeEnum(SystemModuleExtensionSource),
	route_prefix: z.string(),
	type: z.nativeEnum(SystemModuleDataExtensionBackendType),
});

export const ExtensionResSchema: ZodType<ApiExtensionAdmin | ApiExtensionBackend> = z.union([ExtensionAdminResSchema, ExtensionBackendResSchema]);
