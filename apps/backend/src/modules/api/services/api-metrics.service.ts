import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';

import { InfluxDbService } from '../../influxdb/services/influxdb.service';

@Injectable()
export class ApiMetricsService implements OnModuleInit, OnModuleDestroy {
	private count = 0;

	private errors = 0;

	private durations: number[] = [];

	private timer: NodeJS.Timeout | null = null;

	constructor(private readonly influx: InfluxDbService) {}

	record(durationMs: number, isError: boolean) {
		this.count++;

		if (isError) {
			this.errors++;
		}

		this.durations.push(durationMs);
	}

	onModuleInit() {
		this.timer = setInterval(() => void this.flush(), 60_000).unref();
	}

	onModuleDestroy() {
		if (this.timer) {
			clearInterval(this.timer);
		}

		this.timer = null;
	}

	private async flush() {
		if (this.count === 0) {
			return;
		}

		const sorted = [...this.durations].sort((a, b) => a - b);
		const p95 = sorted[Math.floor(0.95 * (sorted.length - 1))] ?? 0;
		const avg = Math.round(this.durations.reduce((a, b) => a + b, 0) / this.durations.length);

		await this.influx.writePoints([
			{
				measurement: 'api_minute',
				tags: { route: '_all' },
				fields: { count: this.count, errors: this.errors, p95_ms: Math.round(p95), avg_ms: avg },
				timestamp: new Date(),
			},
		]);

		// reset bucket
		this.count = 0;
		this.errors = 0;
		this.durations = [];
	}
}
