import { z } from 'zod';

import {
	ConfigModuleSystemLog_levels,
	SystemModuleExtensionAdminSurface,
	SystemModuleExtensionBackendSurface,
	SystemModuleExtensionBaseKind,
	SystemModuleExtensionBaseSource,
	SystemModuleLogEntrySource,
} from '../../../openapi';

export const DisplaysProfilesFilterSchema = z.object({
	search: z.string().optional(),
});

export const SystemLogsFilterSchema = z.object({
	search: z.string().optional(),
	levels: z.array(z.nativeEnum(ConfigModuleSystemLog_levels)).default([]),
	sources: z.array(z.nativeEnum(SystemModuleLogEntrySource)).default([]),
	tag: z.string().optional(),
});

export const ExtensionsFilterSchema = z.object({
	search: z.string().optional(),
	kinds: z.array(z.nativeEnum(SystemModuleExtensionBaseKind)).default([]),
	surfaces: z.array(z.union([z.nativeEnum(SystemModuleExtensionAdminSurface), z.nativeEnum(SystemModuleExtensionBackendSurface)])).default([]),
	sources: z.array(z.nativeEnum(SystemModuleExtensionBaseSource)).default([]),
});
