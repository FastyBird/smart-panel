import { Logger, Module } from '@nestjs/common';
import { ConfigModule as NestConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ApiExtraModels } from '@nestjs/swagger';

import { ApiTag } from '../api/decorators/api-tag.decorator';
import { InfluxDbModule } from '../influxdb/influxdb.module';
import { InfluxDbService } from '../influxdb/services/influxdb.service';
import { SeedModule } from '../seed/seeding.module';
import { SeedRegistryService } from '../seed/services/seed-registry.service';
import { StatsRegistryService } from '../stats/services/stats-registry.service';
import { StatsModule } from '../stats/stats.module';
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
import {
	ChannelControlEntity,
	ChannelEntity,
	ChannelPropertyEntity,
	DeviceControlEntity,
	DeviceEntity,
} from './entities/devices.entity';
import { DevicesStatsProvider } from './providers/devices-stats.provider';
import { ChannelsTypeMapperService } from './services/channels-type-mapper.service';
import { ChannelsControlsService } from './services/channels.controls.service';
import { ChannelsPropertiesTypeMapperService } from './services/channels.properties-type-mapper.service';
import { ChannelsPropertiesService } from './services/channels.properties.service';
import { ChannelsService } from './services/channels.service';
import { DeviceConnectionStateService } from './services/device-connection-state.service';
import { DeviceConnectivityService } from './services/device-connectivity.service';
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
import {
	ChannelControlResponseModel,
	ChannelControlsResponseModel,
	ChannelPropertiesResponseModel,
	ChannelPropertyResponseModel,
	ChannelResponseModel,
	ChannelsResponseModel,
	DeviceChannelResponseModel,
	DeviceChannelsResponseModel,
	DeviceControlResponseModel,
	DeviceControlsResponseModel,
	DeviceResponseModel,
	DevicesResponseModel,
	PropertyTimeseriesResponseModel,
} from './models/devices-response.model';
import { ChannelExistsConstraintValidator } from './validators/channel-exists-constraint.validator';
import { ChannelPropertyExistsConstraintValidator } from './validators/channel-property-exists-constraint.validator';
import { DeviceExistsConstraintValidator } from './validators/device-exists-constraint.validator';

@ApiTag({
	tagName: DEVICES_MODULE_NAME,
	displayName: DEVICES_MODULE_API_TAG_NAME,
	description: DEVICES_MODULE_API_TAG_DESCRIPTION,
})
@ApiExtraModels(
	DeviceResponseModel,
	DevicesResponseModel,
	ChannelResponseModel,
	ChannelsResponseModel,
	DeviceChannelResponseModel,
	DeviceChannelsResponseModel,
	ChannelPropertyResponseModel,
	ChannelPropertiesResponseModel,
	DeviceControlResponseModel,
	DeviceControlsResponseModel,
	ChannelControlResponseModel,
	ChannelControlsResponseModel,
	PropertyTimeseriesResponseModel,
)
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
		InfluxDbModule,
		SeedModule,
		SystemModule,
		StatsModule,
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
	],
})
export class DevicesModule {
	private readonly logger = new Logger(DevicesModule.name);

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
