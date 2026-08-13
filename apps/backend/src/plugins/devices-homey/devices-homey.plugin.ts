import { Module, OnModuleInit } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

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
import { ExtensionsModule } from '../../modules/extensions/extensions.module';
import { ExtensionsService } from '../../modules/extensions/services/extensions.service';
import { PluginServiceManagerService } from '../../modules/extensions/services/plugin-service-manager.service';
import { ApiTag } from '../../modules/swagger/decorators/api-tag.decorator';
import { ExtendedDiscriminatorService } from '../../modules/swagger/services/extended-discriminator.service';
import { SwaggerModelsRegistryService } from '../../modules/swagger/services/swagger-models-registry.service';
import { SwaggerModule } from '../../modules/swagger/swagger.module';

import { HomeyStatusController } from './controllers/homey-status.controller';
import {
	DEVICES_HOMEY_PLUGIN_API_TAG_DESCRIPTION,
	DEVICES_HOMEY_PLUGIN_API_TAG_NAME,
	DEVICES_HOMEY_PLUGIN_NAME,
	DEVICES_HOMEY_TYPE,
} from './devices-homey.constants';
import { DEVICES_HOMEY_PLUGIN_SWAGGER_EXTRA_MODELS } from './devices-homey.openapi';
import { CreateHomeyChannelPropertyDto } from './dto/create-channel-property.dto';
import { CreateHomeyChannelDto } from './dto/create-channel.dto';
import { CreateHomeyDeviceDto } from './dto/create-device.dto';
import { UpdateHomeyChannelPropertyDto } from './dto/update-channel-property.dto';
import { UpdateHomeyChannelDto } from './dto/update-channel.dto';
import { HomeyUpdatePluginConfigDto } from './dto/update-config.dto';
import { UpdateHomeyDeviceDto } from './dto/update-device.dto';
import { HomeyChannelEntity, HomeyChannelPropertyEntity, HomeyDeviceEntity } from './entities/devices-homey.entity';
import { HomeyConfigModel } from './models/config.model';
import { HomeyConfigValidatorService } from './services/homey-config-validator.service';
import { HomeyService } from './services/homey.service';

@ApiTag({
	tagName: DEVICES_HOMEY_PLUGIN_NAME,
	displayName: DEVICES_HOMEY_PLUGIN_API_TAG_NAME,
	description: DEVICES_HOMEY_PLUGIN_API_TAG_DESCRIPTION,
})
@Module({
	imports: [
		TypeOrmModule.forFeature([HomeyDeviceEntity, HomeyChannelEntity, HomeyChannelPropertyEntity]),
		DevicesModule,
		ConfigModule,
		ExtensionsModule,
		SwaggerModule,
	],
	providers: [HomeyConfigValidatorService, HomeyService],
	controllers: [HomeyStatusController],
	exports: [HomeyService],
})
export class DevicesHomeyPlugin implements OnModuleInit {
	constructor(
		private readonly configMapper: PluginsTypeMapperService,
		private readonly devicesMapper: DevicesTypeMapperService,
		private readonly channelsMapper: ChannelsTypeMapperService,
		private readonly channelsPropertiesMapper: ChannelsPropertiesTypeMapperService,
		private readonly swaggerRegistry: SwaggerModelsRegistryService,
		private readonly discriminatorRegistry: ExtendedDiscriminatorService,
		private readonly extensionsService: ExtensionsService,
		private readonly pluginServiceManager: PluginServiceManagerService,
		private readonly homeyService: HomeyService,
	) {}

	onModuleInit(): void {
		this.configMapper.registerMapping<HomeyConfigModel, HomeyUpdatePluginConfigDto>({
			type: DEVICES_HOMEY_PLUGIN_NAME,
			class: HomeyConfigModel,
			configDto: HomeyUpdatePluginConfigDto,
			secretFields: [
				{
					path: 'api_key',
					configuredPath: 'api_key_configured',
					inputPaths: ['apiKey'],
				},
			],
		});

		this.devicesMapper.registerMapping<HomeyDeviceEntity, CreateHomeyDeviceDto, UpdateHomeyDeviceDto>({
			type: DEVICES_HOMEY_TYPE,
			class: HomeyDeviceEntity,
			createDto: CreateHomeyDeviceDto,
			updateDto: UpdateHomeyDeviceDto,
		});

		this.channelsMapper.registerMapping<HomeyChannelEntity, CreateHomeyChannelDto, UpdateHomeyChannelDto>({
			type: DEVICES_HOMEY_TYPE,
			class: HomeyChannelEntity,
			createDto: CreateHomeyChannelDto,
			updateDto: UpdateHomeyChannelDto,
		});

		this.channelsPropertiesMapper.registerMapping<
			HomeyChannelPropertyEntity,
			CreateHomeyChannelPropertyDto,
			UpdateHomeyChannelPropertyDto
		>({
			type: DEVICES_HOMEY_TYPE,
			class: HomeyChannelPropertyEntity,
			createDto: CreateHomeyChannelPropertyDto,
			updateDto: UpdateHomeyChannelPropertyDto,
		});

		for (const model of DEVICES_HOMEY_PLUGIN_SWAGGER_EXTRA_MODELS) {
			this.swaggerRegistry.register(model);
		}

		this.registerDiscriminator(DeviceEntity, HomeyDeviceEntity);
		this.registerDiscriminator(CreateDeviceDto, CreateHomeyDeviceDto);
		this.registerDiscriminator(UpdateDeviceDto, UpdateHomeyDeviceDto);
		this.registerDiscriminator(ChannelEntity, HomeyChannelEntity);
		this.registerDiscriminator(CreateChannelDto, CreateHomeyChannelDto);
		this.registerDiscriminator(UpdateChannelDto, UpdateHomeyChannelDto);
		this.registerDiscriminator(ChannelPropertyEntity, HomeyChannelPropertyEntity);
		this.registerDiscriminator(CreateChannelPropertyDto, CreateHomeyChannelPropertyDto);
		this.registerDiscriminator(UpdateChannelPropertyDto, UpdateHomeyChannelPropertyDto);

		this.extensionsService.registerPluginMetadata({
			type: DEVICES_HOMEY_PLUGIN_NAME,
			name: 'Homey',
			description: 'Imports and synchronizes logical devices managed by Homey',
			author: 'FastyBird',
			defaultEnabled: false,
			readme: `# Homey

> Plugin · by FastyBird · platform: devices

Connects Smart Panel to Homey Self-Hosted Server and compatible Homey Pro local APIs. Homey remains responsible for pairing, radio networks, drivers and apps; Smart Panel adopts selected logical devices for display and control.

The local connector is under development. Configuration credentials are write-only and are never returned by the API.`,
			links: {
				documentation: 'https://smart-panel.fastybird.com/docs',
				repository: 'https://github.com/FastyBird/smart-panel',
			},
		});

		this.pluginServiceManager.register(this.homeyService);
	}

	private registerDiscriminator(
		parentClass: new (...args: any[]) => unknown,
		modelClass: new (...args: any[]) => unknown,
	) {
		this.discriminatorRegistry.register({
			parentClass,
			discriminatorProperty: 'type',
			discriminatorValue: DEVICES_HOMEY_TYPE,
			modelClass,
		});
	}
}
