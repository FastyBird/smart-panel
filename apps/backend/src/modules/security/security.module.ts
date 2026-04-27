import { Module, OnModuleInit } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { ModulesTypeMapperService } from '../config/services/modules-type-mapper.service';
import { DevicesModule } from '../devices/devices.module';
import { ChannelEntity } from '../devices/entities/devices.entity';
import { ExtensionsService } from '../extensions/services/extensions.service';
import { StorageModule } from '../storage/storage.module';
import { ApiTag } from '../swagger/decorators/api-tag.decorator';
import { SwaggerModelsRegistryService } from '../swagger/services/swagger-models-registry.service';
import { SwaggerModule } from '../swagger/swagger.module';
import { FactoryResetRegistryService } from '../system/services/factory-reset-registry.service';

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
import { SecurityModuleResetService } from './services/module-reset.service';
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
		DevicesModule,
		StorageModule,
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
		SecurityModuleResetService,
	],
	exports: [SecurityService, SECURITY_STATE_PROVIDERS],
})
export class SecurityModule implements OnModuleInit {
	constructor(
		private readonly swaggerRegistry: SwaggerModelsRegistryService,
		private readonly extensionsService: ExtensionsService,
		private readonly modulesMapperService: ModulesTypeMapperService,
		private readonly moduleReset: SecurityModuleResetService,
		private readonly factoryResetRegistry: FactoryResetRegistryService,
	) {}

	onModuleInit() {
		// Register factory reset handler
		this.factoryResetRegistry.register(
			SECURITY_MODULE_NAME,
			async (): Promise<{ success: boolean; reason?: string }> => {
				return this.moduleReset.reset();
			},
			170,
		);

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
			readme: `# Security

> Module · by FastyBird

Aggregates the security state of the home (armed mode, alarm state, alerts) into a single API surface. Without any provider plugin installed it returns safe defaults (disarmed, no alerts); integration plugins can register providers to supply real data, and the module merges the results into one consistent view.

## What it gives you

- One canonical answer to "is the alarm on?" no matter how many sensors, sirens or panels are involved
- A common alert pipe — leaks, smoke, motion, door / window, low battery, integration errors all flow through the same shape
- A small, predictable surface for dashboards, the panel and Buddy to consume; provider plugins evolve underneath without breaking clients

## Features

- **Armed state** — \`disarmed\`, \`armed_home\`, \`armed_away\`, \`armed_night\` with reason / actor tracking on every transition
- **Alarm state** — \`idle\`, \`pending\`, \`triggered\`, \`silenced\`; transitions are time-stamped and stored
- **Alert aggregation** — combines alerts from every registered provider into a unified list, picks the most severe overall level (info / warning / critical), de-duplicates noisy sensors
- **Alert acknowledgement** — acknowledge individual alerts or wipe every active alert at once; acknowledged alerts stay visible in history
- **Event timeline** — recent security events (state changes, alert raised / cleared, ack actions) are persisted as time-series for the panel "history" view
- **Provider architecture** — providers are pluggable: a default safe provider, a future alarm-panel provider, sensor-based providers; the module enforces a stable contract so adding one doesn't change the API
- **Real-time push** — every state change and alert transition is broadcast over WebSocket so panels and the admin UI react instantly

## API Endpoints

- \`GET /api/v1/modules/security/status\` — current armed / alarm state plus active alerts
- \`GET /api/v1/modules/security/events\` — recent security event timeline
- \`PATCH /api/v1/modules/security/alerts/:id/ack\` — acknowledge a single alert
- \`PATCH /api/v1/modules/security/alerts/ack\` — acknowledge every active alert
- \`PATCH /api/v1/modules/security/arm\` / \`/disarm\` — change armed state (subject to provider rules)`,
			links: {
				documentation: 'https://smart-panel.fastybird.com/docs',
				repository: 'https://github.com/FastyBird/smart-panel',
			},
		});
	}
}
