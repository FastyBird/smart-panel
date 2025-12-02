import { Controller, Get, Header } from '@nestjs/common';
import { ApiOperation, ApiProduces, ApiResponse, ApiTags } from '@nestjs/swagger';

import { RawRoute } from '../../api/decorators/raw-route.decorator';
import { Public } from '../../auth/guards/auth.guard';
import { PrometheusExporterService } from '../services/stats.prometheus.service';
import { STATS_MODULE_API_TAG_NAME } from '../stats.constants';

@ApiTags(STATS_MODULE_API_TAG_NAME)
@Public()
@Controller('/metrics')
export class PrometheusController {
	constructor(private readonly exporter: PrometheusExporterService) {}

	@ApiOperation({
		tags: [STATS_MODULE_API_TAG_NAME],
		summary: 'Get Prometheus metrics',
		description: 'Retrieve metrics in Prometheus exposition format',
		operationId: 'get-stats-module-metrics',
	})
	@ApiProduces('text/plain')
	@ApiResponse({
		status: 200,
		description: 'Metrics retrieved successfully',
		content: {
			'text/plain': {
				schema: {
					type: 'string',
					example:
						'# HELP cpu_usage CPU usage percentage\n# TYPE cpu_usage gauge\ncpu_usage 45.2\n\n# HELP memory_usage Memory usage percentage\n# TYPE memory_usage gauge\nmemory_usage 67.8',
				},
			},
		},
	})
	@RawRoute()
	@Get()
	@Header('Content-Type', 'text/plain; version=0.0.4')
	async metrics(): Promise<string> {
		return this.exporter.getMetrics();
	}
}
