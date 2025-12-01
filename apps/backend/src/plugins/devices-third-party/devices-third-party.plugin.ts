import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { ConfigModule } from '../../modules/config/config.module';
import { PluginsTypeMapperService } from '../../modules/config/services/plugins-type-mapper.service';
import { DevicesModule } from '../../modules/devices/devices.module';
import { ChannelsTypeMapperService } from '../../modules/devices/services/channels-type-mapper.service';
import { ChannelsPropertiesTypeMapperService } from '../../modules/devices/services/channels.properties-type-mapper.service';
import { DevicesTypeMapperService } from '../../modules/devices/services/devices-type-mapper.service';
import { PlatformRegistryService } from '../../modules/devices/services/platform.registry.service';
import { ApiTag } from '../../modules/swagger/decorators/api-tag.decorator';
import { SwaggerModelsRegistryService } from '../../modules/swagger/services/swagger-models-registry.service';

import { ThirdPartyDemoController } from './controllers/third-party-demo.controller';
import {
	DEVICES_THIRD_PARTY_PLUGIN_API_TAG_DESCRIPTION,
	DEVICES_THIRD_PARTY_PLUGIN_API_TAG_NAME,
	DEVICES_THIRD_PARTY_PLUGIN_NAME,
	DEVICES_THIRD_PARTY_TYPE,
} from './devices-third-party.constants';
import { DEVICES_THIRD_PARTY_PLUGIN_SWAGGER_EXTRA_MODELS } from './devices-third-party.openapi';
import { CreateThirdPartyChannelPropertyDto } from './dto/create-channel-property.dto';
import { CreateThirdPartyChannelDto } from './dto/create-channel.dto';
import { CreateThirdPartyDeviceDto } from './dto/create-device.dto';
import { UpdateThirdPartyChannelPropertyDto } from './dto/update-channel-property.dto';
import { UpdateThirdPartyChannelDto } from './dto/update-channel.dto';
import { ThirdPartyUpdatePluginConfigDto } from './dto/update-config.dto';
import { UpdateThirdPartyDeviceDto } from './dto/update-device.dto';
import {
	ThirdPartyChannelEntity,
	ThirdPartyChannelPropertyEntity,
	ThirdPartyDeviceEntity,
} from './entities/devices-third-party.entity';
import { ThirdPartyConfigModel } from './models/config.model';
import { ThirdPartyDevicePlatform } from './platforms/third-party-device.platform';

@ApiTag({
	tagName: DEVICES_THIRD_PARTY_PLUGIN_NAME,
	displayName: DEVICES_THIRD_PARTY_PLUGIN_API_TAG_NAME,
	description: DEVICES_THIRD_PARTY_PLUGIN_API_TAG_DESCRIPTION,
})
@Module({
	imports: [TypeOrmModule.forFeature([ThirdPartyDeviceEntity]), DevicesModule, ConfigModule],
	providers: [ThirdPartyDevicePlatform],
	controllers: [ThirdPartyDemoController],
})
export class DevicesThirdPartyPlugin {
	constructor(
		private readonly configMapper: PluginsTypeMapperService,
		private readonly devicesMapper: DevicesTypeMapperService,
		private readonly channelsMapper: ChannelsTypeMapperService,
		private readonly channelsPropertiesMapper: ChannelsPropertiesTypeMapperService,
		private readonly platformRegistryService: PlatformRegistryService,
		private readonly thirdPartyDevicePlatform: ThirdPartyDevicePlatform,
		private readonly swaggerRegistry: SwaggerModelsRegistryService,
	) {}

	onModuleInit() {
		this.configMapper.registerMapping<ThirdPartyConfigModel, ThirdPartyUpdatePluginConfigDto>({
			type: DEVICES_THIRD_PARTY_PLUGIN_NAME,
			class: ThirdPartyConfigModel,
			configDto: ThirdPartyUpdatePluginConfigDto,
		});

		this.devicesMapper.registerMapping<ThirdPartyDeviceEntity, CreateThirdPartyDeviceDto, UpdateThirdPartyDeviceDto>({
			type: DEVICES_THIRD_PARTY_TYPE,
			class: ThirdPartyDeviceEntity,
			createDto: CreateThirdPartyDeviceDto,
			updateDto: UpdateThirdPartyDeviceDto,
		});

		this.channelsMapper.registerMapping<
			ThirdPartyChannelEntity,
			CreateThirdPartyChannelDto,
			UpdateThirdPartyChannelDto
		>({
			type: DEVICES_THIRD_PARTY_TYPE,
			class: ThirdPartyChannelEntity,
			createDto: CreateThirdPartyChannelDto,
			updateDto: UpdateThirdPartyChannelDto,
		});

		this.channelsPropertiesMapper.registerMapping<
			ThirdPartyChannelPropertyEntity,
			CreateThirdPartyChannelPropertyDto,
			UpdateThirdPartyChannelPropertyDto
		>({
			type: DEVICES_THIRD_PARTY_TYPE,
			class: ThirdPartyChannelPropertyEntity,
			createDto: CreateThirdPartyChannelPropertyDto,
			updateDto: UpdateThirdPartyChannelPropertyDto,
		});

		this.platformRegistryService.register(this.thirdPartyDevicePlatform);

		for (const model of DEVICES_THIRD_PARTY_PLUGIN_SWAGGER_EXTRA_MODELS) {
			this.swaggerRegistry.register(model);
		}
	}
}
