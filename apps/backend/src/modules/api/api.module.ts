import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_INTERCEPTOR } from '@nestjs/core';

import { InfluxDbModule } from '../influxdb/influxdb.module';
import { InfluxDbService } from '../influxdb/services/influxdb.service';
import { StatsRegistryService } from '../stats/services/stats-registry.service';
import { StatsModule } from '../stats/stats.module';

import { API_MODULE_NAME, ApiStatsInfluxDbSchema } from './api.constants';
import { ApiMetricsInterceptor } from './interceptors/api-metrics.interceptor';
import { LocationReplaceInterceptor } from './interceptors/location-replace.interceptor';
import { OpenApiResponseInterceptor } from './interceptors/open-api-response.interceptor';
import { TransformResponseInterceptor } from './interceptors/transform-response.interceptor';
import { ApiStatsProvider } from './providers/api-stats.provider';
import { ApiMetricsService } from './services/api-metrics.service';
import { ResponseMetadataService } from './services/response-metadata.service';

@Module({
	imports: [ConfigModule, StatsModule, InfluxDbModule],
	providers: [
		ApiStatsProvider,
		ApiMetricsService,
		ResponseMetadataService,
		{ provide: APP_INTERCEPTOR, useClass: OpenApiResponseInterceptor },
		{ provide: APP_INTERCEPTOR, useClass: TransformResponseInterceptor },
		{ provide: APP_INTERCEPTOR, useClass: LocationReplaceInterceptor },
		{ provide: APP_INTERCEPTOR, useClass: ApiMetricsInterceptor },
	],
})
export class ApiModule {
	constructor(
		private readonly apiStatsProvider: ApiStatsProvider,
		private readonly statsRegistryService: StatsRegistryService,
		private readonly influxDbService: InfluxDbService,
	) {}

	onModuleInit() {
		this.influxDbService.registerSchema(ApiStatsInfluxDbSchema);

		this.statsRegistryService.register(API_MODULE_NAME, this.apiStatsProvider);
	}
}
