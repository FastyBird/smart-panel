import { Expose, Transform } from 'class-transformer';
import { IsBoolean, IsEnum, IsInt, IsOptional, IsString, IsUUID, Min } from 'class-validator';
import { Column, Entity, Index } from 'typeorm';

import { ApiProperty, ApiPropertyOptional, ApiSchema } from '@nestjs/swagger';

import { BaseEntity } from '../../../common/entities/base.entity';
import { AutomationMode, AutomationRunStatus, AutomationStatus } from '../automations.constants';
import { AutomationGraphModel } from '../models/automation-graph.model';

@ApiSchema({ name: 'AutomationsModuleDataAutomation' })
@Entity('automations_module_automations')
export class AutomationEntity extends BaseEntity {
	@ApiProperty({ description: 'Automation name', type: 'string', example: 'Hallway motion light' })
	@Expose()
	@IsString()
	@Column()
	name: string;

	@ApiPropertyOptional({
		description: 'Automation description',
		type: 'string',
		nullable: true,
		example: 'Turns the hallway light on when somebody walks in',
	})
	@Expose()
	@IsOptional()
	@IsString()
	@Column({ type: 'varchar', nullable: true })
	description: string | null;

	@ApiPropertyOptional({
		description: 'Icon identifier for the automation',
		type: 'string',
		nullable: true,
		example: 'mdi:motion-sensor',
	})
	@Expose()
	@IsOptional()
	@IsString()
	@Column({ type: 'varchar', nullable: true })
	icon: string | null;

	@ApiProperty({
		description: 'Whether the automation is enabled. A disabled automation never runs.',
		type: 'boolean',
		example: false,
	})
	@Expose()
	@IsBoolean()
	@Index()
	@Column({ nullable: false, default: false })
	enabled: boolean = false;

	@ApiPropertyOptional({
		name: 'space_id',
		description: 'Optional owning space, used for filtering. It does not restrict what the automation may control.',
		type: 'string',
		format: 'uuid',
		nullable: true,
		example: '550e8400-e29b-41d4-a716-446655440000',
	})
	@Expose({ name: 'space_id' })
	@IsOptional()
	@IsUUID('4')
	@Transform(
		({ obj }: { obj: { space_id?: string | null; spaceId?: string | null } }) => obj.space_id ?? obj.spaceId ?? null,
		{ toClassOnly: true },
	)
	@Index()
	@Column({ type: 'varchar', length: 36, nullable: true })
	spaceId: string | null;

	@ApiProperty({
		description:
			'What happens when the automation is triggered while it is already running: `single` ignores the new trigger, `restart` cancels the running run, `parallel` starts another run.',
		enum: AutomationMode,
		example: AutomationMode.RESTART,
	})
	@Expose()
	@IsEnum(AutomationMode)
	@Column({ type: 'varchar', default: AutomationMode.RESTART })
	mode: AutomationMode = AutomationMode.RESTART;

	@ApiProperty({
		description: 'The automation graph: nodes placed on the canvas and the edges wiring them',
		type: () => AutomationGraphModel,
	})
	@Expose()
	@Column({ type: 'simple-json', default: '{"version":1,"nodes":[],"edges":[]}' })
	graph: AutomationGraphModel;

	@ApiProperty({
		description:
			'Revision of the automation. It starts at 1 and is incremented by every successful update; an update must carry the revision it was based on.',
		type: 'integer',
		minimum: 1,
		example: 1,
	})
	@Expose()
	@IsInt()
	@Min(1)
	@Column({ type: 'integer', default: 1 })
	revision: number = 1;

	@ApiProperty({
		description:
			'Automation status: `ok`, `invalid` (it references something that no longer exists or a node fails validation) or `suspended` (stopped by the overload guard).',
		enum: AutomationStatus,
		example: AutomationStatus.OK,
		readOnly: true,
	})
	@Expose()
	@IsEnum(AutomationStatus)
	@Column({ type: 'varchar', default: AutomationStatus.OK })
	status: AutomationStatus = AutomationStatus.OK;

	@ApiPropertyOptional({
		name: 'last_triggered_at',
		description: 'Timestamp of the last time the automation was triggered',
		type: 'string',
		format: 'date-time',
		nullable: true,
		example: '2025-01-25T12:00:00Z',
		readOnly: true,
	})
	@Expose({ name: 'last_triggered_at' })
	@IsOptional()
	@Transform(
		({ obj }: { obj: { last_triggered_at?: string | Date | null; lastTriggeredAt?: string | Date | null } }) => {
			const value = obj.last_triggered_at ?? obj.lastTriggeredAt ?? null;

			return typeof value === 'string' ? new Date(value) : value;
		},
		{ toClassOnly: true },
	)
	@Transform(({ value }: { value: unknown }) => (value instanceof Date ? value.toISOString() : value), {
		toPlainOnly: true,
	})
	@Column({ type: 'datetime', nullable: true })
	lastTriggeredAt: Date | string | null;

	@ApiPropertyOptional({
		name: 'last_run_status',
		description: 'Outcome of the last run of the automation',
		enum: AutomationRunStatus,
		nullable: true,
		example: AutomationRunStatus.COMPLETED,
		readOnly: true,
	})
	@Expose({ name: 'last_run_status' })
	@IsOptional()
	@IsEnum(AutomationRunStatus)
	@Transform(
		({ obj }: { obj: { last_run_status?: AutomationRunStatus | null; lastRunStatus?: AutomationRunStatus | null } }) =>
			obj.last_run_status ?? obj.lastRunStatus ?? null,
		{ toClassOnly: true },
	)
	@Column({ type: 'varchar', nullable: true })
	lastRunStatus: AutomationRunStatus | null;
}
