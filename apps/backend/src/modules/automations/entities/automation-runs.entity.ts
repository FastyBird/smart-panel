import { Expose, Transform } from 'class-transformer';
import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';

import { ApiProperty, ApiSchema } from '@nestjs/swagger';

import { BaseEntity } from '../../../common/entities/base.entity';
import { AutomationRunRecordStatus } from '../automations.constants';
import { AutomationRunTraceModel } from '../models/automation-run-trace.model';

import { AutomationEntity } from './automations.entity';

const toIsoString = ({ value }: { value: unknown }): unknown => (value instanceof Date ? value.toISOString() : value);

/**
 * One run of an automation and its trace (design § Runs, ADR 0003 decision 12). The identifier is the one
 * the engine gave the run, so the answer of a manual trigger leads straight to its record.
 *
 * A row is written once, when the run ends. A run that parks on a Delay is written at that moment as
 * `running`, with the trace up to there, and rewritten when it ends.
 */
@ApiSchema({ name: 'AutomationsModuleDataRun' })
@Entity('automations_module_runs')
@Index(['automationId', 'startedAt'])
export class AutomationRunEntity extends BaseEntity {
	@ManyToOne(() => AutomationEntity, { onDelete: 'CASCADE' })
	@JoinColumn({ name: 'automationId' })
	automation?: AutomationEntity;

	@ApiProperty({
		name: 'automation_id',
		description: 'Identifier of the automation the run belongs to',
		type: 'string',
		format: 'uuid',
		example: '550e8400-e29b-41d4-a716-446655440000',
		readOnly: true,
	})
	@Expose({ name: 'automation_id' })
	@Column({ type: 'varchar', length: 36 })
	automationId: string;

	@ApiProperty({
		description: 'Revision of the automation the run walked',
		type: 'integer',
		minimum: 1,
		example: 3,
		readOnly: true,
	})
	@Expose()
	@Column({ type: 'integer' })
	revision: number;

	@ApiProperty({
		description:
			'Status of the run: `running` (it is parked on a Delay), `completed`, `failed` (an error went unhandled), `cancelled` (the automation was triggered again, saved or disabled) or `interrupted` (the engine stopped or the backend restarted before the run ended).',
		enum: AutomationRunRecordStatus,
		example: AutomationRunRecordStatus.COMPLETED,
		readOnly: true,
	})
	@Expose()
	@Column({ type: 'varchar' })
	status: AutomationRunRecordStatus;

	@ApiProperty({
		name: 'trigger_node_id',
		description: 'Identifier of the trigger node the run started at',
		type: 'string',
		example: 'n1',
		readOnly: true,
	})
	@Expose({ name: 'trigger_node_id' })
	@Column({ type: 'varchar' })
	triggerNodeId: string;

	@ApiProperty({
		description: 'Whether the run was started by hand instead of by the trigger itself',
		type: 'boolean',
		example: false,
		readOnly: true,
	})
	@Expose()
	@Column({ type: 'boolean', default: false })
	manual: boolean = false;

	@ApiProperty({
		name: 'started_at',
		description: 'When the run started',
		type: 'string',
		format: 'date-time',
		example: '2026-11-11T07:30:00.000Z',
		readOnly: true,
	})
	@Expose({ name: 'started_at' })
	@Transform(toIsoString, { toPlainOnly: true })
	@Column({ type: 'datetime' })
	startedAt: Date | string;

	@ApiProperty({
		name: 'finished_at',
		description:
			'When the run ended. Empty while the run is `running`, and for a run that was found interrupted when the backend started: when it stopped is not known.',
		type: 'string',
		format: 'date-time',
		nullable: true,
		example: '2026-11-11T07:30:01.250Z',
		readOnly: true,
	})
	@Expose({ name: 'finished_at' })
	@Transform(toIsoString, { toPlainOnly: true })
	@Column({ type: 'datetime', nullable: true })
	finishedAt: Date | string | null;

	@ApiProperty({
		name: 'duration_ms',
		description: 'How long the run took, in milliseconds; empty when `finished_at` is',
		type: 'integer',
		minimum: 0,
		nullable: true,
		example: 1250,
		readOnly: true,
	})
	@Expose({ name: 'duration_ms' })
	@Column({ type: 'integer', nullable: true })
	durationMs: number | null;

	@ApiProperty({
		name: 'end_reason',
		description:
			'Why the run ended early, e.g. `restarted`, `engine_stopped`, `backend_restarted` or a sentence in English; empty for a run that ran to its end',
		type: 'string',
		nullable: true,
		example: null,
		readOnly: true,
	})
	@Expose({ name: 'end_reason' })
	@Column({ type: 'varchar', nullable: true })
	endReason: string | null;

	@ApiProperty({
		description: 'What the run did: what started it and every node it reached',
		type: () => AutomationRunTraceModel,
		readOnly: true,
	})
	@Expose()
	@Column({ type: 'simple-json' })
	trace: AutomationRunTraceModel;
}
