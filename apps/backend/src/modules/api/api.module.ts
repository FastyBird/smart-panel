import { Module, forwardRef } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_INTERCEPTOR } from '@nestjs/core';

import { InfluxDbModule } from '../influxdb/influxdb.module';
import { InfluxDbService } from '../influxdb/services/influxdb.service';
import { StatsRegistryService } from '../stats/services/stats-registry.service';
import { StatsModule } from '../stats/stats.module';
import { SwaggerModelsRegistryService } from '../swagger/services/swagger-models-registry.service';

import { API_MODULE_NAME, ApiStatsInfluxDbSchema } from './api.constants';
import { API_SWAGGER_EXTRA_MODELS } from './api.openapi';
import { ApiMetricsInterceptor } from './interceptors/api-metrics.interceptor';
import { LocationReplaceInterceptor } from './interceptors/location-replace.interceptor';
import { OpenApiResponseInterceptor } from './interceptors/open-api-response.interceptor';
import { TransformResponseInterceptor } from './interceptors/transform-response.interceptor';
import { ApiStatsProvider } from './providers/api-stats.provider';
import { ApiMetricsService } from './services/api-metrics.service';

@Module({
	imports: [ConfigModule, StatsModule, forwardRef(() => InfluxDbModule)],
	providers: [
		ApiStatsProvider,
		ApiMetricsService,
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
		private readonly swaggerRegistry: SwaggerModelsRegistryService,
	) {}

	onModuleInit() {
		this.influxDbService.registerSchema(ApiStatsInfluxDbSchema);

		this.statsRegistryService.register(API_MODULE_NAME, this.apiStatsProvider);

		for (const model of API_SWAGGER_EXTRA_MODELS) {
			this.swaggerRegistry.register(model);
		}
	}
}
