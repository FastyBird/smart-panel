import { type ZodType, z } from 'zod';

import type {
	AutomationsModuleTemplateDraftSchema,
	AutomationsModuleTemplateParameterSchema,
	AutomationsModuleTemplateSchema,
} from '../../../openapi.constants';
import { AutomationMode, AutomationTemplateParameterType, AutomationTemplateSource } from '../automations.constants';

import { AutomationGraphSchema } from './automations.store.schemas';

type ApiTemplate = AutomationsModuleTemplateSchema;
type ApiTemplateParameter = AutomationsModuleTemplateParameterSchema;
type ApiTemplateDraft = AutomationsModuleTemplateDraftSchema;

// STORE STATE
// ===========

// One question of a template. Which of the optional fields are set depends on its type.
export const AutomationTemplateParameterSchema = z.object({
	id: z.string().nonempty(),
	type: z.nativeEnum(AutomationTemplateParameterType),
	label: z.string(),
	description: z.string().nullable().default(null),
	// A device property question: watched (readable) or set (writable), and the kinds of property it takes
	access: z.enum(['readable', 'writable']).nullable().default(null),
	channelCategories: z.array(z.string()).default([]),
	propertyCategories: z.array(z.string()).default([]),
	dataTypes: z.array(z.string()).default([]),
	// A duration (seconds) or a number
	min: z.number().nullable().default(null),
	max: z.number().nullable().default(null),
	step: z.number().nullable().default(null),
	unit: z.string().nullable().default(null),
	// A text
	maxLength: z.number().int().nullable().default(null),
	default: z.union([z.number(), z.string()]).nullable().default(null),
});

export const AutomationTemplateSchema = z.object({
	id: z.string().nonempty(),
	name: z.string(),
	description: z.string().default(''),
	icon: z.string().nullable().default(null),
	mode: z.nativeEnum(AutomationMode),
	// Only a built-in template is the one the admin knows and translates; a user's own, even one replacing a
	// built-in id, is shown as the backend gives it. Taken for a user's own when it is not said.
	source: z.nativeEnum(AutomationTemplateSource).default(AutomationTemplateSource.user),
	parameters: z.array(AutomationTemplateParameterSchema),
});

// What a template generated: what a new automation is created with. It names the template nowhere.
export const AutomationTemplateDraftSchema = z.object({
	name: z.string(),
	mode: z.nativeEnum(AutomationMode),
	graph: AutomationGraphSchema,
});

// One refused answer (`error.details.issues` of the 422 response)
export const AutomationTemplateIssueSchema = z.object({
	field: z.string(),
	reason: z.string(),
});

export const AutomationTemplatesStateSemaphoreSchema = z.object({
	fetching: z.boolean().default(false),
	generating: z.array(z.string()).default([]),
});

// STORE ACTIONS
// =============

export const AutomationTemplatesGenerateActionPayloadSchema = z.object({
	id: z.string().nonempty(),
	// Keyed by parameter id and sent as given: the answers to device property questions carry snake_case ids
	parameters: z.record(z.string(), z.unknown()),
});

// BACKEND API
// ===========

export const AutomationTemplateParameterResSchema: ZodType<ApiTemplateParameter> = z.object({
	id: z.string(),
	type: z.nativeEnum(AutomationTemplateParameterType),
	label: z.string(),
	description: z.string().optional(),
	access: z.enum(['readable', 'writable']).optional() as ZodType<ApiTemplateParameter['access']>,
	channel_categories: z.array(z.string()).optional(),
	property_categories: z.array(z.string()).optional(),
	data_types: z.array(z.string()).optional(),
	min: z.number().optional(),
	max: z.number().optional(),
	step: z.number().optional(),
	unit: z.string().optional(),
	max_length: z.number().optional(),
	default: z.union([z.number(), z.string()]).optional(),
});

export const AutomationTemplateResSchema: ZodType<ApiTemplate> = z.object({
	id: z.string(),
	name: z.string(),
	description: z.string(),
	icon: z.string().nullable(),
	mode: z.nativeEnum(AutomationMode),
	source: z.nativeEnum(AutomationTemplateSource),
	parameters: z.array(AutomationTemplateParameterResSchema),
});

export const AutomationTemplateDraftResSchema: ZodType<ApiTemplateDraft> = z.object({
	name: z.string(),
	mode: z.nativeEnum(AutomationMode),
	graph: AutomationGraphSchema,
});
