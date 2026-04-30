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
import { Zigbee2mqttWizardController } from './controllers/zigbee2mqtt-wizard.controller';
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
import { Z2mWizardService } from './services/wizard.service';
import { Z2mWsClientAdapterService } from './services/ws-client-adapter.service';
import { Zigbee2mqttConfigValidatorService } from './services/zigbee2mqtt-config-validator.service';
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
		Zigbee2mqttConfigValidatorService,
		Z2mMqttClientAdapterService,
		Z2mWsClientAdapterService,
		Z2mExposesMapperService,
		Z2mDeviceMapperService,
		Z2mVirtualPropertyService,
		Z2mMappingPreviewService,
		Z2mDeviceAdoptionService,
		Z2mWizardService,
		Zigbee2mqttDevicePlatform,
		Zigbee2mqttService,
	],
	controllers: [Zigbee2mqttDiscoveredDevicesController, Zigbee2mqttWizardController],
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
			name: 'Zigbee2MQTT',
			description: 'Integration plugin for Zigbee devices via Zigbee2MQTT',
			author: 'FastyBird',
			readme: `# Zigbee2MQTT

> Plugin · by FastyBird · platform: devices

Integration for Zigbee devices via a [Zigbee2MQTT](https://www.zigbee2mqtt.io) bridge. Connects either through an MQTT broker or directly to the Zigbee2MQTT frontend over WebSocket, then automatically maps Z2M *exposes* to Smart Panel channels and properties so a freshly-paired bulb appears on your dashboard with no manual mapping.

## What you get

- A path to use any Zigbee device that Zigbee2MQTT supports — thousands of models across hundreds of vendors
- Two transport options so the plugin fits both setups: a shared MQTT broker (typical Z2M install) or a direct WebSocket to the Z2M frontend (no broker needed)
- Auto-mapping: most devices come up correctly out of the box because the plugin reads Z2M's *exposes* and maps them to standard Smart Panel property roles
- A safety net: when a device exposes something unusual you can add a YAML override without touching code

## Features

- **Dual transport** — MQTT broker or direct WebSocket to Zigbee2MQTT
- **Automatic discovery** — devices and their capabilities are pulled from the bridge on connect; new devices show up in the discovery feed in real time
- **Dynamic mapping** — Z2M exposes are mapped to Smart Panel properties using a default rule set that covers lights, switches, sensors, climate, covers, locks
- **Real-time updates** — state changes are streamed via MQTT or WS as they happen, no polling
- **Bidirectional control** — commands from Smart Panel are translated back to Z2M's expected payload (turning a switch, setting brightness / colour / temperature, …)
- **Custom YAML mappings** — drop a YAML file in the data dir to override defaults, add transformers, or model exotic devices
- **Configurable auto-adopt** — choose whether newly-discovered devices appear adopted automatically or wait for explicit confirmation

## Supported Devices

Any device supported by Zigbee2MQTT — smart lights (dimmable, CCT, RGB), switches and relays, sensors (temperature, humidity, motion, contact, …), thermostats, covers and locks.

## Configuration

| Option | Description | Default |
|--------|-------------|---------|
| \`connection_type\` | \`mqtt\` (via broker) or \`ws\` (direct WebSocket) | \`mqtt\` |
| \`mqtt.host\` | MQTT broker host (MQTT mode) | — |
| \`mqtt.port\` | MQTT broker port (MQTT mode) | \`1883\` |
| \`mqtt.tls\` | TLS / SSL options (MQTT mode) | disabled |
| \`websocket.host\` | Zigbee2MQTT frontend host (WS mode) | — |
| \`websocket.port\` | Zigbee2MQTT frontend port (WS mode) | \`8080\` |
| \`base_topic\` | Zigbee2MQTT base topic | \`zigbee2mqtt\` |
| \`discovery.auto_add\` | Auto-adopt newly discovered devices | \`true\` |

## Custom Mappings

Drop YAML files into \`var/data/\` with the prefix \`plugin.devices-zigbee2mqtt.\` (e.g. \`plugin.devices-zigbee2mqtt.my-sensors.yaml\`) or set \`ZIGBEE_MAPPINGS_PATH\` to a custom directory.

### Example — sensor property

\`\`\`yaml
version: "1.0"

mappings:
  - name: cpu_temperature_sensor
    priority: 100
    match:
      expose_type: numeric
      property: cpu_temperature
    device_category: SENSOR
    channels:
      - identifier: device_temperature
        name: Device Temperature
        category: TEMPERATURE
        properties:
          - z2m_property: cpu_temperature
            direction: read_only
            panel:
              identifier: TEMPERATURE
              data_type: FLOAT
              unit: "°C"
              settable: false
\`\`\`

### Example — custom transformer

\`\`\`yaml
version: "1.0"

transformers:
  brightness_1000:
    type: scale
    input_range: [0, 1000]
    output_range: [0, 100]

mappings:
  - name: custom_light
    priority: 200
    match:
      expose_type: light
      any_property: [custom_feature]
    device_category: LIGHTING
    channels:
      - identifier: light
        category: LIGHT
        features:
          - z2m_feature: brightness
            panel:
              identifier: BRIGHTNESS
              data_type: UCHAR
              format: [0, 100]
            transformer: brightness_1000
\`\`\`

**Match keys:** \`expose_type\` (\`light\`/\`switch\`/\`numeric\`/\`binary\`/\`enum\`/\`climate\`/\`cover\`/\`fan\`/\`lock\`), \`property\`, \`has_features\`, \`any_property\`, \`is_list\`.

**Transformer types:** \`scale\`, \`map\`, \`boolean\`, \`formula\`.`,
			links: {
				documentation: 'https://smart-panel.fastybird.com/docs',
				repository: 'https://github.com/FastyBird/smart-panel',
			},
		});

		// Register service with the centralized plugin service manager
		this.pluginServiceManager.register(this.zigbee2mqttService);
	}
}
