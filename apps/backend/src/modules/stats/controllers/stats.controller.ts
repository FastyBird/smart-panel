import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';

import { ApiInternalServerErrorResponse, ApiSuccessResponse } from '../../api/decorators/api-documentation.decorator';
import { StatResponseModel, StatsKeysResponseModel, StatsResponseModel } from '../models/stats-response.model';
import { StatsAggregatorService } from '../services/stats-aggregator.service';
import { STATS_MODULE_NAME } from '../stats.constants';

@ApiTags(STATS_MODULE_NAME)
@Controller('stats')
export class StatsController {
	constructor(private readonly agg: StatsAggregatorService) {}

	@ApiOperation({
		tags: [STATS_MODULE_NAME],
		summary: 'Get all statistics',
		description:
			'Retrieve all available statistics. Supports optional query parameters for filtering or customization (parameters vary by statistic provider).',
		operationId: 'get-stats-module-stats',
	})
	@ApiSuccessResponse(StatsResponseModel, 'Statistics retrieved successfully')
	@ApiInternalServerErrorResponse()
	@Get()
	async all(@Query() q: Record<string, unknown>): Promise<StatsResponseModel> {
		const stats = await this.agg.getAll(q);

		const response = new StatsResponseModel();
		response.data = stats;

		return response;
	}

	@ApiOperation({
		tags: [STATS_MODULE_NAME],
		summary: 'Get specific statistic',
		description:
			'Retrieve a specific statistic by key. Supports optional query parameters for filtering or customization (parameters vary by statistic).',
		operationId: 'get-stats-module-stat',
	})
	@ApiParam({ name: 'key', description: 'Statistic key', type: 'string', example: 'cpu_usage' })
	@ApiSuccessResponse(StatResponseModel, 'Statistic retrieved successfully')
	@ApiInternalServerErrorResponse()
	@Get(':key')
	async one(@Param('key') key: string, @Query() q: Record<string, unknown>): Promise<StatResponseModel> {
		const stat = await this.agg.get<Record<string, unknown>>(key, q);

		const response = new StatResponseModel();
		response.data = stat;

		return response;
	}

	@ApiOperation({
		tags: [STATS_MODULE_NAME],
		summary: 'List available statistics keys',
		description: 'Retrieve a list of all available statistic keys',
		operationId: 'get-stats-module-keys',
	})
	@ApiSuccessResponse(StatsKeysResponseModel, 'Statistics keys retrieved successfully')
	@ApiInternalServerErrorResponse()
	@Get('_keys')
	keys(): StatsKeysResponseModel {
		const keys = this.agg.listKeys();

		const response = new StatsKeysResponseModel();
		response.data = { keys };

		return response;
	}
}
