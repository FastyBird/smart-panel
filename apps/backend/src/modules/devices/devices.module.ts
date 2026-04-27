import { Module, OnModuleInit } from '@nestjs/common';
import { ConfigModule as NestConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';

import { createExtensionLogger } from '../../common/logger/extension-logger.service';
import { ModulesTypeMapperService } from '../config/services/modules-type-mapper.service';
import { ExtensionsService } from '../extensions/services/extensions.service';
import { IntentsModule } from '../intents/intents.module';
import { SeedModule } from '../seed/seeding.module';
import { SeedRegistryService } from '../seed/services/seed-registry.service';
import { SpaceEntity } from '../spaces/entities/space.entity';
import { StatsRegistryService } from '../stats/services/stats-registry.service';
import { StatsModule } from '../stats/stats.module';
import { StorageService } from '../storage/services/storage.service';
import { StorageModule } from '../storage/storage.module';
import { ApiTag } from '../swagger/decorators/api-tag.decorator';
import { SwaggerModelsRegistryService } from '../swagger/services/swagger-models-registry.service';
import { SwaggerModule } from '../swagger/swagger.module';
import { FactoryResetRegistryService } from '../system/services/factory-reset-registry.service';
import { ToolProviderRegistryService } from '../tools/services/tool-provider-registry.service';
import { ToolsModule } from '../tools/tools.module';
import { WebsocketModule } from '../websocket/websocket.module';

import { ChannelsController } from './controllers/channels.controller';
import { ChannelsControlsController } from './controllers/channels.controls.controller';
import { ChannelsPropertiesController } from './controllers/channels.properties.controller';
import { DevicesChannelsController } from './controllers/devices.channels.controller';
import { DevicesChannelsControlsController } from './controllers/devices.channels.controls.controller';
import { DevicesChannelsPropertiesController } from './controllers/devices.channels.properties.controller';
import { DevicesController } from './controllers/devices.controller';
import { DevicesControlsController } from './controllers/devices.controls.controller';
import {
	DEVICES_MODULE_API_TAG_DESCRIPTION,
	DEVICES_MODULE_API_TAG_NAME,
	DEVICES_MODULE_NAME,
	DeviceStatusStorageSchema,
	PropertyStorageSchema,
} from './devices.constants';
import { DEVICES_SWAGGER_EXTRA_MODELS } from './devices.openapi';
import { UpdateDevicesConfigDto } from './dto/update-config.dto';
import { DeviceZoneEntity } from './entities/device-zone.entity';
import {
	ChannelControlEntity,
	ChannelEntity,
	ChannelPropertyEntity,
	DeviceControlEntity,
	DeviceEntity,
} from './entities/devices.entity';
import { WebsocketExchangeListener } from './listeners/websocket-exchange.listener';
import { DevicesConfigModel } from './models/config.model';
import { DevicesStatsProvider } from './providers/devices-stats.provider';
import { ChannelsTypeMapperService } from './services/channels-type-mapper.service';
import { ChannelsControlsService } from './services/channels.controls.service';
import { ChannelsPropertiesTypeMapperService } from './services/channels.properties-type-mapper.service';
import { ChannelsPropertiesService } from './services/channels.properties.service';
import { ChannelsService } from './services/channels.service';
import { DeviceConnectionStateService } from './services/device-connection-state.service';
import { DeviceConnectivityService } from './services/device-connectivity.service';
import { DeviceControlToolService } from './services/device-control-tool.service';
import { DeviceProvisionQueueService } from './services/device-provision-queue.service';
import { DeviceValidationService } from './services/device-validation.service';
import { DeviceZonesService } from './services/device-zones.service';
import { DevicesSeederService } from './services/devices-seeder.service';
import { DevicesTypeMapperService } from './services/devices-type-mapper.service';
import { DevicesControlsService } from './services/devices.controls.service';
import { DevicesService } from './services/devices.service';
import { ModuleResetService } from './services/module-reset.service';
import { PlatformRegistryService } from './services/platform.registry.service';
import { PropertyCommandService } from './services/property-command.service';
import { PropertyTimeseriesService } from './services/property-timeseries.service';
import { PropertyValueService } from './services/property-value.service';
import { StatsService } from './services/stats.service';
import { ChannelControlEntitySubscriber } from './subscribers/channel-control-entity.subscriber';
import { ChannelEntitySubscriber } from './subscribers/channel-entity.subscriber';
import { ChannelPropertyEntitySubscriber } from './subscribers/channel-property-entity.subscriber';
import { DeviceControlEntitySubscriber } from './subscribers/device-control-entity.subscriber';
import { DeviceEntitySubscriber } from './subscribers/device-entity.subscriber';
import { ChannelExistsConstraintValidator } from './validators/channel-exists-constraint.validator';
import { ChannelPropertyExistsConstraintValidator } from './validators/channel-property-exists-constraint.validator';
import { DeviceExistsConstraintValidator } from './validators/device-exists-constraint.validator';

@ApiTag({
	tagName: DEVICES_MODULE_NAME,
	displayName: DEVICES_MODULE_API_TAG_NAME,
	description: DEVICES_MODULE_API_TAG_DESCRIPTION,
})
@Module({
	imports: [
		NestConfigModule,
		TypeOrmModule.forFeature([
			DeviceEntity,
			DeviceControlEntity,
			DeviceZoneEntity,
			ChannelEntity,
			ChannelControlEntity,
			ChannelPropertyEntity,
			SpaceEntity,
		]),
		StorageModule,
		IntentsModule,
		SeedModule,
		StatsModule,
		SwaggerModule,
		ToolsModule,
		WebsocketModule,
	],
	providers: [
		DeviceControlToolService,
		DevicesTypeMapperService,
		ChannelsTypeMapperService,
		ChannelsPropertiesTypeMapperService,
		DevicesService,
		DevicesControlsService,
		DeviceZonesService,
		ChannelsService,
		ChannelsControlsService,
		ChannelsPropertiesService,
		DeviceValidationService,
		DeviceExistsConstraintValidator,
		ChannelExistsConstraintValidator,
		ChannelPropertyExistsConstraintValidator,
		DeviceEntitySubscriber,
		DeviceControlEntitySubscriber,
		ChannelEntitySubscriber,
		ChannelControlEntitySubscriber,
		ChannelPropertyEntitySubscriber,
		DevicesSeederService,
		PlatformRegistryService,
		PropertyValueService,
		PropertyTimeseriesService,
		PropertyCommandService,
		DeviceConnectionStateService,
		StatsService,
		ModuleResetService,
		DevicesStatsProvider,
		DeviceConnectivityService,
		DeviceProvisionQueueService,
		WebsocketExchangeListener,
	],
	controllers: [
		DevicesController,
		DevicesControlsController,
		DevicesChannelsController,
		DevicesChannelsControlsController,
		DevicesChannelsPropertiesController,
		ChannelsController,
		ChannelsControlsController,
		ChannelsPropertiesController,
	],
	exports: [
		DevicesService,
		DevicesControlsService,
		DeviceZonesService,
		ChannelsService,
		ChannelsControlsService,
		ChannelsPropertiesService,
		DevicesTypeMapperService,
		ChannelsTypeMapperService,
		ChannelsPropertiesTypeMapperService,
		DevicesSeederService,
		PlatformRegistryService,
		DeviceExistsConstraintValidator,
		ChannelExistsConstraintValidator,
		ChannelPropertyExistsConstraintValidator,
		DeviceConnectivityService,
		DeviceProvisionQueueService,
		DeviceValidationService,
	],
})
export class DevicesModule implements OnModuleInit {
	private readonly logger = createExtensionLogger(DEVICES_MODULE_NAME, 'DevicesModule');

	constructor(
		private readonly moduleSeeder: DevicesSeederService,
		private readonly moduleReset: ModuleResetService,
		private readonly devicesStatsProvider: DevicesStatsProvider,
		private readonly storageService: StorageService,
		private readonly seedRegistry: SeedRegistryService,
		private readonly factoryResetRegistry: FactoryResetRegistryService,
		private readonly statsRegistryService: StatsRegistryService,
		private readonly swaggerRegistry: SwaggerModelsRegistryService,
		private readonly modulesMapperService: ModulesTypeMapperService,
		private readonly extensionsService: ExtensionsService,
		private readonly toolProviderRegistry: ToolProviderRegistryService,
		private readonly deviceControlTool: DeviceControlToolService,
	) {}

	onModuleInit() {
		// Register device control tool provider
		this.toolProviderRegistry.register(this.deviceControlTool);

		this.storageService.registerSchema(PropertyStorageSchema);
		this.storageService.registerSchema(DeviceStatusStorageSchema);

		this.seedRegistry.register(
			DEVICES_MODULE_NAME,
			async (): Promise<void> => {
				await this.moduleSeeder.seed();
			},
			100,
		);

		this.factoryResetRegistry.register(
			DEVICES_MODULE_NAME,
			async (): Promise<{ success: boolean; reason?: string }> => {
				return this.moduleReset.reset();
			},
			200,
		);

		this.statsRegistryService.register(DEVICES_MODULE_NAME, this.devicesStatsProvider);

		for (const model of DEVICES_SWAGGER_EXTRA_MODELS) {
			this.swaggerRegistry.register(model);
		}

		// Register module config mapping
		this.modulesMapperService.registerMapping<DevicesConfigModel, UpdateDevicesConfigDto>({
			type: DEVICES_MODULE_NAME,
			class: DevicesConfigModel,
			configDto: UpdateDevicesConfigDto,
		});

		// Register extension metadata
		this.extensionsService.registerModuleMetadata({
			type: DEVICES_MODULE_NAME,
			name: 'Devices',
			description: 'Central module for device management and interactions',
			author: 'FastyBird',
			readme: `# Devices

> Module · by FastyBird

Central module for registering, configuring and controlling every IoT device connected to the Smart Panel. Provides a generic device → channel → property data model that integration plugins specialize for their hardware, plus the runtime services that move values between the network, the database, the time-series store and the panel UI.

## What it gives you

- A canonical inventory of every device the panel knows about — regardless of vendor or transport
- A unified read / write surface so other modules and plugins (dashboards, scenes, Buddy, automations) never need to know how a specific device speaks
- Live state propagation: property changes received from a plugin are instantly visible on every connected admin and panel client, and asked-for changes are routed back to the right plugin

## Features

- **Device · Channel · Property model** — three-level shape that fits everything from a single switch to a multi-sensor gateway, with controls (commands), zones and platform metadata on each level
- **Type registry** — integration plugins register their own device, channel and property subtypes; this module enforces the right DTO / validation per type at the API boundary
- **Real-time state** — property values are streamed to clients over WebSocket the moment they change, and persisted as time-series for charts and history
- **Connection tracking** — automatic online / offline state per device with continuous-query history (1-minute rollups for 24h, retained 14 days) used by the stats module and the panel
- **Provisioning queue** — coordinates device discovery and onboarding across plugins so two integrations can't fight over the same physical device
- **Connectivity service** — reachability checks, reconnect orchestration and last-seen timestamps surfaced through the API
- **Tool provider for Buddy** — exposes "list / read / control device" as a structured tool the AI assistant can invoke during chat
- **Stats provider** — feeds device counts, online ratio and per-platform breakdowns to the system dashboard
- **Seeders & factory reset** — registers itself with the seed and reset registries so demo data and factory wipes work consistently
- **Validation constraints** — \`DeviceExists\`, \`ChannelExists\` and \`ChannelPropertyExists\` decorators usable by any other module's DTOs

## API Endpoints

- \`GET|POST|PATCH|DELETE /api/v1/modules/devices/devices\` — manage devices
- \`GET|POST|PATCH|DELETE /api/v1/modules/devices/devices/:id/channels\` — manage device channels
- \`GET|POST|PATCH|DELETE /api/v1/modules/devices/devices/:id/channels/:cid/properties\` — manage channel properties
- \`GET /api/v1/modules/devices/devices/:id/controls\` — list device controls
- \`GET /api/v1/modules/devices/channels\` / \`/properties\` — flat aggregated lookups across all devices`,
			links: {
				documentation: 'https://smart-panel.fastybird.com/docs',
				repository: 'https://github.com/FastyBird/smart-panel',
			},
		});
	}

	async onApplicationBootstrap() {
		// Create all continuous queries in parallel for faster startup
		const queries = [
			{
				name: 'cq_prop_counts_1m',
				body: `SELECT COUNT("numberValue") AS cn, COUNT("stringValue") AS cs
           INTO "min_14d"."property_value_counts_1m"
           FROM "raw_24h"."property_value"
           GROUP BY time(1m)`,
				resample: 'RESAMPLE EVERY 1m FOR 24h',
			},
			{
				name: 'cq_dev_state_1m',
				body: `SELECT LAST("onlineI") AS onlineI, LAST("status") AS status
           INTO "min_14d"."device_status_1m"
           FROM "raw_24h"."device_status"
           GROUP BY time(1m), "deviceId" fill(previous)`,
				resample: 'RESAMPLE EVERY 1m FOR 24h',
			},
		];

		const results = await Promise.allSettled(
			queries.map((q) => this.storageService.createContinuousQuery(q.name, q.body, undefined, q.resample)),
		);

		// Log any failures
		results.forEach((result, index) => {
			if (result.status === 'rejected') {
				const err = result.reason as Error;

				this.logger.warn(`Failed to create continuous query ${queries[index].name}`, {
					message: err?.message ?? 'Unknown error',
				});
			}
		});
	}
}
