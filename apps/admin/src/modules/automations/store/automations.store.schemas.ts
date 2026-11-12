import { v4 as uuid } from 'uuid';
import { type ZodType, z } from 'zod';

import type { AutomationsModuleCreateAutomationSchema, AutomationsModuleUpdateAutomationSchema } from '../../../openapi.constants';
import {
	AUTOMATION_DESCRIPTION_MAX_LENGTH,
	AUTOMATION_NAME_MAX_LENGTH,
	AutomationMode,
	AutomationRunStatus,
	AutomationStatus,
} from '../automations.constants';

import { ItemIdSchema } from './types';

type ApiCreateAutomation = AutomationsModuleCreateAutomationSchema;
type ApiUpdateAutomation = AutomationsModuleUpdateAutomationSchema;

const DateSchema = z.union([z.string().datetime({ offset: true }), z.date()]).transform((date) => (date instanceof Date ? date : new Date(date)));

const DescriptionSchema = z
	.string()
	.trim()
	.max(AUTOMATION_DESCRIPTION_MAX_LENGTH)
	.transform((val) => (val === '' ? null : val))
	.nullable()
	.optional();

// GRAPH
// =====

// The graph is one JSON document. The wire format and the stored format are the same, so it is kept
// as received - snake_case keys included - and never passed through the case converters: node
// configurations belong to the node types and their keys must reach the backend untouched.
export const AutomationGraphNodeSchema = z.object({
	id: z.string().nonempty(),
	type: z.string().nonempty(),
	position: z.object({
		x: z.number(),
		y: z.number(),
	}),
	config: z.record(z.string(), z.unknown()),
});

export const AutomationGraphEdgeSchema = z.object({
	id: z.string().nonempty(),
	source: z.string().nonempty(),
	source_port: z.string().nonempty(),
	target: z.string().nonempty(),
	target_port: z.string().nonempty(),
});

export const AutomationGraphSchema = z.object({
	version: z.number().int(),
	nodes: z.array(AutomationGraphNodeSchema),
	edges: z.array(AutomationGraphEdgeSchema),
});

// One issue of a graph the backend refused to save (`error.details.issues` of the 422 response)
export const AutomationGraphIssueSchema = z.object({
	severity: z.enum(['error', 'warning']),
	code: z.string(),
	message: z.string(),
	blocking: z.boolean().default(true),
	node_id: z.string().optional(),
	edge_id: z.string().optional(),
	node_ids: z.array(z.string()).optional(),
	field: z.string().optional(),
});

// What the backend makes of a graph without saving it
export const AutomationGraphValidationSchema = z.object({
	valid: z.boolean(),
	issues: z.array(AutomationGraphIssueSchema),
});

// STORE STATE
// ===========

export const AutomationSchema = z.object({
	id: ItemIdSchema,
	name: z.string().trim().nonempty(),
	description: z.string().trim().nullable().default(null),
	icon: z.string().trim().nullable().default(null),
	enabled: z.boolean().default(false),
	spaceId: ItemIdSchema.nullable().default(null),
	mode: z.nativeEnum(AutomationMode).default(AutomationMode.restart),
	// Lists come without the graph; it is known only once the automation was read on its own
	graph: AutomationGraphSchema.nullable().default(null),
	revision: z.number().int().min(1).default(1),
	status: z.nativeEnum(AutomationStatus).default(AutomationStatus.ok),
	lastTriggeredAt: DateSchema.nullable().default(null),
	lastRunStatus: z.nativeEnum(AutomationRunStatus).nullable().default(null),
	createdAt: DateSchema,
	updatedAt: DateSchema.optional().nullable().default(null),
});

export const AutomationsStateSemaphoreSchema = z.object({
	fetching: z.object({
		items: z.boolean().default(false),
		item: z.array(ItemIdSchema),
	}),
	creating: z.array(ItemIdSchema),
	updating: z.array(ItemIdSchema),
	deleting: z.array(ItemIdSchema),
});

// STORE ACTIONS
// =============

export const AutomationsOnEventActionPayloadSchema = z.object({
	id: ItemIdSchema,
	data: z.looseObject({}),
});

export const AutomationsSetActionPayloadSchema = z.object({
	id: ItemIdSchema,
	data: AutomationSchema.omit({ id: true }).partial().catchall(z.unknown()),
});

export const AutomationsUnsetActionPayloadSchema = z.object({
	id: ItemIdSchema,
});

export const AutomationsGetActionPayloadSchema = z.object({
	id: ItemIdSchema,
});

export const AutomationsAddActionPayloadSchema = z.object({
	id: ItemIdSchema.optional().default(() => uuid()),
	data: z.object({
		name: z.string().trim().nonempty().max(AUTOMATION_NAME_MAX_LENGTH),
		description: DescriptionSchema,
		icon: z.string().trim().nullable().optional(),
		enabled: z.boolean().optional(),
		spaceId: ItemIdSchema.nullable().optional(),
		mode: z.nativeEnum(AutomationMode).optional(),
		graph: AutomationGraphSchema.optional(),
	}),
});

export const AutomationsEditActionPayloadSchema = z.object({
	id: ItemIdSchema,
	// The revision the edit is based on, when it is not the one held by the store
	revision: z.number().int().min(1).optional(),
	data: z.object({
		name: z.string().trim().nonempty().max(AUTOMATION_NAME_MAX_LENGTH).optional(),
		description: DescriptionSchema,
		icon: z.string().trim().nullable().optional(),
		enabled: z.boolean().optional(),
		spaceId: ItemIdSchema.nullable().optional(),
		mode: z.nativeEnum(AutomationMode).optional(),
		graph: AutomationGraphSchema.optional(),
	}),
});

export const AutomationsRemoveActionPayloadSchema = z.object({
	id: ItemIdSchema,
});

export const AutomationsValidateActionPayloadSchema = z.object({
	graph: AutomationGraphSchema,
	// Whether the automation would be enabled: an enabled automation needs a complete graph
	enabled: z.boolean().optional(),
});

// BACKEND API
// ===========

export const AutomationCreateReqSchema: ZodType<ApiCreateAutomation> = z.object({
	id: z.string().uuid().optional(),
	name: z.string().trim().nonempty().max(AUTOMATION_NAME_MAX_LENGTH),
	description: DescriptionSchema,
	icon: z.string().trim().nullable().optional(),
	enabled: z.boolean().optional(),
	space_id: z.string().uuid().nullable().optional(),
	mode: z.nativeEnum(AutomationMode).optional(),
	graph: AutomationGraphSchema.optional(),
});

export const AutomationUpdateReqSchema: ZodType<ApiUpdateAutomation> = z.object({
	// The revision the update is based on; the backend refuses the update with 409 when it has moved
	revision: z.number().int().min(1),
	name: z.string().trim().nonempty().max(AUTOMATION_NAME_MAX_LENGTH).optional(),
	description: DescriptionSchema,
	icon: z.string().trim().nullable().optional(),
	enabled: z.boolean().optional(),
	space_id: z.string().uuid().nullable().optional(),
	mode: z.nativeEnum(AutomationMode).optional(),
	graph: AutomationGraphSchema.optional(),
});

// An automation as the list returns it: everything but the graph
export const AutomationSummaryResSchema = z.object({
	id: z.string().uuid(),
	name: z.string().trim().nonempty(),
	description: z.string().nullable().optional(),
	icon: z.string().nullable().optional(),
	enabled: z.boolean(),
	space_id: z.string().uuid().nullable().optional(),
	mode: z.nativeEnum(AutomationMode),
	revision: z.number().int().min(1),
	status: z.nativeEnum(AutomationStatus),
	last_triggered_at: z.string().nullable().optional(),
	last_run_status: z.nativeEnum(AutomationRunStatus).nullable().optional(),
	created_at: z.string(),
	updated_at: z.string().nullable().optional(),
});

export const AutomationResSchema = AutomationSummaryResSchema.extend({
	graph: AutomationGraphSchema,
});
