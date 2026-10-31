import { Expose, Type } from 'class-transformer';

import { ApiProperty, ApiSchema } from '@nestjs/swagger';

import { BaseSuccessResponseModel } from '../../../modules/api/models/api-response.model';
import { SpaceModeScheduleEntity } from '../entities/space-mode-schedule.entity';

import { SpaceModeScheduleStateModel } from './space-mode-schedule.model';

@ApiSchema({ name: 'SpacesHomeControlPluginResSchedule' })
export class SpaceModeScheduleResponseModel extends BaseSuccessResponseModel<SpaceModeScheduleEntity> {
	@ApiProperty({ description: 'Persisted weekly schedule configuration', type: () => SpaceModeScheduleEntity })
	@Expose()
	@Type(() => SpaceModeScheduleEntity)
	declare data: SpaceModeScheduleEntity;
}

@ApiSchema({ name: 'SpacesHomeControlPluginResScheduleState' })
export class SpaceModeScheduleStateResponseModel extends BaseSuccessResponseModel<SpaceModeScheduleStateModel> {
	@ApiProperty({
		description: 'Read-only plan, availability and manual precedence',
		type: () => SpaceModeScheduleStateModel,
	})
	@Expose()
	@Type(() => SpaceModeScheduleStateModel)
	declare data: SpaceModeScheduleStateModel;
}
