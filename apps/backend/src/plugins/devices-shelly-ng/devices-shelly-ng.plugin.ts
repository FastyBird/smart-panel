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
import { DEVICES_HOME_ASSISTANT_PLUGIN_NAME } from '../devices-home-assistant/devices-home-assistant.constants';

import { DelegatesManagerService } from './delegates/delegates-manager.service';
import { DEVICES_SHELLY_NG_PLUGIN_NAME, DEVICES_SHELLY_NG_TYPE } from './devices-shelly-ng.constants';
import { CreateShellyNgChannelPropertyDto } from './dto/create-channel-property.dto';
import { CreateShellyNgChannelDto } from './dto/create-channel.dto';
import { CreateShellyNgDeviceDto } from './dto/create-device.dto';
import { UpdateShellyNgChannelPropertyDto } from './dto/update-channel-property.dto';
import { UpdateShellyNgChannelDto } from './dto/update-channel.dto';
import { ShellyNgUpdatePluginConfigDto } from './dto/update-config.dto';
import { UpdateShellyNgDeviceDto } from './dto/update-device.dto';
import {
	ShellyNgChannelEntity,
	ShellyNgChannelPropertyEntity,
	ShellyNgDeviceEntity,
} from './entities/devices-shelly-ng.entity';
import { ShellyNgConfigModel } from './models/config.model';
import { ShellyNgDevicePlatform } from './platforms/shelly-ng.device.platform';
import { DatabaseDiscovererService } from './services/database-discoverer.service';
import { ShellyNgService } from './services/shelly-ng.service';

@Module({
	imports: [
		NestConfigModule,
		TypeOrmModule.forFeature([ShellyNgDeviceEntity, ShellyNgChannelEntity, ShellyNgChannelPropertyEntity]),
		DevicesModule,
		ConfigModule,
	],
	providers: [DatabaseDiscovererService, DelegatesManagerService, ShellyNgService, ShellyNgDevicePlatform],
})
export class DevicesShellyNgPlugin {
	private readonly logger = new Logger(DevicesShellyNgPlugin.name);

	constructor(
		private readonly configService: NestConfigService,
		private readonly appConfigService: ConfigService,
		private readonly configMapper: PluginsTypeMapperService,
		private readonly shellyNgService: ShellyNgService,
		private readonly devicesMapper: DevicesTypeMapperService,
		private readonly channelsMapper: ChannelsTypeMapperService,
		private readonly channelsPropertiesMapper: ChannelsPropertiesTypeMapperService,
	) {}

	onModuleInit() {
		this.configMapper.registerMapping<ShellyNgConfigModel, ShellyNgUpdatePluginConfigDto>({
			type: DEVICES_SHELLY_NG_PLUGIN_NAME,
			class: ShellyNgConfigModel,
			configDto: ShellyNgUpdatePluginConfigDto,
		});

		this.devicesMapper.registerMapping<ShellyNgDeviceEntity, CreateShellyNgDeviceDto, UpdateShellyNgDeviceDto>({
			type: DEVICES_SHELLY_NG_TYPE,
			createDto: CreateShellyNgDeviceDto,
			updateDto: UpdateShellyNgDeviceDto,
			class: ShellyNgDeviceEntity,
		});

		this.channelsMapper.registerMapping<ShellyNgChannelEntity, CreateShellyNgChannelDto, UpdateShellyNgChannelDto>({
			type: DEVICES_SHELLY_NG_TYPE,
			createDto: CreateShellyNgChannelDto,
			updateDto: UpdateShellyNgChannelDto,
			class: ShellyNgChannelEntity,
		});

		this.channelsPropertiesMapper.registerMapping<
			ShellyNgChannelPropertyEntity,
			CreateShellyNgChannelPropertyDto,
			UpdateShellyNgChannelPropertyDto
		>({
			type: DEVICES_SHELLY_NG_TYPE,
			createDto: CreateShellyNgChannelPropertyDto,
			updateDto: UpdateShellyNgChannelPropertyDto,
			class: ShellyNgChannelPropertyEntity,
		});
	}

	async onApplicationBootstrap() {
		const isCli = getEnvValue<string>(this.configService, 'FB_CLI', null) === 'on';

		if (!isCli && this.appConfigService.getPluginConfig(DEVICES_SHELLY_NG_PLUGIN_NAME).enabled) {
			await this.shellyNgService.start();
		}
	}

	onModuleDestroy() {
		this.shellyNgService.stop();
	}
}
