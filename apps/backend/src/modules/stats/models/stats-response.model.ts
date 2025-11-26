import { Expose, Type } from 'class-transformer';

import { ApiProperty, ApiSchema } from '@nestjs/swagger';

import { BaseSuccessResponseModel } from '../../../common/dto/response.dto';

import { AllStatsModel, StatModel, StatsKeysModel } from './stats.model';

/**
 * Response wrapper for AllStatsModel
 */
@ApiSchema({ name: 'StatsModuleResStats' })
export class StatsResponseModel extends BaseSuccessResponseModel<AllStatsModel> {
	@ApiProperty({
		description: 'The actual data payload returned by the API',
		type: () => AllStatsModel,
	})
	@Expose()
	@Type(() => AllStatsModel)
	data: AllStatsModel;
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
	@Type(() => StatModel)
	data: StatModel;
}

/**
 * Response wrapper for StatsKeysModel
 */
@ApiSchema({ name: 'StatsModuleResKeys' })
export class StatsKeysResponseModel extends BaseSuccessResponseModel<StatsKeysModel> {
	@ApiProperty({
		description: 'The actual data payload returned by the API',
		type: () => StatsKeysModel,
	})
	@Expose()
	@Type(() => StatsKeysModel)
	data: StatsKeysModel;
}
