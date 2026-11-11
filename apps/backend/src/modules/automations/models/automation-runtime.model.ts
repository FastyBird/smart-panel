import { Expose, Type } from 'class-transformer';

import { ApiProperty, ApiPropertyOptional, ApiSchema, getSchemaPath } from '@nestjs/swagger';

import { AutomationStatus } from '../automations.constants';
import { EngineAutomationState, EngineProblem, EngineProblemCode } from '../engine/automation-engine';
import { AutomationEntity } from '../entities/automations.entity';

/**
 * How many times the triggers of an automation fired, by what became of them
 */
@ApiSchema({ name: 'AutomationsModuleDataAutomationTriggerCounters' })
export class AutomationTriggerCountersModel {
	@ApiProperty({ description: 'Triggers that started a run', type: 'integer', minimum: 0, example: 12 })
	@Expose()
	started: number;

	@ApiProperty({
		description: 'Triggers skipped because a run was active and the mode is `single`, or their plugin is disabled',
		type: 'integer',
		minimum: 0,
		example: 3,
	})
	@Expose()
	ignored: number;

	@ApiProperty({
		description: 'Triggers skipped because the limit of parallel or concurrent runs was reached',
		type: 'integer',
		minimum: 0,
		example: 0,
	})
	@Expose()
	dropped: number;
}

/**
 * The last trigger that did not start a run
 */
@ApiSchema({ name: 'AutomationsModuleDataAutomationSkippedTrigger' })
export class AutomationSkippedTriggerModel {
	@ApiProperty({ description: 'Whether the trigger was ignored or dropped', enum: ['ignored', 'dropped'] })
	@Expose()
	outcome: 'ignored' | 'dropped';

	@ApiProperty({ description: 'Why, in English', type: 'string', example: 'A run is already active.' })
	@Expose()
	reason: string;

	@ApiProperty({ name: 'node_id', description: 'Identifier of the trigger node', type: 'string', example: 'n1' })
	@Expose()
	node_id: string;

	@ApiProperty({ description: 'When it happened', type: 'string', format: 'date-time' })
	@Expose()
	at: string;
}

/**
 * One reason an automation is invalid, addressed to the node or edge it is about
 */
@ApiSchema({ name: 'AutomationsModuleDataAutomationProblem' })
export class AutomationProblemModel {
	@ApiProperty({
		description:
			'What is wrong. Besides the codes of graph validation: `not_runnable` (the node type has nothing the engine can execute), `missing_reference` (a device, channel, property, scene, space or automation the node refers to no longer exists) and `trigger_failed` (the trigger could not be started).',
		enum: Object.values(EngineProblemCode),
		example: EngineProblemCode.MISSING_REFERENCE,
	})
	@Expose()
	code: EngineProblemCode;

	@ApiProperty({
		description: 'Explanation in English',
		type: 'string',
		example: 'The device this block refers to no longer exists.',
	})
	@Expose()
	message: string;

	@ApiPropertyOptional({
		name: 'node_id',
		description: 'Identifier of the node the problem is about',
		type: 'string',
		example: 'n2',
	})
	@Expose()
	node_id?: string;

	@ApiPropertyOptional({
		name: 'edge_id',
		description: 'Identifier of the edge the problem is about',
		type: 'string',
		example: 'e1',
	})
	@Expose()
	edge_id?: string;

	@ApiPropertyOptional({
		name: 'node_ids',
		description: 'Identifiers of all nodes taking part, for a problem about several nodes',
		type: 'array',
		items: { type: 'string' },
		example: ['n2', 'n3'],
	})
	@Expose()
	node_ids?: string[];

	@ApiPropertyOptional({
		description: 'Configuration field the problem is about, dot-separated',
		type: 'string',
		example: 'property_id',
	})
	@Expose()
	field?: string;
}

/**
 * What the engine holds for an automation right now. Nothing of it is stored: the counters start at zero
 * when the backend starts.
 */
@ApiSchema({ name: 'AutomationsModuleDataAutomationRuntime' })
export class AutomationRuntimeModel {
	@ApiProperty({
		name: 'automation_id',
		description: 'Identifier of the automation',
		type: 'string',
		format: 'uuid',
		example: '550e8400-e29b-41d4-a716-446655440000',
	})
	@Expose()
	automation_id: string;

	@ApiProperty({
		description: 'Whether the engine is running and knows the automation. When false, the rest is empty.',
		type: 'boolean',
		example: true,
	})
	@Expose()
	loaded: boolean;

	@ApiProperty({ description: 'Automation status', enum: AutomationStatus, example: AutomationStatus.OK })
	@Expose()
	status: AutomationStatus;

	@ApiProperty({
		description: 'Whether the triggers of the automation are being watched',
		type: 'boolean',
		example: true,
	})
	@Expose()
	armed: boolean;

	@ApiProperty({
		name: 'armed_triggers',
		description:
			'Number of triggers being watched. Lower than the number of triggers in the graph when the plugin a trigger belongs to is disabled.',
		type: 'integer',
		minimum: 0,
		example: 1,
	})
	@Expose()
	armed_triggers: number;

	@ApiProperty({
		name: 'active_runs',
		description: 'Number of runs active right now',
		type: 'integer',
		minimum: 0,
		example: 0,
	})
	@Expose()
	active_runs: number;

	@ApiProperty({
		description: 'Trigger counters since the backend started',
		type: () => AutomationTriggerCountersModel,
	})
	@Expose()
	@Type(() => AutomationTriggerCountersModel)
	triggers: AutomationTriggerCountersModel;

	@ApiProperty({
		name: 'last_skipped',
		description: 'The last trigger that did not start a run',
		oneOf: [{ $ref: getSchemaPath(AutomationSkippedTriggerModel) }, { type: 'null' }],
	})
	@Expose()
	@Type(() => AutomationSkippedTriggerModel)
	last_skipped: AutomationSkippedTriggerModel | null;

	@ApiProperty({
		description: 'Why the automation is invalid; empty otherwise',
		type: 'array',
		items: { $ref: getSchemaPath(AutomationProblemModel) },
	})
	@Expose()
	@Type(() => AutomationProblemModel)
	problems: AutomationProblemModel[];

	@ApiProperty({
		name: 'suspended_reason',
		description: 'Why the automation was suspended, in English',
		type: 'string',
		nullable: true,
		example: null,
	})
	@Expose()
	suspended_reason: string | null;
}

const createProblemModel = (problem: EngineProblem): AutomationProblemModel =>
	Object.assign(new AutomationProblemModel(), problem);

export const createAutomationRuntimeModel = (
	automation: Pick<AutomationEntity, 'id' | 'status'>,
	state: EngineAutomationState | undefined,
): AutomationRuntimeModel => {
	const triggers = new AutomationTriggerCountersModel();
	triggers.started = state?.triggers.started ?? 0;
	triggers.ignored = state?.triggers.ignored ?? 0;
	triggers.dropped = state?.triggers.dropped ?? 0;

	let lastSkipped: AutomationSkippedTriggerModel | null = null;

	if (state?.lastSkipped) {
		lastSkipped = new AutomationSkippedTriggerModel();
		lastSkipped.outcome = state.lastSkipped.outcome;
		lastSkipped.reason = state.lastSkipped.reason;
		lastSkipped.node_id = state.lastSkipped.nodeId;
		lastSkipped.at = new Date(state.lastSkipped.at).toISOString();
	}

	const model = new AutomationRuntimeModel();
	model.automation_id = automation.id;
	model.loaded = state !== undefined;
	model.status = state ? (state.status as AutomationStatus) : automation.status;
	model.armed = state?.armed ?? false;
	model.armed_triggers = state?.armedTriggers ?? 0;
	model.active_runs = state?.activeRuns ?? 0;
	model.triggers = triggers;
	model.last_skipped = lastSkipped;
	model.problems = (state?.problems ?? []).map(createProblemModel);
	model.suspended_reason = state?.suspendedReason ?? null;

	return model;
};
