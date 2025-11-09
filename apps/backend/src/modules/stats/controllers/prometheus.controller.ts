import { Controller, Get, Header } from '@nestjs/common';

import { RawRoute } from '../../api/decorators/raw-route.decorator';
import { Public } from '../../auth/guards/auth.guard';
import { PrometheusExporterService } from '../services/stats.prometheus.service';

@Public()
@Controller('/metrics')
export class PrometheusController {
	constructor(private readonly exporter: PrometheusExporterService) {}

	@RawRoute()
	@Get()
	@Header('Content-Type', 'text/plain; version=0.0.4')
	async metrics(): Promise<string> {
		return this.exporter.getMetrics();
	}
}
