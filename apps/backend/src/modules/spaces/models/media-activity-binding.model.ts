import { Expose, Type } from 'class-transformer';

import { ApiProperty, ApiSchema, getSchemaPath } from '@nestjs/swagger';

import { BaseSuccessResponseModel } from '../../api/models/api-response.model';
import { SpaceMediaActivityBindingEntity } from '../entities/space-media-activity-binding.entity';

/**
 * Response model for a single media activity binding
 */
@ApiSchema({ name: 'SpacesModuleResMediaActivityBinding' })
export class MediaActivityBindingResponseModel extends BaseSuccessResponseModel<SpaceMediaActivityBindingEntity> {
	@ApiProperty({
		description: 'The activity binding data',
		type: () => SpaceMediaActivityBindingEntity,
	})
	@Expose()
	@Type(() => SpaceMediaActivityBindingEntity)
	declare data: SpaceMediaActivityBindingEntity;
}

/**
 * Response model for a list of media activity bindings
 */
@ApiSchema({ name: 'SpacesModuleResMediaActivityBindings' })
export class MediaActivityBindingsResponseModel extends BaseSuccessResponseModel<SpaceMediaActivityBindingEntity[]> {
	@ApiProperty({
		description: 'The activity bindings data',
		type: 'array',
		items: { $ref: getSchemaPath(SpaceMediaActivityBindingEntity) },
	})
	@Expose()
	@Type(() => SpaceMediaActivityBindingEntity)
	declare data: SpaceMediaActivityBindingEntity[];
}
