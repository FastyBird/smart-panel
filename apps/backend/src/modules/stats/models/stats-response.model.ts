import { Expose, Type } from 'class-transformer';

import { ApiProperty, ApiSchema } from '@nestjs/swagger';

import { BaseSuccessResponseModel } from '../../api/models/api-response.model';

import { ModuleStatsModel, StatsKeysModel, StatsModel } from './stats.model';

/**
 * Stats Response
 * Response containing detailed stats, including CPU load, memory usage, storage, temperature, OS, etc.
 */
@ApiSchema({
	name: 'StatsModuleResStats',
	description: 'Response containing detailed stats, including CPU load, memory usage, storage, temperature, OS, etc.',
})
export class StatsResponseModel extends BaseSuccessResponseModel<StatsModel> {
	@ApiProperty({
		description:
			'The actual data payload returned by the API. The structure depends on the specific endpoint response.',
		type: () => StatsModel,
	})
	@Expose()
	@Type(() => StatsModel)
	declare data: StatsModel;
}

/**
 * Response wrapper for a single stat (used for :key endpoint)
 * Note: This model is kept for backward compatibility but may need to be updated to match OpenAPI spec
 */
@ApiSchema({ name: 'StatsModuleResStat' })
export class StatResponseModel extends BaseSuccessResponseModel<ModuleStatsModel> {
	@ApiProperty({
		description: 'The actual data payload returned by the API',
		type: () => ModuleStatsModel,
	})
	@Expose()
	declare data: ModuleStatsModel;
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
