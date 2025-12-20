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
import { PluginServiceManagerService } from '../../modules/extensions/services/plugin-service-manager.service';
import { ApiTag } from '../../modules/swagger/decorators/api-tag.decorator';
import { ExtendedDiscriminatorService } from '../../modules/swagger/services/extended-discriminator.service';
import { SwaggerModelsRegistryService } from '../../modules/swagger/services/swagger-models-registry.service';
import { SwaggerModule } from '../../modules/swagger/swagger.module';

import { ShellyNgDevicesController } from './controllers/shelly-ng-devices.controller';
import { DelegatesManagerService } from './delegates/delegates-manager.service';
import {
	DEVICES_SHELLY_NG_PLUGIN_API_TAG_DESCRIPTION,
	DEVICES_SHELLY_NG_PLUGIN_API_TAG_NAME,
	DEVICES_SHELLY_NG_PLUGIN_NAME,
	DEVICES_SHELLY_NG_TYPE,
} from './devices-shelly-ng.constants';
import { DEVICES_SHELLY_NG_PLUGIN_SWAGGER_EXTRA_MODELS } from './devices-shelly-ng.openapi';
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
import { DeviceManagerService } from './services/device-manager.service';
import { ShellyNgService } from './services/shelly-ng.service';
import { ShellyRpcClientService } from './services/shelly-rpc-client.service';
import { DeviceEntitySubscriber } from './subscribers/device-entity.subscriber';

@ApiTag({
	tagName: DEVICES_SHELLY_NG_PLUGIN_NAME,
	displayName: DEVICES_SHELLY_NG_PLUGIN_API_TAG_NAME,
	description: DEVICES_SHELLY_NG_PLUGIN_API_TAG_DESCRIPTION,
})
@Module({
	imports: [
		TypeOrmModule.forFeature([ShellyNgDeviceEntity, ShellyNgChannelEntity, ShellyNgChannelPropertyEntity]),
		DevicesModule,
		ConfigModule,
		SwaggerModule,
		ExtensionsModule,
	],
	providers: [
		ShellyRpcClientService,
		DatabaseDiscovererService,
		DelegatesManagerService,
		DeviceManagerService,
		ShellyNgService,
		ShellyNgDevicePlatform,
		DeviceEntitySubscriber,
	],
	controllers: [ShellyNgDevicesController],
})
export class DevicesShellyNgPlugin {
	constructor(
		private readonly configMapper: PluginsTypeMapperService,
		private readonly shellyNgService: ShellyNgService,
		private readonly devicesMapper: DevicesTypeMapperService,
		private readonly channelsMapper: ChannelsTypeMapperService,
		private readonly channelsPropertiesMapper: ChannelsPropertiesTypeMapperService,
		private readonly shellyNgDevicePlatform: ShellyNgDevicePlatform,
		private readonly platformRegistryService: PlatformRegistryService,
		private readonly swaggerRegistry: SwaggerModelsRegistryService,
		private readonly discriminatorRegistry: ExtendedDiscriminatorService,
		private readonly extensionsService: ExtensionsService,
		private readonly pluginServiceManager: PluginServiceManagerService,
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

		this.platformRegistryService.register(this.shellyNgDevicePlatform);

		for (const model of DEVICES_SHELLY_NG_PLUGIN_SWAGGER_EXTRA_MODELS) {
			this.swaggerRegistry.register(model);
		}

		this.discriminatorRegistry.register({
			parentClass: DeviceEntity,
			discriminatorProperty: 'type',
			discriminatorValue: DEVICES_SHELLY_NG_TYPE,
			modelClass: ShellyNgDeviceEntity,
		});

		this.discriminatorRegistry.register({
			parentClass: CreateDeviceDto,
			discriminatorProperty: 'type',
			discriminatorValue: DEVICES_SHELLY_NG_TYPE,
			modelClass: CreateShellyNgDeviceDto,
		});

		this.discriminatorRegistry.register({
			parentClass: UpdateDeviceDto,
			discriminatorProperty: 'type',
			discriminatorValue: DEVICES_SHELLY_NG_TYPE,
			modelClass: UpdateShellyNgDeviceDto,
		});

		this.discriminatorRegistry.register({
			parentClass: ChannelEntity,
			discriminatorProperty: 'type',
			discriminatorValue: DEVICES_SHELLY_NG_TYPE,
			modelClass: ShellyNgChannelEntity,
		});

		this.discriminatorRegistry.register({
			parentClass: CreateChannelDto,
			discriminatorProperty: 'type',
			discriminatorValue: DEVICES_SHELLY_NG_TYPE,
			modelClass: CreateShellyNgChannelDto,
		});

		this.discriminatorRegistry.register({
			parentClass: UpdateChannelDto,
			discriminatorProperty: 'type',
			discriminatorValue: DEVICES_SHELLY_NG_TYPE,
			modelClass: UpdateShellyNgChannelDto,
		});

		this.discriminatorRegistry.register({
			parentClass: ChannelPropertyEntity,
			discriminatorProperty: 'type',
			discriminatorValue: DEVICES_SHELLY_NG_TYPE,
			modelClass: ShellyNgChannelPropertyEntity,
		});

		this.discriminatorRegistry.register({
			parentClass: CreateChannelPropertyDto,
			discriminatorProperty: 'type',
			discriminatorValue: DEVICES_SHELLY_NG_TYPE,
			modelClass: CreateShellyNgChannelPropertyDto,
		});

		this.discriminatorRegistry.register({
			parentClass: UpdateChannelPropertyDto,
			discriminatorProperty: 'type',
			discriminatorValue: DEVICES_SHELLY_NG_TYPE,
			modelClass: UpdateShellyNgChannelPropertyDto,
		});

		// Register plugin metadata for extension discovery
		this.extensionsService.registerPluginMetadata({
			type: DEVICES_SHELLY_NG_PLUGIN_NAME,
			name: 'Shelly NG Devices',
			description: 'Support for Shelly next-generation devices',
			author: 'FastyBird',
			readme: `# Shelly NG Devices Plugin

Integration plugin for Shelly next-generation (Gen2+) devices.

## Features

- **Auto-Discovery** - Automatically discovers Shelly NG devices on the local network
- **Real-time Updates** - WebSocket-based state synchronization
- **Device Control** - Control relays, lights, and other outputs
- **Sensor Monitoring** - Read temperature, humidity, power consumption, etc.

## Supported Devices

- Shelly Plus series (Plus 1, Plus 2PM, Plus Plug, etc.)
- Shelly Pro series (Pro 1, Pro 2, Pro 4PM, etc.)
- Shelly Mini series
- Other Gen2+ devices with RPC API

## Communication

Uses Shelly's RPC (Remote Procedure Call) API over:
- HTTP for device configuration and control
- WebSocket for real-time state updates
- mDNS for device discovery

## Configuration

- **Polling Interval** - How often to refresh device states
- **Discovery** - Enable/disable automatic device discovery`,
			links: {
				documentation: 'https://smart-panel.fastybird.com/docs',
				repository: 'https://github.com/FastyBird/smart-panel',
			},
		});

		// Register service with the centralized plugin service manager
		// The manager handles startup, shutdown, and config-based enable/disable
		this.pluginServiceManager.register(this.shellyNgService);
	}
}
