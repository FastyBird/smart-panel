import { Logger, Module } from '@nestjs/common';
import { ConfigModule as NestConfigModule } from '@nestjs/config/dist/config.module';
import { ConfigService as NestConfigService } from '@nestjs/config/dist/config.service';
import { TypeOrmModule } from '@nestjs/typeorm';

import { getEnvValue } from '../../common/utils/config.utils';
import { ConfigModule } from '../../modules/config/config.module';
import { ConfigService } from '../../modules/config/services/config.service';
import { PluginsTypeMapperService } from '../../modules/config/services/plugins-type-mapper.service';
import { DevicesModule } from '../../modules/devices/devices.module';
import { CreateChannelPropertyDto } from '../../modules/devices/dto/create-channel-property.dto';
import { CreateChannelDto } from '../../modules/devices/dto/create-channel.dto';
import { CreateDeviceDto } from '../../modules/devices/dto/create-device.dto';
import { UpdateChannelPropertyDto } from '../../modules/devices/dto/update-channel-property.dto';
import { UpdateChannelDto } from '../../modules/devices/dto/update-channel.dto';
import { UpdateDeviceDto } from '../../modules/devices/dto/update-device.dto';
import { ChannelEntity, ChannelPropertyEntity, DeviceEntity } from '../../modules/devices/entities/devices.entity';
import { ChannelsTypeMapperService } from '../../modules/devices/services/channels-type-mapper.service';
import { ChannelsPropertiesTypeMapperService } from '../../modules/devices/services/channels.properties-type-mapper.service';
import { DevicesTypeMapperService } from '../../modules/devices/services/devices-type-mapper.service';
import { PlatformRegistryService } from '../../modules/devices/services/platform.registry.service';
import { ApiTag } from '../../modules/swagger/decorators/api-tag.decorator';
import { ExtendedDiscriminatorService } from '../../modules/swagger/services/extended-discriminator.service';
import { SwaggerModelsRegistryService } from '../../modules/swagger/services/swagger-models-registry.service';
import { SwaggerModule } from '../../modules/swagger/swagger.module';

import { HomeAssistantDiscoveredDevicesController } from './controllers/home-assistant-discovered-devices.controller';
import { HomeAssistantRegistryController } from './controllers/home-assistant-registry.controller';
import { HomeAssistantStatesController } from './controllers/home-assistant-states.controller';
import {
	DEVICES_HOME_ASSISTANT_PLUGIN_API_TAG_DESCRIPTION,
	DEVICES_HOME_ASSISTANT_PLUGIN_API_TAG_NAME,
	DEVICES_HOME_ASSISTANT_PLUGIN_NAME,
	DEVICES_HOME_ASSISTANT_TYPE,
} from './devices-home-assistant.constants';
import { DEVICES_HOME_ASSISTANT_PLUGIN_SWAGGER_EXTRA_MODELS } from './devices-home-assistant.openapi';
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

@ApiTag({
	tagName: DEVICES_HOME_ASSISTANT_PLUGIN_NAME,
	displayName: DEVICES_HOME_ASSISTANT_PLUGIN_API_TAG_NAME,
	description: DEVICES_HOME_ASSISTANT_PLUGIN_API_TAG_DESCRIPTION,
})
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
		SwaggerModule,
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
		private readonly swaggerRegistry: SwaggerModelsRegistryService,
		private readonly discriminatorRegistry: ExtendedDiscriminatorService,
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

		for (const model of DEVICES_HOME_ASSISTANT_PLUGIN_SWAGGER_EXTRA_MODELS) {
			this.swaggerRegistry.register(model);
		}

		this.homeAssistantMapperService.registerMapper(this.homeAssistantBinarySensorEntityMapper);
		this.homeAssistantMapperService.registerMapper(this.homeAssistantClimateEntityMapper);
		this.homeAssistantMapperService.registerMapper(this.homeAssistantLightEntityMapper);
		this.homeAssistantMapperService.registerMapper(this.homeAssistantSensorEntityMapper);
		this.homeAssistantMapperService.registerMapper(this.homeAssistantSwitchEntityMapper);

		this.discriminatorRegistry.register({
			parentClass: DeviceEntity,
			discriminatorProperty: 'type',
			discriminatorValue: DEVICES_HOME_ASSISTANT_TYPE,
			modelClass: HomeAssistantDeviceEntity,
		});

		this.discriminatorRegistry.register({
			parentClass: CreateDeviceDto,
			discriminatorProperty: 'type',
			discriminatorValue: DEVICES_HOME_ASSISTANT_TYPE,
			modelClass: CreateHomeAssistantDeviceDto,
		});

		this.discriminatorRegistry.register({
			parentClass: UpdateDeviceDto,
			discriminatorProperty: 'type',
			discriminatorValue: DEVICES_HOME_ASSISTANT_TYPE,
			modelClass: UpdateHomeAssistantDeviceDto,
		});

		this.discriminatorRegistry.register({
			parentClass: ChannelEntity,
			discriminatorProperty: 'type',
			discriminatorValue: DEVICES_HOME_ASSISTANT_TYPE,
			modelClass: HomeAssistantChannelEntity,
		});

		this.discriminatorRegistry.register({
			parentClass: CreateChannelDto,
			discriminatorProperty: 'type',
			discriminatorValue: DEVICES_HOME_ASSISTANT_TYPE,
			modelClass: CreateHomeAssistantChannelDto,
		});

		this.discriminatorRegistry.register({
			parentClass: UpdateChannelDto,
			discriminatorProperty: 'type',
			discriminatorValue: DEVICES_HOME_ASSISTANT_TYPE,
			modelClass: UpdateHomeAssistantChannelDto,
		});

		this.discriminatorRegistry.register({
			parentClass: ChannelPropertyEntity,
			discriminatorProperty: 'type',
			discriminatorValue: DEVICES_HOME_ASSISTANT_TYPE,
			modelClass: HomeAssistantChannelPropertyEntity,
		});

		this.discriminatorRegistry.register({
			parentClass: CreateChannelPropertyDto,
			discriminatorProperty: 'type',
			discriminatorValue: DEVICES_HOME_ASSISTANT_TYPE,
			modelClass: CreateHomeAssistantChannelPropertyDto,
		});

		this.discriminatorRegistry.register({
			parentClass: UpdateChannelPropertyDto,
			discriminatorProperty: 'type',
			discriminatorValue: DEVICES_HOME_ASSISTANT_TYPE,
			modelClass: UpdateHomeAssistantChannelPropertyDto,
		});
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
