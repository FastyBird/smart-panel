import { Expose, Type } from 'class-transformer';
import { ChildEntity, Column, Index } from 'typeorm';

import { ApiProperty, ApiSchema } from '@nestjs/swagger';

import { SpaceRoleEntity } from '../../../modules/spaces/entities/space-role.entity';
import { SpaceRoleType } from '../../../modules/spaces/spaces.constants';
import { ActivityActivationStatus, ActivityMode } from '../activity/space-activity.constants';
import { ActivityDomainResultModel } from '../models/activity-result.model';

@ApiSchema({ name: 'SpacesHomeControlPluginDataSpaceActivityStateEntity' })
@Index('IDX_activity_state_space', ['spaceId'], { unique: true, where: "type = 'activity_state'" })
@ChildEntity(SpaceRoleType.ACTIVITY_STATE)
export class SpaceActivityStateEntity extends SpaceRoleEntity {
	@ApiProperty({ description: 'Activity role discriminator', enum: SpaceRoleType })
	@Expose()
	get type(): SpaceRoleType {
		return SpaceRoleType.ACTIVITY_STATE;
	}

	@ApiProperty({
		name: 'selected_activity_mode',
		description: 'Selected mode; null after deactivation',
		anyOf: [{ type: 'string', enum: Object.values(ActivityMode) }, { type: 'null' }],
	})
	@Expose({ name: 'selected_activity_mode' })
	@Column({ type: 'varchar', nullable: true })
	selectedActivityMode: ActivityMode | null;
	@ApiProperty({
		name: 'activation_id',
		description: 'Server-generated activation identity',
		type: 'string',
		format: 'uuid',
	})
	@Expose({ name: 'activation_id' })
	@Column({ type: 'varchar', nullable: true })
	activationId: string;
	@ApiProperty({ name: 'selected_activity_revision', description: 'Revision selected at activation', type: 'integer' })
	@Expose({ name: 'selected_activity_revision' })
	@Column({ type: 'integer', nullable: true })
	selectedActivityRevision: number;
	@ApiProperty({
		name: 'activity_status',
		description: 'Persisted request state; interrupted does not imply device rollback',
		enum: ActivityActivationStatus,
	})
	@Expose({ name: 'activity_status' })
	@Column({ type: 'varchar', nullable: true })
	activityStatus: ActivityActivationStatus;
	@ApiProperty({ name: 'activity_actor', description: 'Authenticated initiating principal', type: 'string' })
	@Expose({ name: 'activity_actor' })
	@Column({ type: 'varchar', nullable: true })
	activityActor: string;
	@ApiProperty({
		name: 'activity_results',
		description: 'Per-domain execution results, not actuator acknowledgement',
		type: () => ActivityDomainResultModel,
		isArray: true,
	})
	@Expose({ name: 'activity_results' })
	@Type(() => ActivityDomainResultModel)
	@Column({ type: 'simple-json', nullable: true })
	activityResults: ActivityDomainResultModel[];
}
