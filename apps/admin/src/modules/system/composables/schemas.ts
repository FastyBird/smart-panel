import { z } from 'zod';

import {
	ConfigModuleSystemLog_levels,
	SystemModuleExtensionSurface,
	SystemModuleExtensionBackendSurface,
	SystemModuleLogEntrySource,
} from '../../../openapi.constants';

import {
	SystemModuleDataExtensionBaseKind,
	SystemModuleDataExtensionBaseSource,
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
	kinds: z.array(z.nativeEnum(SystemModuleDataExtensionBaseKind)).default([]),
	surfaces: z.array(z.union([z.nativeEnum(SystemModuleExtensionSurface), z.nativeEnum(SystemModuleExtensionBackendSurface)])).default([]),
	sources: z.array(z.nativeEnum(SystemModuleDataExtensionBaseSource)).default([]),
});
