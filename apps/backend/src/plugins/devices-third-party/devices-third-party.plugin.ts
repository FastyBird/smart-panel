import { Module } from '@nestjs/common';
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
import { PlatformRegistryService } from '../../modules/devices/services/platform.registry.service';
import { ExtensionsModule } from '../../modules/extensions/extensions.module';
import { ExtensionsService } from '../../modules/extensions/services/extensions.service';
import { ApiTag } from '../../modules/swagger/decorators/api-tag.decorator';
import { ExtendedDiscriminatorService } from '../../modules/swagger/services/extended-discriminator.service';
import { SwaggerModelsRegistryService } from '../../modules/swagger/services/swagger-models-registry.service';
import { SwaggerModule } from '../../modules/swagger/swagger.module';

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
	imports: [
		TypeOrmModule.forFeature([ThirdPartyDeviceEntity]),
		DevicesModule,
		ConfigModule,
		ExtensionsModule,
		SwaggerModule,
	],
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
		private readonly discriminatorRegistry: ExtendedDiscriminatorService,
		private readonly extensionsService: ExtensionsService,
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

		this.discriminatorRegistry.register({
			parentClass: DeviceEntity,
			discriminatorProperty: 'type',
			discriminatorValue: DEVICES_THIRD_PARTY_TYPE,
			modelClass: ThirdPartyDeviceEntity,
		});

		this.discriminatorRegistry.register({
			parentClass: CreateDeviceDto,
			discriminatorProperty: 'type',
			discriminatorValue: DEVICES_THIRD_PARTY_TYPE,
			modelClass: CreateThirdPartyDeviceDto,
		});

		this.discriminatorRegistry.register({
			parentClass: UpdateDeviceDto,
			discriminatorProperty: 'type',
			discriminatorValue: DEVICES_THIRD_PARTY_TYPE,
			modelClass: UpdateThirdPartyDeviceDto,
		});

		this.discriminatorRegistry.register({
			parentClass: ChannelEntity,
			discriminatorProperty: 'type',
			discriminatorValue: DEVICES_THIRD_PARTY_TYPE,
			modelClass: ThirdPartyChannelEntity,
		});

		this.discriminatorRegistry.register({
			parentClass: CreateChannelDto,
			discriminatorProperty: 'type',
			discriminatorValue: DEVICES_THIRD_PARTY_TYPE,
			modelClass: CreateThirdPartyChannelDto,
		});

		this.discriminatorRegistry.register({
			parentClass: UpdateChannelDto,
			discriminatorProperty: 'type',
			discriminatorValue: DEVICES_THIRD_PARTY_TYPE,
			modelClass: UpdateThirdPartyChannelDto,
		});

		this.discriminatorRegistry.register({
			parentClass: ChannelPropertyEntity,
			discriminatorProperty: 'type',
			discriminatorValue: DEVICES_THIRD_PARTY_TYPE,
			modelClass: ThirdPartyChannelPropertyEntity,
		});

		this.discriminatorRegistry.register({
			parentClass: CreateChannelPropertyDto,
			discriminatorProperty: 'type',
			discriminatorValue: DEVICES_THIRD_PARTY_TYPE,
			modelClass: CreateThirdPartyChannelPropertyDto,
		});

		this.discriminatorRegistry.register({
			parentClass: UpdateChannelPropertyDto,
			discriminatorProperty: 'type',
			discriminatorValue: DEVICES_THIRD_PARTY_TYPE,
			modelClass: UpdateThirdPartyChannelPropertyDto,
		});

		// Register extension metadata
		this.extensionsService.registerPluginMetadata({
			type: DEVICES_THIRD_PARTY_PLUGIN_NAME,
			name: 'Third Party Devices',
			description: 'Support for integrating third-party devices via custom protocols',
			author: 'FastyBird',
			readme: `# Third Party Devices Plugin

Plugin for manually adding and managing custom devices.

## Features

- **Manual Device Creation** - Add devices that aren't auto-discovered
- **Custom Channels** - Define custom channels and properties
- **API Integration** - Devices can be controlled via the REST API
- **Flexible Schema** - Support for various property types and formats

## Use Cases

- Devices without native integration plugins
- Custom hardware projects
- Testing and development
- External systems pushing data via API

## Device Structure

Each third-party device can have:
- Multiple **channels** (e.g., relay, sensor, button)
- Multiple **properties** per channel (e.g., state, value, unit)
- Custom property types (boolean, number, string, enum)

## API Control

Third-party device states can be updated via:
- REST API endpoints
- WebSocket events
- Direct database updates (for advanced use)`,
			links: {
				documentation: 'https://smart-panel.fastybird.com/docs',
				repository: 'https://github.com/FastyBird/smart-panel',
			},
		});
	}
}
