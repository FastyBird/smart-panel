import { Module, OnModuleInit, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { ModulesTypeMapperService } from '../config/services/modules-type-mapper.service';
import { DevicesModule } from '../devices/devices.module';
import { ChannelEntity } from '../devices/entities/devices.entity';
import { ExtensionsModule } from '../extensions/extensions.module';
import { InfluxDbModule } from '../influxdb/influxdb.module';
import { ExtensionsService } from '../extensions/services/extensions.service';
import { ApiTag } from '../swagger/decorators/api-tag.decorator';
import { SwaggerModelsRegistryService } from '../swagger/services/swagger-models-registry.service';
import { SwaggerModule } from '../swagger/swagger.module';

import { SecurityAlertsController } from './controllers/security-alerts.controller';
import { SecurityEventsController } from './controllers/security-events.controller';
import { SecurityController } from './controllers/security.controller';
import { UpdateSecurityConfigDto } from './dto/update-config.dto';
import { SecurityAlertAckEntity } from './entities/security-alert-ack.entity';
import { SecurityStateListener } from './listeners/security-state.listener';
import { SecurityConfigModel } from './models/config.model';
import { AlarmSecurityProvider } from './providers/alarm-security.provider';
import { DefaultSecurityProvider } from './providers/default-security.provider';
import { SecuritySensorsProvider } from './providers/security-sensors.provider';
import {
	SECURITY_MODULE_API_TAG_DESCRIPTION,
	SECURITY_MODULE_API_TAG_NAME,
	SECURITY_MODULE_NAME,
	SECURITY_STATE_PROVIDERS,
} from './security.constants';
import { SECURITY_SWAGGER_EXTRA_MODELS } from './security.openapi';
import { SecurityAggregatorService } from './services/security-aggregator.service';
import { SecurityAlertAckService } from './services/security-alert-ack.service';
import { SecurityEventsService } from './services/security-events.service';
import { SecurityService } from './services/security.service';
import { DetectionRulesLoaderService } from './spec/detection-rules-loader.service';

@ApiTag({
	tagName: SECURITY_MODULE_NAME,
	displayName: SECURITY_MODULE_API_TAG_NAME,
	description: SECURITY_MODULE_API_TAG_DESCRIPTION,
})
@Module({
	imports: [
		SwaggerModule,
		ExtensionsModule,
		DevicesModule,
		forwardRef(() => InfluxDbModule),
		TypeOrmModule.forFeature([SecurityAlertAckEntity, ChannelEntity]),
	],
	controllers: [SecurityController, SecurityAlertsController, SecurityEventsController],
	providers: [
		DetectionRulesLoaderService,
		DefaultSecurityProvider,
		AlarmSecurityProvider,
		SecuritySensorsProvider,
		{
			provide: SECURITY_STATE_PROVIDERS,
			useFactory: (
				alarmProvider: AlarmSecurityProvider,
				defaultProvider: DefaultSecurityProvider,
				sensorsProvider: SecuritySensorsProvider,
			) => [alarmProvider, defaultProvider, sensorsProvider],
			inject: [AlarmSecurityProvider, DefaultSecurityProvider, SecuritySensorsProvider],
		},
		SecurityAlertAckService,
		SecurityEventsService,
		SecurityAggregatorService,
		SecurityService,
		SecurityStateListener,
	],
	exports: [SecurityService, SECURITY_STATE_PROVIDERS],
})
export class SecurityModule implements OnModuleInit {
	constructor(
		private readonly swaggerRegistry: SwaggerModelsRegistryService,
		private readonly extensionsService: ExtensionsService,
		private readonly modulesMapperService: ModulesTypeMapperService,
	) {}

	onModuleInit() {
		for (const model of SECURITY_SWAGGER_EXTRA_MODELS) {
			this.swaggerRegistry.register(model);
		}

		this.modulesMapperService.registerMapping<SecurityConfigModel, UpdateSecurityConfigDto>({
			type: SECURITY_MODULE_NAME,
			class: SecurityConfigModel,
			configDto: UpdateSecurityConfigDto,
		});

		this.extensionsService.registerModuleMetadata({
			type: SECURITY_MODULE_NAME,
			name: 'Security',
			description: 'Security status, armed state, and alert management',
			author: 'FastyBird',
			readme: `# Security Module

The Security module provides security status information for the Smart Panel display.

## Features

- **Armed State** - Track system armed state (disarmed, armed home, armed away, armed night)
- **Alarm State** - Monitor alarm state (idle, pending, triggered, silenced)
- **Alert Severity** - Aggregate alert severity across security devices
- **Alert Acknowledgement** - Acknowledge alerts with persistent state
- **Extensible** - Provider-based architecture for future integrations

## Endpoints

- \`GET /api/v1/modules/security/status\` - Current security status
- \`PATCH /api/v1/modules/security/alerts/:id/ack\` - Acknowledge a single alert
- \`PATCH /api/v1/modules/security/alerts/ack\` - Acknowledge all active alerts
- \`GET /api/v1/modules/security/events\` - Recent security event timeline

## Architecture

The module is designed as a state aggregation layer. Security state providers can be registered
by integration plugins (e.g., Home Assistant, Matter) to supply real device data. Without providers,
the module returns safe default values (disarmed, no alerts).`,
			links: {
				documentation: 'https://smart-panel.fastybird.com/docs',
				repository: 'https://github.com/FastyBird/smart-panel',
			},
		});
	}
}
