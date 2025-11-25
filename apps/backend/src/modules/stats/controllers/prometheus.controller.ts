import { Controller, Get, Header } from '@nestjs/common';
import { ApiOperation, ApiProduces, ApiResponse, ApiTags } from '@nestjs/swagger';

import { RawRoute } from '../../api/decorators/raw-route.decorator';
import { Public } from '../../auth/guards/auth.guard';
import { PrometheusExporterService } from '../services/stats.prometheus.service';

@ApiTags('stats-module')
@Public()
@Controller('/metrics')
export class PrometheusController {
	constructor(private readonly exporter: PrometheusExporterService) {}

	@RawRoute()
	@Get()
	@Header('Content-Type', 'text/plain; version=0.0.4')
	@ApiOperation({
		summary: 'Get Prometheus metrics',
		description: 'Retrieve metrics in Prometheus exposition format',
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
	async metrics(): Promise<string> {
		return this.exporter.getMetrics();
	}
}
