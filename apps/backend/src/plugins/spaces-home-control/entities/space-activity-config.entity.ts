import { Expose, Type } from 'class-transformer';
import { ChildEntity, Column, Index } from 'typeorm';

import { ApiProperty, ApiSchema } from '@nestjs/swagger';

import { SpaceRoleEntity } from '../../../modules/spaces/entities/space-role.entity';
import { SpaceRoleType } from '../../../modules/spaces/spaces.constants';
import { ActivityMode } from '../activity/space-activity.constants';
import { ActivityConfigurationModel } from '../models/activity-configuration.model';

@ApiSchema({ name: 'SpacesHomeControlPluginDataSpaceActivityConfigEntity' })
@Index('IDX_activity_config_space', ['spaceId', 'activityMode'], { unique: true, where: "type = 'activity_config'" })
@ChildEntity(SpaceRoleType.ACTIVITY_CONFIG)
export class SpaceActivityConfigEntity extends SpaceRoleEntity {
	@ApiProperty({ description: 'Activity role discriminator', enum: SpaceRoleType })
	@Expose()
	get type(): SpaceRoleType {
		return SpaceRoleType.ACTIVITY_CONFIG;
	}

	@ApiProperty({ name: 'activity_mode', description: 'Built-in mode', enum: ActivityMode })
	@Expose({ name: 'activity_mode' })
	@Column({ type: 'varchar', nullable: true })
	activityMode: ActivityMode;
	@ApiProperty({ name: 'activity_enabled', description: 'Enabled in this space', type: 'boolean' })
	@Expose({ name: 'activity_enabled' })
	@Column({ type: 'boolean', nullable: true })
	activityEnabled: boolean;
	@ApiProperty({ name: 'activity_order', description: 'Display order', type: 'integer' })
	@Expose({ name: 'activity_order' })
	@Column({ type: 'integer', nullable: true })
	activityOrder: number;
	@ApiProperty({ name: 'activity_revision', description: 'Configuration revision', type: 'integer' })
	@Expose({ name: 'activity_revision' })
	@Column({ type: 'integer', nullable: true })
	activityRevision: number;
	@ApiProperty({
		name: 'activity_configuration',
		description: 'Persisted per-space domain configuration',
		type: () => ActivityConfigurationModel,
	})
	@Expose({ name: 'activity_configuration' })
	@Type(() => ActivityConfigurationModel)
	@Column({ type: 'simple-json', nullable: true })
	activityConfiguration: ActivityConfigurationModel;
}
