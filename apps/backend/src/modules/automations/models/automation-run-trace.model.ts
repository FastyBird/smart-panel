import { Expose, Type } from 'class-transformer';

import { ApiProperty, ApiPropertyOptional, ApiSchema, getSchemaPath } from '@nestjs/swagger';

import {
	AUTOMATION_RUN_TRACE_MAX_LENGTH,
	AUTOMATION_RUN_TRACE_VALUE_MAX_LENGTH,
	AutomationRunRecordStatus,
} from '../automations.constants';
import { RunRecord, RunStep } from '../engine/run-walker';

export const AUTOMATION_RUN_STEP_KINDS = ['trigger', 'condition', 'action', 'flow'] as const;

export const AUTOMATION_RUN_STEP_STATES = ['done', 'parked', 'cancelled'] as const;

/** What stands in a trace for a value that was too large to keep */
export const AUTOMATION_RUN_TRACE_VALUE_OMITTED = '[value too large to keep]';

@ApiSchema({ name: 'AutomationsModuleDataRunTrigger' })
export class AutomationRunTriggerModel {
	@ApiProperty({
		name: 'node_id',
		description: 'Identifier of the trigger node the run started at',
		type: 'string',
		example: 'n1',
	})
	@Expose()
	node_id: string;

	@ApiProperty({
		description: 'Whether the run was started by hand instead of by the trigger itself',
		type: 'boolean',
		example: false,
	})
	@Expose()
	manual: boolean;

	@ApiProperty({
		description: 'Why the trigger fired, as the trigger reported it (specific to the node type)',
		type: 'object',
		additionalProperties: true,
		example: { property_id: '550e8400-e29b-41d4-a716-446655440000', value: true, previous: false },
	})
	@Expose()
	data: Record<string, unknown>;
}

@ApiSchema({ name: 'AutomationsModuleDataRunStepResult' })
export class AutomationRunStepResultModel {
	@ApiProperty({ description: 'Whether the action did what it was asked to', type: 'boolean', example: true })
	@Expose()
	success: boolean;

	@ApiPropertyOptional({ description: 'Why the action failed, in English', type: 'string' })
	@Expose()
	reason?: string;

	@ApiPropertyOptional({
		description: 'The action did nothing because a policy refused it, as opposed to having tried and failed',
		type: 'boolean',
	})
	@Expose()
	refused?: boolean;
}

/**
 * One node a run reached. Only what applies to the node is present: a condition has `observed`, an action
 * has `result`, a Delay has `delay_ms`, a Wait until has `timeout_ms`, a join may have `absorbed` or
 * `missing_edges`.
 */
@ApiSchema({ name: 'AutomationsModuleDataRunStep' })
export class AutomationRunStepModel {
	@ApiProperty({ description: 'Position of the step in the run, starting at 1', type: 'integer', example: 1 })
	@Expose()
	seq: number;

	@ApiProperty({
		description: 'When the run reached the node',
		type: 'string',
		format: 'date-time',
		example: '2026-11-11T07:30:00.000Z',
	})
	@Expose()
	at: string;

	@ApiProperty({
		name: 'elapsed_ms',
		description: 'Milliseconds since the run started',
		type: 'integer',
		minimum: 0,
		example: 12,
	})
	@Expose()
	elapsed_ms: number;

	@ApiProperty({ name: 'node_id', description: 'Identifier of the node', type: 'string', example: 'n2' })
	@Expose()
	node_id: string;

	@ApiProperty({ description: 'Node type', type: 'string', example: 'device.property.compare' })
	@Expose()
	type: string;

	@ApiProperty({ description: 'Kind of the node', enum: AUTOMATION_RUN_STEP_KINDS, example: 'condition' })
	@Expose()
	kind: (typeof AUTOMATION_RUN_STEP_KINDS)[number];

	@ApiPropertyOptional({
		description: 'Identifier of the edge the run arrived on',
		type: 'string',
		example: 'e1',
	})
	@Expose()
	via?: string;

	@ApiProperty({
		description:
			'`done`; `parked` while a Delay, a Wait until or an All holds the run; `cancelled` when the run ended before the node finished or was executed, for an All also when the run ended before every incoming edge was reached.',
		enum: AUTOMATION_RUN_STEP_STATES,
		example: 'done',
	})
	@Expose()
	state: (typeof AUTOMATION_RUN_STEP_STATES)[number];

	@ApiPropertyOptional({ description: 'The output port the node took', type: 'string', example: 'yes' })
	@Expose()
	output?: string;

	@ApiPropertyOptional({
		description: 'What a condition saw when it was evaluated (specific to the node type)',
		oneOf: [
			{ type: 'string' },
			{ type: 'number' },
			{ type: 'boolean' },
			{ type: 'object', additionalProperties: true },
			{ type: 'array', items: {} },
			{ type: 'null' },
		],
		example: { value: 21.5 },
	})
	@Expose()
	observed?: unknown;

	@ApiPropertyOptional({
		description: 'Why the node took the output it took or was not executed, in English',
		type: 'string',
		example: 'The device is offline.',
	})
	@Expose()
	reason?: string;

	@ApiPropertyOptional({
		description: 'What an action answered',
		type: () => AutomationRunStepResultModel,
	})
	@Expose()
	@Type(() => AutomationRunStepResultModel)
	result?: AutomationRunStepResultModel;

	@ApiPropertyOptional({
		description:
			'The node was not executed: its owner is disabled or a policy refused it, e.g. an action that would unlock',
		type: 'boolean',
	})
	@Expose()
	refused?: boolean;

	@ApiPropertyOptional({
		name: 'timed_out',
		description: 'The node did not answer within its timeout',
		type: 'boolean',
	})
	@Expose()
	timed_out?: boolean;

	@ApiPropertyOptional({
		name: 'after_cancel',
		description: 'The node finished after the run had ended; its output was not followed',
		type: 'boolean',
	})
	@Expose()
	after_cancel?: boolean;

	@ApiPropertyOptional({
		name: 'delay_ms',
		description: 'For a Delay: how long the run was parked for, in milliseconds',
		type: 'integer',
		minimum: 0,
	})
	@Expose()
	delay_ms?: number;

	@ApiPropertyOptional({
		name: 'timeout_ms',
		description: 'For a Wait until: how long the run waits at most, in milliseconds',
		type: 'integer',
		minimum: 0,
	})
	@Expose()
	timeout_ms?: number;

	@ApiPropertyOptional({
		description: 'For an Any or an All: the run arrived after the block had continued and went no further',
		type: 'boolean',
	})
	@Expose()
	absorbed?: boolean;

	@ApiPropertyOptional({
		name: 'missing_edges',
		description:
			'For an All that holds the run or did not continue: identifiers of the incoming edges the run has not arrived on',
		type: 'array',
		items: { type: 'string' },
		example: ['e4'],
	})
	@Expose()
	missing_edges?: string[];
}

/**
 * The stored trace of a run. It is one JSON document: the wire format and the stored format are the same,
 * so keys are snake_case in both.
 */
@ApiSchema({ name: 'AutomationsModuleDataRunTrace' })
export class AutomationRunTraceModel {
	@ApiProperty({ description: 'What started the run', type: () => AutomationRunTriggerModel })
	@Expose()
	@Type(() => AutomationRunTriggerModel)
	trigger: AutomationRunTriggerModel;

	@ApiProperty({
		description: 'The nodes the run reached, in the order it reached them',
		type: 'array',
		items: { $ref: getSchemaPath(AutomationRunStepModel) },
	})
	@Expose()
	@Type(() => AutomationRunStepModel)
	steps: AutomationRunStepModel[];

	@ApiProperty({
		description:
			'Whether the trace was shortened to fit the size limit: values that were too large are replaced by a note and the last steps may be missing.',
		type: 'boolean',
		example: false,
	})
	@Expose()
	truncated: boolean;
}

export const AUTOMATION_RUN_RECORD_STATUS: Record<RunRecord['status'], AutomationRunRecordStatus> = {
	running: AutomationRunRecordStatus.RUNNING,
	completed: AutomationRunRecordStatus.COMPLETED,
	failed: AutomationRunRecordStatus.FAILED,
	cancelled: AutomationRunRecordStatus.CANCELLED,
	interrupted: AutomationRunRecordStatus.INTERRUPTED,
};

/** The size of a value as stored: serialised JSON, in UTF-8 bytes */
const jsonLength = (value: unknown): number => {
	try {
		const serialized = JSON.stringify(value);

		return serialized === undefined ? 0 : Buffer.byteLength(serialized, 'utf8');
	} catch {
		// What can not be serialised can not be stored either
		return Number.POSITIVE_INFINITY;
	}
};

export const createAutomationRunStepModel = (step: RunStep): AutomationRunStepModel => ({
	seq: step.seq,
	at: new Date(step.at).toISOString(),
	elapsed_ms: step.elapsedMs,
	node_id: step.nodeId,
	type: step.type,
	kind: step.kind,
	...(step.via !== undefined ? { via: step.via } : {}),
	state: step.state,
	...(step.output !== undefined ? { output: step.output } : {}),
	...(step.observed !== undefined ? { observed: step.observed } : {}),
	...(step.reason !== undefined ? { reason: step.reason } : {}),
	...(step.result !== undefined
		? {
				result: {
					success: step.result.success,
					...(step.result.reason !== undefined ? { reason: step.result.reason } : {}),
					...(step.result.refused === true ? { refused: true } : {}),
				},
			}
		: {}),
	...(step.refused === true ? { refused: true } : {}),
	...(step.timedOut === true ? { timed_out: true } : {}),
	...(step.afterCancel === true ? { after_cancel: true } : {}),
	...(step.delayMs !== undefined ? { delay_ms: step.delayMs } : {}),
	...(step.timeoutMs !== undefined ? { timeout_ms: step.timeoutMs } : {}),
	...(step.absorbed === true ? { absorbed: true } : {}),
	...(step.missingEdges !== undefined ? { missing_edges: [...step.missingEdges] } : {}),
});

/**
 * Builds the trace to store from what the walker recorded. The trace is bounded (ADR 0003, decision 12):
 * a value a card reported that is too large is replaced by a note, and when the document is still too
 * long the last steps are left out. Either marks the trace as `truncated`.
 */
export const createAutomationRunTraceModel = (
	record: Pick<RunRecord, 'trigger' | 'steps'>,
	limits: { maxLength?: number; valueMaxLength?: number } = {},
): AutomationRunTraceModel => {
	const maxLength = limits.maxLength ?? AUTOMATION_RUN_TRACE_MAX_LENGTH;
	const valueMaxLength = limits.valueMaxLength ?? AUTOMATION_RUN_TRACE_VALUE_MAX_LENGTH;

	let truncated = false;

	// A copy, measured as it will be stored: the run goes on after the trace is taken and may change the
	// objects it hands over, and the row is written later
	const bounded = (value: unknown): unknown => {
		let serialized: string | undefined;

		try {
			serialized = JSON.stringify(value);
		} catch {
			// What can not be serialised can not be stored either
			truncated = true;

			return AUTOMATION_RUN_TRACE_VALUE_OMITTED;
		}

		if (serialized === undefined) return value;

		if (Buffer.byteLength(serialized, 'utf8') <= valueMaxLength) return JSON.parse(serialized) as unknown;

		truncated = true;

		return AUTOMATION_RUN_TRACE_VALUE_OMITTED;
	};

	const data = bounded(record.trigger.data ?? {});

	const trace: AutomationRunTraceModel = {
		trigger: {
			node_id: record.trigger.nodeId,
			manual: record.trigger.manual,
			data: typeof data === 'string' ? { note: data } : (data as Record<string, unknown>),
		},
		steps: [],
		truncated: false,
	};

	let length = jsonLength(trace);

	for (const recorded of record.steps) {
		const step = createAutomationRunStepModel(recorded);

		if (step.observed !== undefined) {
			step.observed = bounded(step.observed);
		}

		// One more for the comma between two steps
		length += jsonLength(step) + 1;

		if (length > maxLength) {
			truncated = true;

			break;
		}

		trace.steps.push(step);
	}

	trace.truncated = truncated;

	return trace;
};
