import { Expose } from 'class-transformer';

import { ApiProperty, ApiSchema } from '@nestjs/swagger';

import { TriggerOutcome } from '../engine/automation-engine';

export const AUTOMATION_TRIGGER_OUTCOMES = ['started', 'ignored', 'dropped', 'suspended'] as const;

export type AutomationTriggerOutcome = (typeof AUTOMATION_TRIGGER_OUTCOMES)[number];

/**
 * What a manual run request led to
 */
@ApiSchema({ name: 'AutomationsModuleDataTriggerResult' })
export class AutomationTriggerResultModel {
	@ApiProperty({
		name: 'automation_id',
		description: 'Identifier of the automation',
		type: 'string',
		format: 'uuid',
		example: '550e8400-e29b-41d4-a716-446655440000',
	})
	@Expose()
	automation_id: string;

	@ApiProperty({ description: 'Whether a run was started', type: 'boolean', example: true })
	@Expose()
	started: boolean;

	@ApiProperty({
		description:
			'What happened: `started`; `ignored` (a run is active and the mode is `single`); `dropped` (the limit of parallel or concurrent runs is reached); `suspended` (the overload guard stopped the automation because of this request).',
		enum: AUTOMATION_TRIGGER_OUTCOMES,
		example: 'started',
	})
	@Expose()
	outcome: AutomationTriggerOutcome;

	@ApiProperty({
		name: 'run_id',
		description: 'Identifier of the run that was started',
		type: 'string',
		format: 'uuid',
		nullable: true,
		example: '7b0f9f51-6d0b-4f1c-9a53-6f0c2d0f4a11',
	})
	@Expose()
	run_id: string | null;

	@ApiProperty({
		description: 'Why no run was started, in English',
		type: 'string',
		nullable: true,
		example: null,
	})
	@Expose()
	reason: string | null;
}

export const createAutomationTriggerResultModel = (
	automationId: string,
	outcome: Exclude<TriggerOutcome, { outcome: 'refused' }>,
): AutomationTriggerResultModel => {
	const model = new AutomationTriggerResultModel();
	model.automation_id = automationId;
	model.started = outcome.outcome === 'started';
	model.outcome = outcome.outcome;
	model.run_id = outcome.outcome === 'started' ? outcome.runId : null;
	model.reason = outcome.outcome === 'started' ? null : outcome.reason;

	return model;
};
