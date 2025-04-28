import { Module } from '@nestjs/common';
import { ConfigModule as NestConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';

import { InfluxDbModule } from '../influxdb/influxdb.module';
import { InfluxDbService } from '../influxdb/services/influxdb.service';
import { SeedModule } from '../seed/seeding.module';
import { SeedService } from '../seed/services/seed.service';
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
import { EventHandlerName, EventType, PropertyInfluxDbSchema } from './devices.constants';
import {
	ChannelControlEntity,
	ChannelEntity,
	ChannelPropertyEntity,
	DeviceControlEntity,
	DeviceEntity,
} from './entities/devices.entity';
import { ChannelsTypeMapperService } from './services/channels-type-mapper.service';
import { ChannelsControlsService } from './services/channels.controls.service';
import { ChannelsPropertiesTypeMapperService } from './services/channels.properties-type-mapper.service';
import { ChannelsPropertiesService } from './services/channels.properties.service';
import { ChannelsService } from './services/channels.service';
import { DevicesSeederService } from './services/devices-seeder.service';
import { DevicesTypeMapperService } from './services/devices-type-mapper.service';
import { DevicesControlsService } from './services/devices.controls.service';
import { DevicesService } from './services/devices.service';
import { PlatformRegistryService } from './services/platform.registry.service';
import { PropertyCommandService } from './services/property-command.service';
import { PropertyValueService } from './services/property-value.service';
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
		WebsocketModule,
	],
	providers: [
		DevicesService,
		DevicesControlsService,
		ChannelsService,
		ChannelsControlsService,
		ChannelsPropertiesService,
		DevicesTypeMapperService,
		ChannelsTypeMapperService,
		ChannelsPropertiesTypeMapperService,
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
		private readonly propertyCommandService: PropertyCommandService,
		private readonly influxDbService: InfluxDbService,
		private readonly seedService: SeedService,
	) {}

	onModuleInit() {
		this.eventRegistry.register(
			EventType.CHANNEL_PROPERTY_SET,
			EventHandlerName.INTERNAL_SET_PROPERTY,
			(user: ClientUserDto, payload?: object) => this.propertyCommandService.handleInternal(user, payload),
		);

		this.influxDbService.registerSchema(PropertyInfluxDbSchema);

		this.seedService.registerSeeder(this.moduleSeeder, 100);
	}
}
