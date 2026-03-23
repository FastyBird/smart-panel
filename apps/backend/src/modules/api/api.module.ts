import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_INTERCEPTOR } from '@nestjs/core';

import { StatsRegistryService } from '../stats/services/stats-registry.service';
import { StatsModule } from '../stats/stats.module';
import { StorageService } from '../storage/services/storage.service';
import { StorageModule } from '../storage/storage.module';
import { SwaggerModelsRegistryService } from '../swagger/services/swagger-models-registry.service';

import { API_MODULE_NAME, ApiStatsStorageSchema } from './api.constants';
import { API_SWAGGER_EXTRA_MODELS } from './api.openapi';
import { ApiMetricsInterceptor } from './interceptors/api-metrics.interceptor';
import { LocationReplaceInterceptor } from './interceptors/location-replace.interceptor';
import { OpenApiResponseInterceptor } from './interceptors/open-api-response.interceptor';
import { TransformResponseInterceptor } from './interceptors/transform-response.interceptor';
import { ApiStatsProvider } from './providers/api-stats.provider';
import { ApiMetricsService } from './services/api-metrics.service';

@Module({
	imports: [ConfigModule, StatsModule, StorageModule],
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
		private readonly storageService: StorageService,
		private readonly swaggerRegistry: SwaggerModelsRegistryService,
	) {}

	onModuleInit() {
		this.storageService.registerSchema(ApiStatsStorageSchema);

		this.statsRegistryService.register(API_MODULE_NAME, this.apiStatsProvider);

		for (const model of API_SWAGGER_EXTRA_MODELS) {
			this.swaggerRegistry.register(model);
		}
	}
}
