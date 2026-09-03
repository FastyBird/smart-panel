import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService as NestConfigService } from '@nestjs/config';
import { APP_INTERCEPTOR } from '@nestjs/core';

import { getEnvValue } from '../../common/utils/config.utils';
import { StatsRegistryService } from '../stats/services/stats-registry.service';
import { StatsModule } from '../stats/stats.module';
import { StorageService } from '../storage/services/storage.service';
import { StorageModule } from '../storage/storage.module';
import { SwaggerModelsRegistryService } from '../swagger/services/swagger-models-registry.service';

import {
	API_MODULE_NAME,
	ApiStatsStorageSchema,
	ENV_TRUSTED_PROXY_SOURCE_ID,
	TRUSTED_PROXIES_ENV_KEY,
} from './api.constants';
import { API_SWAGGER_EXTRA_MODELS } from './api.openapi';
import { ApiMetricsInterceptor } from './interceptors/api-metrics.interceptor';
import { LocationReplaceInterceptor } from './interceptors/location-replace.interceptor';
import { OpenApiResponseInterceptor } from './interceptors/open-api-response.interceptor';
import { TransformResponseInterceptor } from './interceptors/transform-response.interceptor';
import { ApiStatsProvider } from './providers/api-stats.provider';
import { ApiMetricsService } from './services/api-metrics.service';
import { ClientAddressService } from './services/client-address.service';
import { TrustedProxyRegistryService } from './services/trusted-proxy-registry.service';

@Module({
	imports: [ConfigModule, StatsModule, StorageModule],
	providers: [
		ApiStatsProvider,
		ApiMetricsService,
		TrustedProxyRegistryService,
		ClientAddressService,
		{ provide: APP_INTERCEPTOR, useClass: OpenApiResponseInterceptor },
		{ provide: APP_INTERCEPTOR, useClass: TransformResponseInterceptor },
		{ provide: APP_INTERCEPTOR, useClass: LocationReplaceInterceptor },
		{ provide: APP_INTERCEPTOR, useClass: ApiMetricsInterceptor },
	],
	exports: [TrustedProxyRegistryService, ClientAddressService],
})
export class ApiModule {
	constructor(
		private readonly apiStatsProvider: ApiStatsProvider,
		private readonly statsRegistryService: StatsRegistryService,
		private readonly storageService: StorageService,
		private readonly swaggerRegistry: SwaggerModelsRegistryService,
		private readonly trustedProxyRegistry: TrustedProxyRegistryService,
		private readonly nestConfigService: NestConfigService,
	) {}

	onModuleInit() {
		this.storageService.registerSchema(ApiStatsStorageSchema);

		this.statsRegistryService.register(API_MODULE_NAME, this.apiStatsProvider);

		for (const model of API_SWAGGER_EXTRA_MODELS) {
			this.swaggerRegistry.register(model);
		}

		// Operators behind an existing reverse proxy can opt in before RA-2
		// (the `remote-access` module) contributes providers' own proxy
		// addresses through the same registry.
		this.trustedProxyRegistry.register({
			id: ENV_TRUSTED_PROXY_SOURCE_ID,
			addresses: () => this.readEnvTrustedProxies(),
		});
	}

	private readEnvTrustedProxies(): string[] {
		const configured = getEnvValue<string>(this.nestConfigService, TRUSTED_PROXIES_ENV_KEY, '');

		return configured
			.split(',')
			.map((value) => value.trim())
			.filter((value) => value.length > 0);
	}
}
