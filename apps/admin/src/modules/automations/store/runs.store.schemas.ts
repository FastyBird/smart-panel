import { z } from 'zod';

import {
	AutomationNodeKind,
	AutomationRunRecordStatus,
	AutomationRunStepState,
	AutomationStatus,
	AutomationTriggerOutcome,
} from '../automations.constants';

import { ItemIdSchema } from './types';

const DateSchema = z.union([z.string().datetime({ offset: true }), z.date()]).transform((date) => (date instanceof Date ? date : new Date(date)));

// TRACE
// =====

// The trace is one JSON document: the wire format and the stored format are the same, so it is kept as
// received - snake_case keys included - like the graph it describes. What a step observed is specific to
// the node type and is never passed through the case converters.

export const AutomationRunStepResultSchema = z.object({
	success: z.boolean(),
	reason: z.string().optional(),
	refused: z.boolean().optional(),
});

// One node a run reached. Only what applies to the node is present.
export const AutomationRunStepSchema = z.object({
	seq: z.number().int(),
	at: z.string(),
	elapsed_ms: z.number().nonnegative(),
	node_id: z.string().nonempty(),
	type: z.string(),
	kind: z.nativeEnum(AutomationNodeKind),
	via: z.string().optional(),
	state: z.nativeEnum(AutomationRunStepState),
	output: z.string().optional(),
	observed: z.unknown().optional(),
	reason: z.string().optional(),
	result: AutomationRunStepResultSchema.optional(),
	refused: z.boolean().optional(),
	timed_out: z.boolean().optional(),
	after_cancel: z.boolean().optional(),
	delay_ms: z.number().int().nonnegative().optional(),
});

export const AutomationRunTriggerSchema = z.object({
	node_id: z.string(),
	manual: z.boolean(),
	data: z.record(z.string(), z.unknown()).default({}),
});

export const AutomationRunTraceSchema = z.object({
	trigger: AutomationRunTriggerSchema,
	steps: z.array(AutomationRunStepSchema),
	truncated: z.boolean().default(false),
});

// STORE STATE
// ===========

// A run as the history lists it. The trace comes only with a run read on its own; null until then.
export const AutomationRunSchema = z.object({
	id: ItemIdSchema,
	automationId: ItemIdSchema,
	revision: z.number().int(),
	status: z.nativeEnum(AutomationRunRecordStatus),
	triggerNodeId: z.string(),
	manual: z.boolean().default(false),
	startedAt: DateSchema,
	finishedAt: DateSchema.nullable().default(null),
	durationMs: z.number().nullable().default(null),
	endReason: z.string().nullable().default(null),
	trace: AutomationRunTraceSchema.nullable().default(null),
});

// What a manual run request led to
export const AutomationTriggerResultSchema = z.object({
	automationId: ItemIdSchema,
	started: z.boolean(),
	outcome: z.nativeEnum(AutomationTriggerOutcome),
	runId: z.string().nullable().default(null),
	reason: z.string().nullable().default(null),
});

// Why an automation is invalid, addressed to the node or edge it is about
export const AutomationRuntimeProblemSchema = z.object({
	code: z.string(),
	message: z.string(),
	node_id: z.string().optional(),
	edge_id: z.string().optional(),
	node_ids: z.array(z.string()).optional(),
	field: z.string().optional(),
});

// What the engine holds for an automation right now; only what explains its status is kept
export const AutomationRuntimeSchema = z.object({
	automationId: ItemIdSchema,
	loaded: z.boolean(),
	status: z.nativeEnum(AutomationStatus),
	problems: z.array(AutomationRuntimeProblemSchema).default([]),
	suspendedReason: z.string().nullable().default(null),
});

export const AutomationRunsStateSemaphoreSchema = z.object({
	fetching: z.array(ItemIdSchema),
	getting: z.array(ItemIdSchema),
	triggering: z.array(ItemIdSchema),
});

// STORE ACTIONS
// =============

export const AutomationRunsFetchActionPayloadSchema = z.object({
	automationId: ItemIdSchema,
	fresh: z.boolean().optional(),
});

export const AutomationRunsGetActionPayloadSchema = z.object({
	id: ItemIdSchema,
	fresh: z.boolean().optional(),
});

export const AutomationRunsTriggerActionPayloadSchema = z.object({
	automationId: ItemIdSchema,
	nodeId: z.string().nonempty().optional(),
});

export const AutomationRunsOnEventActionPayloadSchema = z.object({
	data: z.record(z.string(), z.unknown()),
});

export const AutomationRunsOpenActionPayloadSchema = z.object({
	id: ItemIdSchema,
});

export const AutomationRunsUnsetActionPayloadSchema = z.object({
	automationId: ItemIdSchema,
});
