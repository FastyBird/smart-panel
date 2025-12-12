import { Module } from '@nestjs/common';
import { ConfigModule as NestConfigModule } from '@nestjs/config/dist/config.module';
import { ConfigService as NestConfigService } from '@nestjs/config/dist/config.service';
import { TypeOrmModule } from '@nestjs/typeorm';

import { getEnvValue } from '../../common/utils/config.utils';
import { ConfigModule } from '../../modules/config/config.module';
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

import {
	DEVICES_WLED_API_TAG_DESCRIPTION,
	DEVICES_WLED_API_TAG_NAME,
	DEVICES_WLED_PLUGIN_NAME,
	DEVICES_WLED_TYPE,
} from './devices-wled.constants';
import { DEVICES_WLED_PLUGIN_SWAGGER_EXTRA_MODELS } from './devices-wled.openapi';
import { CreateWledChannelPropertyDto } from './dto/create-channel-property.dto';
import { CreateWledChannelDto } from './dto/create-channel.dto';
import { CreateWledDeviceDto } from './dto/create-device.dto';
import { UpdateWledChannelPropertyDto } from './dto/update-channel-property.dto';
import { UpdateWledChannelDto } from './dto/update-channel.dto';
import { WledUpdatePluginConfigDto } from './dto/update-config.dto';
import { UpdateWledDeviceDto } from './dto/update-device.dto';
import { WledChannelEntity, WledChannelPropertyEntity, WledDeviceEntity } from './entities/devices-wled.entity';
import { WledConfigModel } from './models/config.model';
import { WledDevicePlatform } from './platforms/wled.device.platform';
import { WledDeviceMapperService } from './services/device-mapper.service';
import { WledClientAdapterService } from './services/wled-client-adapter.service';
import { WledService } from './services/wled.service';

@ApiTag({
	tagName: DEVICES_WLED_PLUGIN_NAME,
	displayName: DEVICES_WLED_API_TAG_NAME,
	description: DEVICES_WLED_API_TAG_DESCRIPTION,
})
@Module({
	imports: [
		NestConfigModule,
		TypeOrmModule.forFeature([WledDeviceEntity, WledChannelEntity, WledChannelPropertyEntity]),
		DevicesModule,
		ConfigModule,
		SwaggerModule,
	],
	providers: [
		WledClientAdapterService,
		WledDeviceMapperService,
		WledDevicePlatform,
		WledService,
	],
	controllers: [],
})
export class DevicesWledPlugin {
	constructor(
		private readonly configService: NestConfigService,
		private readonly configMapper: PluginsTypeMapperService,
		private readonly wledService: WledService,
		private readonly devicesMapper: DevicesTypeMapperService,
		private readonly channelsMapper: ChannelsTypeMapperService,
		private readonly channelsPropertiesMapper: ChannelsPropertiesTypeMapperService,
		private readonly wledDevicePlatform: WledDevicePlatform,
		private readonly platformRegistryService: PlatformRegistryService,
		private readonly swaggerRegistry: SwaggerModelsRegistryService,
		private readonly discriminatorRegistry: ExtendedDiscriminatorService,
	) {}

	onModuleInit() {
		// Register plugin config mapper
		this.configMapper.registerMapping<WledConfigModel, WledUpdatePluginConfigDto>({
			type: DEVICES_WLED_PLUGIN_NAME,
			class: WledConfigModel,
			configDto: WledUpdatePluginConfigDto,
		});

		// Register device type mapper
		this.devicesMapper.registerMapping<WledDeviceEntity, CreateWledDeviceDto, UpdateWledDeviceDto>({
			type: DEVICES_WLED_TYPE,
			createDto: CreateWledDeviceDto,
			updateDto: UpdateWledDeviceDto,
			class: WledDeviceEntity,
		});

		// Register channel type mapper
		this.channelsMapper.registerMapping<WledChannelEntity, CreateWledChannelDto, UpdateWledChannelDto>({
			type: DEVICES_WLED_TYPE,
			createDto: CreateWledChannelDto,
			updateDto: UpdateWledChannelDto,
			class: WledChannelEntity,
		});

		// Register channel property type mapper
		this.channelsPropertiesMapper.registerMapping<
			WledChannelPropertyEntity,
			CreateWledChannelPropertyDto,
			UpdateWledChannelPropertyDto
		>({
			type: DEVICES_WLED_TYPE,
			createDto: CreateWledChannelPropertyDto,
			updateDto: UpdateWledChannelPropertyDto,
			class: WledChannelPropertyEntity,
		});

		// Register device platform
		this.platformRegistryService.register(this.wledDevicePlatform);

		// Register Swagger models
		for (const model of DEVICES_WLED_PLUGIN_SWAGGER_EXTRA_MODELS) {
			this.swaggerRegistry.register(model);
		}

		// Register discriminators for polymorphic serialization
		this.discriminatorRegistry.register({
			parentClass: DeviceEntity,
			discriminatorProperty: 'type',
			discriminatorValue: DEVICES_WLED_TYPE,
			modelClass: WledDeviceEntity,
		});

		this.discriminatorRegistry.register({
			parentClass: CreateDeviceDto,
			discriminatorProperty: 'type',
			discriminatorValue: DEVICES_WLED_TYPE,
			modelClass: CreateWledDeviceDto,
		});

		this.discriminatorRegistry.register({
			parentClass: UpdateDeviceDto,
			discriminatorProperty: 'type',
			discriminatorValue: DEVICES_WLED_TYPE,
			modelClass: UpdateWledDeviceDto,
		});

		this.discriminatorRegistry.register({
			parentClass: ChannelEntity,
			discriminatorProperty: 'type',
			discriminatorValue: DEVICES_WLED_TYPE,
			modelClass: WledChannelEntity,
		});

		this.discriminatorRegistry.register({
			parentClass: CreateChannelDto,
			discriminatorProperty: 'type',
			discriminatorValue: DEVICES_WLED_TYPE,
			modelClass: CreateWledChannelDto,
		});

		this.discriminatorRegistry.register({
			parentClass: UpdateChannelDto,
			discriminatorProperty: 'type',
			discriminatorValue: DEVICES_WLED_TYPE,
			modelClass: UpdateWledChannelDto,
		});

		this.discriminatorRegistry.register({
			parentClass: ChannelPropertyEntity,
			discriminatorProperty: 'type',
			discriminatorValue: DEVICES_WLED_TYPE,
			modelClass: WledChannelPropertyEntity,
		});

		this.discriminatorRegistry.register({
			parentClass: CreateChannelPropertyDto,
			discriminatorProperty: 'type',
			discriminatorValue: DEVICES_WLED_TYPE,
			modelClass: CreateWledChannelPropertyDto,
		});

		this.discriminatorRegistry.register({
			parentClass: UpdateChannelPropertyDto,
			discriminatorProperty: 'type',
			discriminatorValue: DEVICES_WLED_TYPE,
			modelClass: UpdateWledChannelPropertyDto,
		});
	}

	async onApplicationBootstrap() {
		const isCli = getEnvValue<string>(this.configService, 'FB_CLI', null) === 'on';

		if (!isCli) {
			await this.wledService.requestStart();
		}
	}

	async onModuleDestroy() {
		await this.wledService.stop();
	}
}
