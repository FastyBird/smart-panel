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
import { ExtensionsModule } from '../../modules/extensions/extensions.module';
import { ExtensionsService } from '../../modules/extensions/services/extensions.service';
import { ApiTag } from '../../modules/swagger/decorators/api-tag.decorator';
import { ExtendedDiscriminatorService } from '../../modules/swagger/services/extended-discriminator.service';
import { SwaggerModelsRegistryService } from '../../modules/swagger/services/swagger-models-registry.service';
import { SwaggerModule } from '../../modules/swagger/swagger.module';

import { ShellyV1DevicesController } from './controllers/shelly-v1-devices.controller';
import {
	DEVICES_SHELLY_V1_PLUGIN_API_TAG_DESCRIPTION,
	DEVICES_SHELLY_V1_PLUGIN_API_TAG_NAME,
	DEVICES_SHELLY_V1_PLUGIN_NAME,
	DEVICES_SHELLY_V1_TYPE,
} from './devices-shelly-v1.constants';
import { DEVICES_SHELLY_V1_PLUGIN_SWAGGER_EXTRA_MODELS } from './devices-shelly-v1.openapi';
import { CreateShellyV1ChannelPropertyDto } from './dto/create-channel-property.dto';
import { CreateShellyV1ChannelDto } from './dto/create-channel.dto';
import { CreateShellyV1DeviceDto } from './dto/create-device.dto';
import { UpdateShellyV1ChannelPropertyDto } from './dto/update-channel-property.dto';
import { UpdateShellyV1ChannelDto } from './dto/update-channel.dto';
import { ShellyV1UpdatePluginConfigDto } from './dto/update-config.dto';
import { UpdateShellyV1DeviceDto } from './dto/update-device.dto';
import {
	ShellyV1ChannelEntity,
	ShellyV1ChannelPropertyEntity,
	ShellyV1DeviceEntity,
} from './entities/devices-shelly-v1.entity';
import { ShellyV1ConfigModel } from './models/config.model';
import { ShellyV1DevicePlatform } from './platforms/shelly-v1.device.platform';
import { DeviceMapperService } from './services/device-mapper.service';
import { ShelliesAdapterService } from './services/shellies-adapter.service';
import { ShellyV1HttpClientService } from './services/shelly-v1-http-client.service';
import { ShellyV1ProbeService } from './services/shelly-v1-probe.service';
import { ShellyV1Service } from './services/shelly-v1.service';
import { DeviceEntitySubscriber } from './subscribers/device-entity.subscriber';

@ApiTag({
	tagName: DEVICES_SHELLY_V1_PLUGIN_NAME,
	displayName: DEVICES_SHELLY_V1_PLUGIN_API_TAG_NAME,
	description: DEVICES_SHELLY_V1_PLUGIN_API_TAG_DESCRIPTION,
})
@Module({
	imports: [
		NestConfigModule,
		TypeOrmModule.forFeature([ShellyV1DeviceEntity, ShellyV1ChannelEntity, ShellyV1ChannelPropertyEntity]),
		DevicesModule,
		ConfigModule,
		SwaggerModule,
		ExtensionsModule,
	],
	providers: [
		ShelliesAdapterService,
		DeviceMapperService,
		ShellyV1HttpClientService,
		ShellyV1ProbeService,
		ShellyV1DevicePlatform,
		ShellyV1Service,
		DeviceEntitySubscriber,
	],
	controllers: [ShellyV1DevicesController],
})
export class DevicesShellyV1Plugin {
	constructor(
		private readonly configService: NestConfigService,
		private readonly configMapper: PluginsTypeMapperService,
		private readonly shellyV1Service: ShellyV1Service,
		private readonly devicesMapper: DevicesTypeMapperService,
		private readonly channelsMapper: ChannelsTypeMapperService,
		private readonly channelsPropertiesMapper: ChannelsPropertiesTypeMapperService,
		private readonly shellyV1DevicePlatform: ShellyV1DevicePlatform,
		private readonly platformRegistryService: PlatformRegistryService,
		private readonly swaggerRegistry: SwaggerModelsRegistryService,
		private readonly discriminatorRegistry: ExtendedDiscriminatorService,
		private readonly extensionsService: ExtensionsService,
	) {}

	onModuleInit() {
		this.configMapper.registerMapping<ShellyV1ConfigModel, ShellyV1UpdatePluginConfigDto>({
			type: DEVICES_SHELLY_V1_PLUGIN_NAME,
			class: ShellyV1ConfigModel,
			configDto: ShellyV1UpdatePluginConfigDto,
		});

		this.devicesMapper.registerMapping<ShellyV1DeviceEntity, CreateShellyV1DeviceDto, UpdateShellyV1DeviceDto>({
			type: DEVICES_SHELLY_V1_TYPE,
			createDto: CreateShellyV1DeviceDto,
			updateDto: UpdateShellyV1DeviceDto,
			class: ShellyV1DeviceEntity,
		});

		this.channelsMapper.registerMapping<ShellyV1ChannelEntity, CreateShellyV1ChannelDto, UpdateShellyV1ChannelDto>({
			type: DEVICES_SHELLY_V1_TYPE,
			createDto: CreateShellyV1ChannelDto,
			updateDto: UpdateShellyV1ChannelDto,
			class: ShellyV1ChannelEntity,
		});

		this.channelsPropertiesMapper.registerMapping<
			ShellyV1ChannelPropertyEntity,
			CreateShellyV1ChannelPropertyDto,
			UpdateShellyV1ChannelPropertyDto
		>({
			type: DEVICES_SHELLY_V1_TYPE,
			createDto: CreateShellyV1ChannelPropertyDto,
			updateDto: UpdateShellyV1ChannelPropertyDto,
			class: ShellyV1ChannelPropertyEntity,
		});

		this.platformRegistryService.register(this.shellyV1DevicePlatform);

		for (const model of DEVICES_SHELLY_V1_PLUGIN_SWAGGER_EXTRA_MODELS) {
			this.swaggerRegistry.register(model);
		}

		this.discriminatorRegistry.register({
			parentClass: DeviceEntity,
			discriminatorProperty: 'type',
			discriminatorValue: DEVICES_SHELLY_V1_TYPE,
			modelClass: ShellyV1DeviceEntity,
		});

		this.discriminatorRegistry.register({
			parentClass: CreateDeviceDto,
			discriminatorProperty: 'type',
			discriminatorValue: DEVICES_SHELLY_V1_TYPE,
			modelClass: CreateShellyV1DeviceDto,
		});

		this.discriminatorRegistry.register({
			parentClass: UpdateDeviceDto,
			discriminatorProperty: 'type',
			discriminatorValue: DEVICES_SHELLY_V1_TYPE,
			modelClass: UpdateShellyV1DeviceDto,
		});

		this.discriminatorRegistry.register({
			parentClass: ChannelEntity,
			discriminatorProperty: 'type',
			discriminatorValue: DEVICES_SHELLY_V1_TYPE,
			modelClass: ShellyV1ChannelEntity,
		});

		this.discriminatorRegistry.register({
			parentClass: CreateChannelDto,
			discriminatorProperty: 'type',
			discriminatorValue: DEVICES_SHELLY_V1_TYPE,
			modelClass: CreateShellyV1ChannelDto,
		});

		this.discriminatorRegistry.register({
			parentClass: UpdateChannelDto,
			discriminatorProperty: 'type',
			discriminatorValue: DEVICES_SHELLY_V1_TYPE,
			modelClass: UpdateShellyV1ChannelDto,
		});

		this.discriminatorRegistry.register({
			parentClass: ChannelPropertyEntity,
			discriminatorProperty: 'type',
			discriminatorValue: DEVICES_SHELLY_V1_TYPE,
			modelClass: ShellyV1ChannelPropertyEntity,
		});

		this.discriminatorRegistry.register({
			parentClass: CreateChannelPropertyDto,
			discriminatorProperty: 'type',
			discriminatorValue: DEVICES_SHELLY_V1_TYPE,
			modelClass: CreateShellyV1ChannelPropertyDto,
		});

		this.discriminatorRegistry.register({
			parentClass: UpdateChannelPropertyDto,
			discriminatorProperty: 'type',
			discriminatorValue: DEVICES_SHELLY_V1_TYPE,
			modelClass: UpdateShellyV1ChannelPropertyDto,
		});

		this.extensionsService.registerPluginMetadata({
			type: DEVICES_SHELLY_V1_PLUGIN_NAME,
			name: 'Shelly V1 Devices',
			description: 'Support for Shelly first-generation devices',
			author: 'FastyBird',
			readme: `# Shelly V1 Devices Plugin

Integration plugin for Shelly first-generation (Gen1) devices.

## Features

- **Auto-Discovery** - Discovers Shelly Gen1 devices via mDNS/CoAP
- **Device Control** - Control relays, dimmers, and roller shutters
- **Status Monitoring** - Monitor power consumption, temperature, inputs
- **CoAP Protocol** - Efficient real-time updates via CoAP

## Supported Devices

- Shelly 1 / 1PM
- Shelly 2 / 2.5
- Shelly Dimmer / Dimmer 2
- Shelly EM / 3EM
- Shelly Plug / Plug S
- Shelly RGBW2
- Shelly Bulb / Duo
- And other Gen1 devices

## Communication

- **CoAP** - Real-time state updates (UDP port 5683)
- **HTTP API** - Device control and configuration
- **mDNS** - Device discovery

## Configuration

- Enable/disable automatic device discovery
- Configure polling intervals
- Set authentication credentials for protected devices`,
			links: {
				documentation: 'https://docs.fastybird.com',
				repository: 'https://github.com/FastyBird/smart-panel',
			},
		});
	}

	async onApplicationBootstrap() {
		const isCli = getEnvValue<string>(this.configService, 'FB_CLI', null) === 'on';

		if (!isCli) {
			await this.shellyV1Service.requestStart();
		}
	}

	async onModuleDestroy() {
		await this.shellyV1Service.stop();
	}
}
