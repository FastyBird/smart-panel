import { z } from 'zod';

import { SystemModuleExtensionSurface, SystemModuleLogEntrySource, SystemModuleLogEntryType } from '../../../openapi.constants';
import { SystemModuleExtensionKind, SystemModuleExtensionSource } from '../../../openapi.constants';

export const DisplaysProfilesFilterSchema = z.object({
	search: z.string().optional(),
});

export const SystemLogsFilterSchema = z.object({
	search: z.string().optional(),
	levels: z.array(z.nativeEnum(SystemModuleLogEntryType)).default([]),
	sources: z.array(z.nativeEnum(SystemModuleLogEntrySource)).default([]),
	tag: z.string().optional(),
});

export const ExtensionsFilterSchema = z.object({
	search: z.string().optional(),
	kinds: z.array(z.nativeEnum(SystemModuleExtensionKind)).default([]),
	surfaces: z.array(z.nativeEnum(SystemModuleExtensionSurface)).default([]),
	sources: z.array(z.nativeEnum(SystemModuleExtensionSource)).default([]),
});
