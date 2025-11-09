import { Controller, Get, Param, Query } from '@nestjs/common';

import { StatsAggregatorService } from '../services/stats-aggregator.service';

@Controller('stats')
export class StatsController {
	constructor(private readonly agg: StatsAggregatorService) {}

	@Get()
	async all(@Query() q: Record<string, unknown>) {
		return await this.agg.getAll(q);
	}

	@Get(':key')
	async one(@Param('key') key: string, @Query() q: Record<string, unknown>) {
		return this.agg.get(key, q);
	}

	@Get('_keys')
	keys() {
		return this.agg.listKeys();
	}
}
