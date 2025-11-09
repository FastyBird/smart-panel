import { Module } from '@nestjs/common';
import { ConfigModule as NestConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';

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
import { DeviceStatusService } from './services/device-status.service';
import { DevicesSeederService } from './services/devices-seeder.service';
import { DevicesTypeMapperService } from './services/devices-type-mapper.service';
import { DevicesControlsService } from './services/devices.controls.service';
import { DevicesService } from './services/devices.service';
import { ModuleResetService } from './services/module-reset.service';
import { PlatformRegistryService } from './services/platform.registry.service';
import { PropertyCommandService } from './services/property-command.service';
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
		PropertyCommandService,
		DeviceStatusService,
		StatsService,
		ModuleResetService,
		DevicesStatsProvider,
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
	],
})
export class DevicesModule {
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
		await this.influxDbService.createContinuousQuery(
			'cq_prop_counts_1m',
			`SELECT COUNT("numberValue") AS cn, COUNT("stringValue") AS cs
           INTO "min_14d"."property_value_counts_1m"
           FROM "raw_24h"."property_value"
           GROUP BY time(1m)`,
		);

		await this.influxDbService.createContinuousQuery(
			'cq_dev_state_1m',
			`SELECT LAST("online_i") AS online_i, LAST("status") AS status
           INTO "min_14d"."device_status_1m"
           FROM "raw_24h"."device_status"
           GROUP BY time(1m), "deviceId"`,
		);

		await this.influxDbService.createContinuousQuery(
			'cq_online_count_1m',
			`SELECT SUM("online_i") AS online_count
           INTO "min_14d"."online_count_1m"
           FROM "min_14d"."device_status_1m"
           GROUP BY time(1m)`,
		);
	}
}
