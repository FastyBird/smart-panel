import { Logger, Module } from '@nestjs/common';
import { ConfigModule as NestConfigModule } from '@nestjs/config/dist/config.module';
import { ConfigService as NestConfigService } from '@nestjs/config/dist/config.service';
import { TypeOrmModule } from '@nestjs/typeorm';

import { getEnvValue } from '../../common/utils/config.utils';
import { ConfigModule } from '../../modules/config/config.module';
import { ConfigService } from '../../modules/config/services/config.service';
import { PluginsTypeMapperService } from '../../modules/config/services/plugins-type-mapper.service';
import { DevicesModule } from '../../modules/devices/devices.module';
import { ChannelsTypeMapperService } from '../../modules/devices/services/channels-type-mapper.service';
import { ChannelsPropertiesTypeMapperService } from '../../modules/devices/services/channels.properties-type-mapper.service';
import { DevicesTypeMapperService } from '../../modules/devices/services/devices-type-mapper.service';
import { PlatformRegistryService } from '../../modules/devices/services/platform.registry.service';

import { HomeAssistantDiscoveredDevicesController } from './controllers/home-assistant-discovered-devices.controller';
import { HomeAssistantRegistryController } from './controllers/home-assistant-registry.controller';
import { HomeAssistantStatesController } from './controllers/home-assistant-states.controller';
import { DEVICES_HOME_ASSISTANT_PLUGIN_NAME, DEVICES_HOME_ASSISTANT_TYPE } from './devices-home-assistant.constants';
import { CreateHomeAssistantChannelPropertyDto } from './dto/create-channel-property.dto';
import { CreateHomeAssistantChannelDto } from './dto/create-channel.dto';
import { CreateHomeAssistantDeviceDto } from './dto/create-device.dto';
import { UpdateHomeAssistantChannelPropertyDto } from './dto/update-channel-property.dto';
import { UpdateHomeAssistantChannelDto } from './dto/update-channel.dto';
import { HomeAssistantUpdatePluginConfigDto } from './dto/update-config.dto';
import { UpdateHomeAssistantDeviceDto } from './dto/update-device.dto';
import {
	HomeAssistantChannelEntity,
	HomeAssistantChannelPropertyEntity,
	HomeAssistantDeviceEntity,
} from './entities/devices-home-assistant.entity';
import { BinarySensorEntityMapperService } from './mappers/binary-sensor.entity.mapper.service';
import { ClimateEntityMapperService } from './mappers/climate.entity.mapper.service';
import { LightEntityMapperService } from './mappers/light.entity.mapper.service';
import { MapperService } from './mappers/mapper.service';
import { SensorEntityMapperService } from './mappers/sensor.entity.mapper.service';
import { SwitchEntityMapperService } from './mappers/switch.entity.mapper.service';
import { UniversalEntityMapperService } from './mappers/universal.entity.mapper.service';
import { HomeAssistantConfigModel } from './models/config.model';
import { HomeAssistantDevicePlatform } from './platforms/home-assistant.device.platform';
import { HomeAssistantHttpService } from './services/home-assistant.http.service';
import { HomeAssistantWsService } from './services/home-assistant.ws.service';
import { StateChangedEventService } from './services/state-changed.event.service';
import { DevicesServiceSubscriber } from './subscribers/devices-service.subscriber';

@Module({
	imports: [
		NestConfigModule,
		TypeOrmModule.forFeature([
			HomeAssistantDeviceEntity,
			HomeAssistantChannelEntity,
			HomeAssistantChannelPropertyEntity,
		]),
		DevicesModule,
		ConfigModule,
	],
	providers: [
		HomeAssistantHttpService,
		HomeAssistantWsService,
		HomeAssistantDevicePlatform,
		MapperService,
		BinarySensorEntityMapperService,
		ClimateEntityMapperService,
		LightEntityMapperService,
		SensorEntityMapperService,
		SwitchEntityMapperService,
		UniversalEntityMapperService,
		StateChangedEventService,
		DevicesServiceSubscriber,
	],
	controllers: [
		HomeAssistantDiscoveredDevicesController,
		HomeAssistantStatesController,
		HomeAssistantRegistryController,
	],
	exports: [HomeAssistantHttpService],
})
export class DevicesHomeAssistantPlugin {
	private readonly logger = new Logger(DevicesHomeAssistantPlugin.name);

	constructor(
		private readonly configService: NestConfigService,
		private readonly appConfigService: ConfigService,
		private readonly configMapper: PluginsTypeMapperService,
		private readonly devicesMapper: DevicesTypeMapperService,
		private readonly channelsMapper: ChannelsTypeMapperService,
		private readonly channelsPropertiesMapper: ChannelsPropertiesTypeMapperService,
		private readonly platformRegistryService: PlatformRegistryService,
		private readonly homeAssistantDevicePlatform: HomeAssistantDevicePlatform,
		private readonly homeAssistantMapperService: MapperService,
		private readonly homeAssistantBinarySensorEntityMapper: BinarySensorEntityMapperService,
		private readonly homeAssistantClimateEntityMapper: ClimateEntityMapperService,
		private readonly homeAssistantLightEntityMapper: LightEntityMapperService,
		private readonly homeAssistantSensorEntityMapper: SensorEntityMapperService,
		private readonly homeAssistantSwitchEntityMapper: SwitchEntityMapperService,
		private readonly homeAssistantHttpService: HomeAssistantHttpService,
		private readonly homeAssistantWsService: HomeAssistantWsService,
		private readonly stateChangedEventService: StateChangedEventService,
		private readonly devicesServiceSubscriber: DevicesServiceSubscriber,
	) {}

	onModuleInit() {
		this.configMapper.registerMapping<HomeAssistantConfigModel, HomeAssistantUpdatePluginConfigDto>({
			type: DEVICES_HOME_ASSISTANT_PLUGIN_NAME,
			class: HomeAssistantConfigModel,
			configDto: HomeAssistantUpdatePluginConfigDto,
		});

		this.devicesMapper.registerMapping<
			HomeAssistantDeviceEntity,
			CreateHomeAssistantDeviceDto,
			UpdateHomeAssistantDeviceDto
		>({
			type: DEVICES_HOME_ASSISTANT_TYPE,
			class: HomeAssistantDeviceEntity,
			createDto: CreateHomeAssistantDeviceDto,
			updateDto: UpdateHomeAssistantDeviceDto,
			afterCreate: async (device: HomeAssistantDeviceEntity): Promise<HomeAssistantDeviceEntity> => {
				return await this.devicesServiceSubscriber.onDeviceCreated(device);
			},
		});

		this.channelsMapper.registerMapping<
			HomeAssistantChannelEntity,
			CreateHomeAssistantChannelDto,
			UpdateHomeAssistantChannelDto
		>({
			type: DEVICES_HOME_ASSISTANT_TYPE,
			class: HomeAssistantChannelEntity,
			createDto: CreateHomeAssistantChannelDto,
			updateDto: UpdateHomeAssistantChannelDto,
		});

		this.channelsPropertiesMapper.registerMapping<
			HomeAssistantChannelPropertyEntity,
			CreateHomeAssistantChannelPropertyDto,
			UpdateHomeAssistantChannelPropertyDto
		>({
			type: DEVICES_HOME_ASSISTANT_TYPE,
			class: HomeAssistantChannelPropertyEntity,
			createDto: CreateHomeAssistantChannelPropertyDto,
			updateDto: UpdateHomeAssistantChannelPropertyDto,
		});

		this.platformRegistryService.register(this.homeAssistantDevicePlatform);

		this.homeAssistantMapperService.registerMapper(this.homeAssistantBinarySensorEntityMapper);
		this.homeAssistantMapperService.registerMapper(this.homeAssistantClimateEntityMapper);
		this.homeAssistantMapperService.registerMapper(this.homeAssistantLightEntityMapper);
		this.homeAssistantMapperService.registerMapper(this.homeAssistantSensorEntityMapper);
		this.homeAssistantMapperService.registerMapper(this.homeAssistantSwitchEntityMapper);
	}

	onApplicationBootstrap() {
		const isCli = getEnvValue<string>(this.configService, 'FB_CLI', null) === 'on';

		if (
			!isCli &&
			this.appConfigService.getPluginConfig<HomeAssistantConfigModel>(DEVICES_HOME_ASSISTANT_PLUGIN_NAME).enabled ===
				true
		) {
			this.homeAssistantWsService.connect();
			this.homeAssistantWsService.registerEventsHandler(
				this.stateChangedEventService.event,
				this.stateChangedEventService,
			);

			this.homeAssistantHttpService.loadStates().catch((error: unknown) => {
				const err = error as Error;

				this.logger.error('[HOME ASSISTANT][PLUGIN] Failed to initialize devices states', {
					message: err.message,
					stack: err.stack,
				});
			});
		}
	}

	onModuleDestroy() {
		this.homeAssistantWsService.disconnect();
	}
}
