import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { ConfigModule } from '../../modules/config/config.module';
import { PluginsTypeMapperService } from '../../modules/config/services/plugins-type-mapper.service';
import { DevicesModule } from '../../modules/devices/devices.module';
import { ChannelsTypeMapperService } from '../../modules/devices/services/channels-type-mapper.service';
import { ChannelsPropertiesTypeMapperService } from '../../modules/devices/services/channels.properties-type-mapper.service';
import { DevicesTypeMapperService } from '../../modules/devices/services/devices-type-mapper.service';
import { PlatformRegistryService } from '../../modules/devices/services/platform.registry.service';

import { HomeAssistantDevicesController } from './controllers/home-assistant-devices.controller';
import { DEVICES_HOME_ASSISTANT_PLUGIN_NAME, DEVICES_HOME_ASSISTANT_TYPE } from './devices-home-assistant.constants';
import { CreateHomeAssistantChannelPropertyDto } from './dto/create-channel-property.dto';
import { CreateHomeAssistantChannelDto } from './dto/create-channel.dto';
import { CreateHomeAssistantDeviceDto } from './dto/create-device.dto';
import { UpdateHomeAssistantChannelPropertyDto } from './dto/update-channel-property.dto';
import { UpdateHomeAssistantChannelDto } from './dto/update-channel.dto';
import { HomeAssistantUpdatePluginConfigDto } from './dto/update-config.dto';
import { UpdateHomeAssistantDeviceDto } from './dto/update-device.dto';
import { HomeAssistantConfigEntity } from './entities/config-home-assistant.entity';
import {
	HomeAssistantChannelEntity,
	HomeAssistantChannelPropertyEntity,
	HomeAssistantDeviceEntity,
} from './entities/devices-home-assistant.entity';
import { HomeAssistantDevicePlatform } from './platforms/home-assistant-device.platform';
import { HomeAssistantHttpService } from './services/home-assistant.http.service';

@Module({
	imports: [TypeOrmModule.forFeature([HomeAssistantDeviceEntity]), DevicesModule, ConfigModule],
	providers: [HomeAssistantHttpService, HomeAssistantDevicePlatform],
	controllers: [HomeAssistantDevicesController],
	exports: [HomeAssistantHttpService],
})
export class DevicesHomeAssistantPlugin {
	constructor(
		private readonly configMapper: PluginsTypeMapperService,
		private readonly devicesMapper: DevicesTypeMapperService,
		private readonly channelsMapper: ChannelsTypeMapperService,
		private readonly channelsPropertiesMapper: ChannelsPropertiesTypeMapperService,
		private readonly platformRegistryService: PlatformRegistryService,
		private readonly homeAssistantDevicePlatform: HomeAssistantDevicePlatform,
	) {}

	onModuleInit() {
		this.configMapper.registerMapping<HomeAssistantConfigEntity, HomeAssistantUpdatePluginConfigDto>({
			type: DEVICES_HOME_ASSISTANT_PLUGIN_NAME,
			class: HomeAssistantConfigEntity,
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
	}
}
