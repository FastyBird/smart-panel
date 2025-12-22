import { Module, OnModuleInit, forwardRef } from '@nestjs/common';
import { ConfigModule as NestConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';

import { createExtensionLogger } from '../../common/logger/extension-logger.service';
import { ConfigModule } from '../config/config.module';
import { ModulesTypeMapperService } from '../config/services/modules-type-mapper.service';
import { ExtensionsModule } from '../extensions/extensions.module';
import { ExtensionsService } from '../extensions/services/extensions.service';
import { InfluxDbModule } from '../influxdb/influxdb.module';
import { InfluxDbService } from '../influxdb/services/influxdb.service';
import { SeedModule } from '../seed/seeding.module';
import { SeedRegistryService } from '../seed/services/seed-registry.service';
import { StatsRegistryService } from '../stats/services/stats-registry.service';
import { StatsModule } from '../stats/stats.module';
import { ApiTag } from '../swagger/decorators/api-tag.decorator';
import { SwaggerModelsRegistryService } from '../swagger/services/swagger-models-registry.service';
import { SwaggerModule } from '../swagger/swagger.module';
import { FactoryResetRegistryService } from '../system/services/factory-reset-registry.service';
import { SystemModule } from '../system/system.module';
import { ClientUserDto } from '../websocket/dto/client-user.dto';
import { CommandEventRegistryService } from '../websocket/services/command-event-registry.service';
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
	DeviceStatusInfluxDbSchema,
	EventHandlerName,
	EventType,
	PropertyInfluxDbSchema,
} from './devices.constants';
import { DEVICES_SWAGGER_EXTRA_MODELS } from './devices.openapi';
import { UpdateDevicesConfigDto } from './dto/update-config.dto';
import {
	ChannelControlEntity,
	ChannelEntity,
	ChannelPropertyEntity,
	DeviceControlEntity,
	DeviceEntity,
} from './entities/devices.entity';
import { DevicesConfigModel } from './models/config.model';
import { DevicesStatsProvider } from './providers/devices-stats.provider';
import { ChannelsTypeMapperService } from './services/channels-type-mapper.service';
import { ChannelsControlsService } from './services/channels.controls.service';
import { ChannelsPropertiesTypeMapperService } from './services/channels.properties-type-mapper.service';
import { ChannelsPropertiesService } from './services/channels.properties.service';
import { ChannelsService } from './services/channels.service';
import { DeviceConnectionStateService } from './services/device-connection-state.service';
import { DeviceConnectivityService } from './services/device-connectivity.service';
import { DeviceValidationService } from './services/device-validation.service';
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
			ChannelEntity,
			ChannelControlEntity,
			ChannelPropertyEntity,
		]),
		forwardRef(() => ConfigModule),
		forwardRef(() => ExtensionsModule),
		forwardRef(() => InfluxDbModule),
		SeedModule,
		forwardRef(() => SystemModule),
		StatsModule,
		SwaggerModule,
		WebsocketModule,
	],
	providers: [
		DevicesTypeMapperService,
		ChannelsTypeMapperService,
		ChannelsPropertiesTypeMapperService,
		DevicesService,
		DevicesControlsService,
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
		DeviceValidationService,
	],
})
export class DevicesModule implements OnModuleInit {
	private readonly logger = createExtensionLogger(DEVICES_MODULE_NAME, 'DevicesModule');

	constructor(
		private readonly eventRegistry: CommandEventRegistryService,
		private readonly moduleSeeder: DevicesSeederService,
		private readonly moduleReset: ModuleResetService,
		private readonly propertyCommandService: PropertyCommandService,
		private readonly devicesStatsProvider: DevicesStatsProvider,
		private readonly influxDbService: InfluxDbService,
		private readonly seedRegistry: SeedRegistryService,
		private readonly factoryResetRegistry: FactoryResetRegistryService,
		private readonly statsRegistryService: StatsRegistryService,
		private readonly swaggerRegistry: SwaggerModelsRegistryService,
		private readonly modulesMapperService: ModulesTypeMapperService,
		private readonly extensionsService: ExtensionsService,
	) {}

	onModuleInit() {
		this.influxDbService.registerSchema(PropertyInfluxDbSchema);
		this.influxDbService.registerSchema(DeviceStatusInfluxDbSchema);

		this.eventRegistry.register(
			EventType.CHANNEL_PROPERTY_SET,
			EventHandlerName.INTERNAL_SET_PROPERTY,
			(user: ClientUserDto, payload?: object) => this.propertyCommandService.handleInternal(user, payload),
		);

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
			readme: `# Devices Module

The Devices module is the central component for managing all IoT devices connected to the Smart Panel.

## Features

- **Device Management** - Add, configure, and remove devices
- **Channel Support** - Each device can have multiple channels (e.g., temperature sensor, relay switch)
- **Property Tracking** - Monitor and control device properties in real-time
- **Status Monitoring** - Track device connectivity and online status
- **Time-series Data** - Store historical property values in InfluxDB

## Supported Device Types

Devices are managed through platform plugins that provide integration with specific device ecosystems:

- Shelly NG devices
- Shelly Gen1 devices
- Home Assistant devices
- Third-party/manual devices

## Architecture

The module uses a flexible type mapping system that allows plugins to register their own device, channel, and property types while maintaining a unified API.`,
			links: {
				documentation: 'https://smart-panel.fastybird.com/docs',
				repository: 'https://github.com/FastyBird/smart-panel',
			},
		});
	}

	async onApplicationBootstrap() {
		try {
			await this.influxDbService.createContinuousQuery(
				'cq_prop_counts_1m',
				`SELECT COUNT("numberValue") AS cn, COUNT("stringValue") AS cs
           INTO "min_14d"."property_value_counts_1m"
           FROM "raw_24h"."property_value"
           GROUP BY time(1m)`,
				undefined,
				'RESAMPLE EVERY 1m FOR 24h',
			);
		} catch (error) {
			const err = error as Error;

			this.logger.warn('[INFLUXDB] Failed to create continuous query cq_prop_counts_1m', {
				message: err.message,
			});
		}

		try {
			await this.influxDbService.createContinuousQuery(
				'cq_dev_state_1m',
				`SELECT LAST("onlineI") AS onlineI, LAST("status") AS status
           INTO "min_14d"."device_status_1m"
           FROM "raw_24h"."device_status"
           GROUP BY time(1m), "deviceId" fill(previous)`,
				undefined,
				'RESAMPLE EVERY 1m FOR 24h',
			);
		} catch (error) {
			const err = error as Error;

			this.logger.warn('[INFLUXDB] Failed to create continuous query cq_dev_state_1m', {
				message: err.message,
			});
		}

		try {
			await this.influxDbService.createContinuousQuery(
				'cq_online_count_1m',
				`SELECT SUM("onlineI") AS online_count
           INTO "min_14d"."online_count_1m"
           FROM "min_14d"."device_status_1m"
           GROUP BY time(1m) fill(previous)`,
				undefined,
				'RESAMPLE EVERY 1m FOR 24h',
			);
		} catch (error) {
			const err = error as Error;

			this.logger.warn('[INFLUXDB] Failed to create continuous query cq_online_count_1m', {
				message: err.message,
			});
		}
	}
}
