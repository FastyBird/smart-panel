import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiOperation, ApiParam } from '@nestjs/swagger';

import {
	ApiInternalServerErrorResponse,
	ApiSuccessResponse,
} from '../../../common/decorators/api-documentation.decorator';
import { ApiTag } from '../../../common/decorators/api-tag.decorator';
import { toInstance } from '../../../common/utils/transform.utils';
import { StatResponseModel, StatsKeysResponseModel, StatsResponseModel } from '../models/stats-response.model';
import { StatsAggregatorService } from '../services/stats-aggregator.service';
import { STATS_MODULE_API_TAG_DESCRIPTION, STATS_MODULE_API_TAG_NAME, STATS_MODULE_NAME } from '../stats.constants';

@ApiTag({
	tagName: STATS_MODULE_NAME,
	displayName: STATS_MODULE_API_TAG_NAME,
	description: STATS_MODULE_API_TAG_DESCRIPTION,
})
@Controller('stats')
export class StatsController {
	constructor(private readonly agg: StatsAggregatorService) {}

	@Get()
	@ApiOperation({
		summary: 'Get all statistics',
		description:
			'Retrieve all available statistics. Supports optional query parameters for filtering or customization (parameters vary by statistic provider).',
	})
	@ApiSuccessResponse(StatsResponseModel, 'Statistics retrieved successfully')
	@ApiInternalServerErrorResponse()
	async all(@Query() q: Record<string, unknown>): Promise<StatsResponseModel> {
		const stats = await this.agg.getAll(q);

		return toInstance(StatsResponseModel, { data: stats });
	}

	@Get(':key')
	@ApiOperation({
		summary: 'Get specific statistic',
		description:
			'Retrieve a specific statistic by key. Supports optional query parameters for filtering or customization (parameters vary by statistic).',
	})
	@ApiParam({ name: 'key', description: 'Statistic key', type: 'string', example: 'cpu_usage' })
	@ApiSuccessResponse(StatResponseModel, 'Statistic retrieved successfully')
	@ApiInternalServerErrorResponse()
	one(@Param('key') key: string, @Query() q: Record<string, unknown>): StatResponseModel {
		const stat = this.agg.get(key, q);

		return toInstance(StatResponseModel, { data: stat });
	}

	@Get('_keys')
	@ApiOperation({
		summary: 'List available statistics keys',
		description: 'Retrieve a list of all available statistic keys',
	})
	@ApiSuccessResponse(StatsKeysResponseModel, 'Statistics keys retrieved successfully')
	@ApiInternalServerErrorResponse()
	keys(): StatsKeysResponseModel {
		const keys = this.agg.listKeys();

		return toInstance(StatsKeysResponseModel, { data: keys });
	}
}
