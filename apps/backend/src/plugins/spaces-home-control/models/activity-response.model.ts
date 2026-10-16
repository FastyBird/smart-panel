import { Expose, Type } from 'class-transformer';

import { ApiProperty, ApiSchema } from '@nestjs/swagger';

import { BaseSuccessResponseModel } from '../../../modules/api/models/api-response.model';
import { SpaceActivityConfigEntity } from '../entities/space-activity-config.entity';
import { SpaceActivityStateEntity } from '../entities/space-activity-state.entity';

import { ActivityDomainResultModel } from './activity-result.model';

@ApiSchema({ name: 'SpacesHomeControlPluginResActivityModes' })
export class ActivityModesResponseModel extends BaseSuccessResponseModel<SpaceActivityConfigEntity[]> {
	@ApiProperty({
		description: 'Enabled modes in configured display order',
		type: () => SpaceActivityConfigEntity,
		isArray: true,
	})
	@Expose()
	@Type(() => SpaceActivityConfigEntity)
	declare data: SpaceActivityConfigEntity[];
}
@ApiSchema({ name: 'SpacesHomeControlPluginResActivityConfiguration' })
export class ActivityConfigurationResponseModel extends BaseSuccessResponseModel<SpaceActivityConfigEntity> {
	@ApiProperty({ description: 'Persisted configuration', type: () => SpaceActivityConfigEntity })
	@Expose()
	@Type(() => SpaceActivityConfigEntity)
	declare data: SpaceActivityConfigEntity;
}
@ApiSchema({ name: 'SpacesHomeControlPluginResActivityState' })
export class ActivityStateResponseModel extends BaseSuccessResponseModel<SpaceActivityStateEntity | null> {
	@ApiProperty({
		description: 'Persisted selection and request result; null before first activation',
		type: () => SpaceActivityStateEntity,
		nullable: true,
	})
	@Expose()
	@Type(() => SpaceActivityStateEntity)
	declare data: SpaceActivityStateEntity | null;
}
@ApiSchema({ name: 'SpacesHomeControlPluginResActivityPreview' })
export class ActivityPreviewResponseModel extends BaseSuccessResponseModel<ActivityDomainResultModel[]> {
	@ApiProperty({
		description: 'Readiness only; no actuation, persistence, binding creation or events',
		type: () => ActivityDomainResultModel,
		isArray: true,
	})
	@Expose()
	@Type(() => ActivityDomainResultModel)
	declare data: ActivityDomainResultModel[];
}
