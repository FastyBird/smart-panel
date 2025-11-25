import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';

import {
	ApiInternalServerErrorResponse,
	ApiSuccessResponse,
} from '../../../common/decorators/api-documentation.decorator';
import { AllStatsModel, StatModel, StatsKeysModel } from '../models/stats.model';
import { StatsAggregatorService } from '../services/stats-aggregator.service';

@ApiTags('stats-module')
@Controller('stats')
export class StatsController {
	constructor(private readonly agg: StatsAggregatorService) {}

	@Get()
	@ApiOperation({
		summary: 'Get all statistics',
		description:
			'Retrieve all available statistics. Supports optional query parameters for filtering or customization (parameters vary by statistic provider).',
	})
	@ApiSuccessResponse(AllStatsModel, 'Statistics retrieved successfully')
	@ApiInternalServerErrorResponse()
	async all(@Query() q: Record<string, unknown>) {
		return await this.agg.getAll(q);
	}

	@Get(':key')
	@ApiOperation({
		summary: 'Get specific statistic',
		description:
			'Retrieve a specific statistic by key. Supports optional query parameters for filtering or customization (parameters vary by statistic).',
	})
	@ApiParam({ name: 'key', description: 'Statistic key', type: 'string', example: 'cpu_usage' })
	@ApiSuccessResponse(StatModel, 'Statistic retrieved successfully')
	@ApiInternalServerErrorResponse()
	async one(@Param('key') key: string, @Query() q: Record<string, unknown>) {
		return this.agg.get(key, q);
	}

	@Get('_keys')
	@ApiOperation({
		summary: 'List available statistics keys',
		description: 'Retrieve a list of all available statistic keys',
	})
	@ApiSuccessResponse(StatsKeysModel, 'Statistics keys retrieved successfully')
	@ApiInternalServerErrorResponse()
	keys() {
		return this.agg.listKeys();
	}
}
