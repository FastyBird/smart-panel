import { Module, forwardRef } from '@nestjs/common';
import { ConfigModule as NestConfigModule, ConfigService as NestConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';

import { DEFAULT_TOKEN_EXPIRATION, DEFAULT_TOKEN_SECRET } from '../../app.constants';
import { getEnvValue } from '../../common/utils/config.utils';
import { AuthModule } from '../auth/auth.module';
import { InfluxDbModule } from '../influxdb/influxdb.module';
import { InfluxDbService } from '../influxdb/services/influxdb.service';
import { StatsRegistryService } from '../stats/services/stats-registry.service';
import { StatsModule } from '../stats/stats.module';
import { SwaggerModelsRegistryService } from '../swagger/services/swagger-models-registry.service';
import { UsersModule } from '../users/users.module';

import { WebsocketGateway } from './gateway/websocket.gateway';
import { WsStatsProvider } from './providers/ws-stats.provider';
import { CommandEventRegistryService } from './services/command-event-registry.service';
import { WsAuthService } from './services/ws-auth.service';
import { WsMetricsService } from './services/ws-metrics.service';
import { WEBSOCKET_MODULE_NAME, WsConnInfluxDbSchema, WsStatsInfluxDbSchema } from './websocket.constants';
import { WEBSOCKET_SWAGGER_EXTRA_MODELS } from './websocket.openapi';

@Module({
	imports: [
		JwtModule.registerAsync({
			imports: [NestConfigModule],
			inject: [NestConfigService],
			useFactory: (configService: NestConfigService) => {
				return {
					secret: getEnvValue<string | undefined>(configService, 'FB_TOKEN_SECRET', DEFAULT_TOKEN_SECRET),
					signOptions: { expiresIn: DEFAULT_TOKEN_EXPIRATION },
				};
			},
		}),
		forwardRef(() => AuthModule),
		forwardRef(() => UsersModule),
		InfluxDbModule,
		StatsModule,
	],
	providers: [WebsocketGateway, CommandEventRegistryService, WsAuthService, WsMetricsService, WsStatsProvider],
	exports: [WebsocketGateway, CommandEventRegistryService],
})
export class WebsocketModule {
	constructor(
		private readonly wsStatsProvider: WsStatsProvider,
		private readonly statsRegistryService: StatsRegistryService,
		private readonly influxDbService: InfluxDbService,
		private readonly swaggerRegistry: SwaggerModelsRegistryService,
	) {}

	onModuleInit() {
		this.influxDbService.registerSchema(WsStatsInfluxDbSchema);
		this.influxDbService.registerSchema(WsConnInfluxDbSchema);

		this.statsRegistryService.register(WEBSOCKET_MODULE_NAME, this.wsStatsProvider);

		for (const model of WEBSOCKET_SWAGGER_EXTRA_MODELS) {
			this.swaggerRegistry.register(model);
		}
	}
}
