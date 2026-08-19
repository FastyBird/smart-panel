import { z } from 'zod';

import { ExtensionKind } from '../extensions.constants';

export const ExtensionLinksSchema = z.object({
	documentation: z.string().optional(),
	devDocumentation: z.string().optional(),
	bugsTracking: z.string().optional(),
	repository: z.string().optional(),
	homepage: z.string().optional(),
});

export const ExtensionSchema = z.object({
	type: z.string(),
	kind: z.nativeEnum(ExtensionKind),
	name: z.string(),
	description: z.string().optional(),
	version: z.string().optional(),
	author: z.string().optional(),
	enabled: z.boolean(),
	isCore: z.boolean(),
	canToggleEnabled: z.boolean(),
	links: ExtensionLinksSchema.optional(),
});

export const ExtensionsBulkSetEnabledActionPayloadSchema = z.object({
	types: z.array(z.string()).nonempty(),
	enabled: z.boolean(),
});

export const ExtensionsBulkResultSchema = z.object({
	succeeded: z.array(z.string()),
	failed: z.array(z.object({ id: z.string(), reason: z.string() })),
});

export const ExtensionsUpdateActionPayloadSchema = z.object({
	type: z.string(),
	data: z.object({
		enabled: z.boolean(),
	}),
});
