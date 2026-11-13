import { type ZodType, z } from 'zod';

import type { AutomationsModuleNodeTypeSchema } from '../../../openapi.constants';
import { AutomationNodeKind } from '../automations.constants';

type ApiNodeType = AutomationsModuleNodeTypeSchema;

// STORE STATE
// ===========

export const AutomationNodeTypePortsSchema = z.object({
	inputs: z.array(z.string()),
	outputs: z.array(z.string()),
});

// One card of the catalogue. The config schema is a JSON Schema document: it is kept as received and
// never passed through the case converters, because its property names are configuration keys.
export const AutomationNodeTypeSchema = z.object({
	type: z.string().nonempty(),
	kind: z.nativeEnum(AutomationNodeKind),
	name: z.string(),
	description: z.string().default(''),
	ports: AutomationNodeTypePortsSchema,
	configSchema: z.record(z.string(), z.unknown()).default({ type: 'object', additionalProperties: true }),
	// Why the card can not be used at the moment (a sun card without a house location); null or left out while it can
	unavailableReason: z.string().nullable().optional(),
});

export const AutomationNodeTypesStateSemaphoreSchema = z.object({
	fetching: z.boolean().default(false),
});

// BACKEND API
// ===========

export const AutomationNodeTypeResSchema: ZodType<ApiNodeType> = z.object({
	type: z.string(),
	kind: z.nativeEnum(AutomationNodeKind),
	name: z.string(),
	description: z.string(),
	ports: AutomationNodeTypePortsSchema,
	config_schema: z.record(z.string(), z.unknown()),
	// Defaulted so a backend that predates it still parses
	unavailable_reason: z.string().nullable().default(null),
});
