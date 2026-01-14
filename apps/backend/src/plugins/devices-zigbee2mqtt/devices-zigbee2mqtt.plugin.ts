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

import { Zigbee2mqttDiscoveredDevicesController } from './controllers/zigbee2mqtt-discovered-devices.controller';
import {
	DEVICES_ZIGBEE2MQTT_API_TAG_DESCRIPTION,
	DEVICES_ZIGBEE2MQTT_API_TAG_NAME,
	DEVICES_ZIGBEE2MQTT_PLUGIN_NAME,
	DEVICES_ZIGBEE2MQTT_TYPE,
} from './devices-zigbee2mqtt.constants';
import { DEVICES_ZIGBEE2MQTT_PLUGIN_SWAGGER_EXTRA_MODELS } from './devices-zigbee2mqtt.openapi';
import { CreateZigbee2mqttChannelPropertyDto } from './dto/create-channel-property.dto';
import { CreateZigbee2mqttChannelDto } from './dto/create-channel.dto';
import { CreateZigbee2mqttDeviceDto } from './dto/create-device.dto';
import { UpdateZigbee2mqttChannelPropertyDto } from './dto/update-channel-property.dto';
import { UpdateZigbee2mqttChannelDto } from './dto/update-channel.dto';
import { Zigbee2mqttUpdatePluginConfigDto } from './dto/update-config.dto';
import { UpdateZigbee2mqttDeviceDto } from './dto/update-device.dto';
import {
	Zigbee2mqttChannelEntity,
	Zigbee2mqttChannelPropertyEntity,
	Zigbee2mqttDeviceEntity,
} from './entities/devices-zigbee2mqtt.entity';
import { ConfigDrivenConverter } from './mappings/config-driven.converter';
import { MappingLoaderService } from './mappings/mapping-loader.service';
import { TransformerRegistry } from './mappings/transformers';
import { Zigbee2mqttConfigModel } from './models/config.model';
import { Zigbee2mqttDevicePlatform } from './platforms/zigbee2mqtt.device.platform';
import { Z2mDeviceAdoptionService } from './services/device-adoption.service';
import { Z2mDeviceMapperService } from './services/device-mapper.service';
import { Z2mExposesMapperService } from './services/exposes-mapper.service';
import { Z2mMappingPreviewService } from './services/mapping-preview.service';
import { Z2mMqttClientAdapterService } from './services/mqtt-client-adapter.service';
import { Z2mVirtualPropertyService } from './services/virtual-property.service';
import { Zigbee2mqttService } from './services/zigbee2mqtt.service';

@ApiTag({
	tagName: DEVICES_ZIGBEE2MQTT_PLUGIN_NAME,
	displayName: DEVICES_ZIGBEE2MQTT_API_TAG_NAME,
	description: DEVICES_ZIGBEE2MQTT_API_TAG_DESCRIPTION,
})
@Module({
	imports: [
		TypeOrmModule.forFeature([Zigbee2mqttDeviceEntity, Zigbee2mqttChannelEntity, Zigbee2mqttChannelPropertyEntity]),
		DevicesModule,
		ConfigModule,
		SwaggerModule,
		ExtensionsModule,
	],
	providers: [
		// Dynamic mapping configuration services
		TransformerRegistry,
		MappingLoaderService,
		ConfigDrivenConverter,
		// Core services
		Z2mMqttClientAdapterService,
		Z2mExposesMapperService,
		Z2mDeviceMapperService,
		Z2mVirtualPropertyService,
		Z2mMappingPreviewService,
		Z2mDeviceAdoptionService,
		Zigbee2mqttDevicePlatform,
		Zigbee2mqttService,
	],
	controllers: [Zigbee2mqttDiscoveredDevicesController],
})
export class DevicesZigbee2mqttPlugin {
	constructor(
		private readonly configMapper: PluginsTypeMapperService,
		private readonly zigbee2mqttService: Zigbee2mqttService,
		private readonly devicesMapper: DevicesTypeMapperService,
		private readonly channelsMapper: ChannelsTypeMapperService,
		private readonly channelsPropertiesMapper: ChannelsPropertiesTypeMapperService,
		private readonly zigbee2mqttDevicePlatform: Zigbee2mqttDevicePlatform,
		private readonly platformRegistryService: PlatformRegistryService,
		private readonly swaggerRegistry: SwaggerModelsRegistryService,
		private readonly discriminatorRegistry: ExtendedDiscriminatorService,
		private readonly extensionsService: ExtensionsService,
		private readonly pluginServiceManager: PluginServiceManagerService,
	) {}

	onModuleInit() {
		// Register plugin config mapper
		this.configMapper.registerMapping<Zigbee2mqttConfigModel, Zigbee2mqttUpdatePluginConfigDto>({
			type: DEVICES_ZIGBEE2MQTT_PLUGIN_NAME,
			class: Zigbee2mqttConfigModel,
			configDto: Zigbee2mqttUpdatePluginConfigDto,
		});

		// Register device type mapper
		this.devicesMapper.registerMapping<Zigbee2mqttDeviceEntity, CreateZigbee2mqttDeviceDto, UpdateZigbee2mqttDeviceDto>(
			{
				type: DEVICES_ZIGBEE2MQTT_TYPE,
				createDto: CreateZigbee2mqttDeviceDto,
				updateDto: UpdateZigbee2mqttDeviceDto,
				class: Zigbee2mqttDeviceEntity,
			},
		);

		// Register channel type mapper
		this.channelsMapper.registerMapping<
			Zigbee2mqttChannelEntity,
			CreateZigbee2mqttChannelDto,
			UpdateZigbee2mqttChannelDto
		>({
			type: DEVICES_ZIGBEE2MQTT_TYPE,
			createDto: CreateZigbee2mqttChannelDto,
			updateDto: UpdateZigbee2mqttChannelDto,
			class: Zigbee2mqttChannelEntity,
		});

		// Register channel property type mapper
		this.channelsPropertiesMapper.registerMapping<
			Zigbee2mqttChannelPropertyEntity,
			CreateZigbee2mqttChannelPropertyDto,
			UpdateZigbee2mqttChannelPropertyDto
		>({
			type: DEVICES_ZIGBEE2MQTT_TYPE,
			createDto: CreateZigbee2mqttChannelPropertyDto,
			updateDto: UpdateZigbee2mqttChannelPropertyDto,
			class: Zigbee2mqttChannelPropertyEntity,
		});

		// Register device platform
		this.platformRegistryService.register(this.zigbee2mqttDevicePlatform);

		// Register Swagger models
		for (const model of DEVICES_ZIGBEE2MQTT_PLUGIN_SWAGGER_EXTRA_MODELS) {
			this.swaggerRegistry.register(model);
		}

		// Register discriminators for polymorphic serialization
		this.discriminatorRegistry.register({
			parentClass: DeviceEntity,
			discriminatorProperty: 'type',
			discriminatorValue: DEVICES_ZIGBEE2MQTT_TYPE,
			modelClass: Zigbee2mqttDeviceEntity,
		});

		this.discriminatorRegistry.register({
			parentClass: CreateDeviceDto,
			discriminatorProperty: 'type',
			discriminatorValue: DEVICES_ZIGBEE2MQTT_TYPE,
			modelClass: CreateZigbee2mqttDeviceDto,
		});

		this.discriminatorRegistry.register({
			parentClass: UpdateDeviceDto,
			discriminatorProperty: 'type',
			discriminatorValue: DEVICES_ZIGBEE2MQTT_TYPE,
			modelClass: UpdateZigbee2mqttDeviceDto,
		});

		this.discriminatorRegistry.register({
			parentClass: ChannelEntity,
			discriminatorProperty: 'type',
			discriminatorValue: DEVICES_ZIGBEE2MQTT_TYPE,
			modelClass: Zigbee2mqttChannelEntity,
		});

		this.discriminatorRegistry.register({
			parentClass: CreateChannelDto,
			discriminatorProperty: 'type',
			discriminatorValue: DEVICES_ZIGBEE2MQTT_TYPE,
			modelClass: CreateZigbee2mqttChannelDto,
		});

		this.discriminatorRegistry.register({
			parentClass: UpdateChannelDto,
			discriminatorProperty: 'type',
			discriminatorValue: DEVICES_ZIGBEE2MQTT_TYPE,
			modelClass: UpdateZigbee2mqttChannelDto,
		});

		this.discriminatorRegistry.register({
			parentClass: ChannelPropertyEntity,
			discriminatorProperty: 'type',
			discriminatorValue: DEVICES_ZIGBEE2MQTT_TYPE,
			modelClass: Zigbee2mqttChannelPropertyEntity,
		});

		this.discriminatorRegistry.register({
			parentClass: CreateChannelPropertyDto,
			discriminatorProperty: 'type',
			discriminatorValue: DEVICES_ZIGBEE2MQTT_TYPE,
			modelClass: CreateZigbee2mqttChannelPropertyDto,
		});

		this.discriminatorRegistry.register({
			parentClass: UpdateChannelPropertyDto,
			discriminatorProperty: 'type',
			discriminatorValue: DEVICES_ZIGBEE2MQTT_TYPE,
			modelClass: UpdateZigbee2mqttChannelPropertyDto,
		});

		// Register plugin metadata for extension discovery
		this.extensionsService.registerPluginMetadata({
			type: DEVICES_ZIGBEE2MQTT_PLUGIN_NAME,
			name: 'Zigbee2MQTT Devices',
			description: 'Integration plugin for Zigbee devices via Zigbee2MQTT',
			author: 'FastyBird',
			readme: `# Zigbee2MQTT Plugin

Integration plugin for Zigbee devices through Zigbee2MQTT bridge.

## Features

- **MQTT-Based Communication** - Connects to Zigbee2MQTT via MQTT broker
- **Automatic Device Discovery** - Discovers and maps devices from Zigbee2MQTT bridge
- **Dynamic Capability Mapping** - Automatically maps Z2M exposes to Smart Panel properties
- **Real-time State Updates** - Receives state changes via MQTT subscriptions
- **Bidirectional Control** - Send commands to devices via MQTT
- **User-Extensible Mappings** - Define custom device mappings via YAML configuration

## Supported Devices

Supports all Zigbee devices compatible with Zigbee2MQTT, including:
- Smart lights (dimmable, color, color temperature)
- Switches and relays
- Sensors (temperature, humidity, motion, door/window, etc.)
- Thermostats and climate controls
- Covers and blinds
- Locks
- Remotes and buttons

## Custom Device Mappings

You can add custom device mappings by creating YAML files in:
~/.smart-panel/zigbee/mappings/

See the built-in mapping files for examples.

## Requirements

- Running Zigbee2MQTT instance
- MQTT broker (Mosquitto, etc.)
- Network connectivity to MQTT broker

## Configuration

- **MQTT Host** - MQTT broker hostname or IP
- **MQTT Port** - MQTT broker port (default: 1883)
- **Base Topic** - Zigbee2MQTT base topic (default: zigbee2mqtt)
- **TLS** - Optional TLS/SSL configuration
- **Discovery** - Auto-add devices and sync on startup options`,
			links: {
				documentation: 'https://smart-panel.fastybird.com/docs',
				repository: 'https://github.com/FastyBird/smart-panel',
			},
		});

		// Register service with the centralized plugin service manager
		this.pluginServiceManager.register(this.zigbee2mqttService);
	}
}
