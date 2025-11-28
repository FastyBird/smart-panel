import { Expose } from 'class-transformer';

import { ApiProperty, ApiSchema } from '@nestjs/swagger';

import { BaseSuccessResponseModel } from '../../api/models/api-response.model';

import { AllStatsModel, StatModel, StatsKeysModel } from './stats.model';

/**
 * Response wrapper for AllStatsModel
 */
@ApiSchema({ name: 'StatsModuleResAllStats' })
export class StatsResponseModel extends BaseSuccessResponseModel<AllStatsModel> {
	@ApiProperty({
		description: 'The actual data payload returned by the API',
		type: () => AllStatsModel,
	})
	@Expose()
	declare data: AllStatsModel;
}

/**
 * Response wrapper for StatModel
 */
@ApiSchema({ name: 'StatsModuleResStat' })
export class StatResponseModel extends BaseSuccessResponseModel<StatModel> {
	@ApiProperty({
		description: 'The actual data payload returned by the API',
		type: () => StatModel,
	})
	@Expose()
	declare data: StatModel;
}

/**
 * Response wrapper for StatsKeysModel
 */
@ApiSchema({ name: 'StatsModuleResStatsKeys' })
export class StatsKeysResponseModel extends BaseSuccessResponseModel<StatsKeysModel> {
	@ApiProperty({
		description: 'The actual data payload returned by the API',
		type: () => StatsKeysModel,
	})
	@Expose()
	declare data: StatsKeysModel;
}
