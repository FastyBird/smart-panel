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

import { ZigbeeHerdsmanDiscoveredDevicesController } from './controllers/zigbee-herdsman-discovered-devices.controller';
import {
	DEVICES_ZIGBEE_HERDSMAN_API_TAG_DESCRIPTION,
	DEVICES_ZIGBEE_HERDSMAN_API_TAG_NAME,
	DEVICES_ZIGBEE_HERDSMAN_PLUGIN_NAME,
	DEVICES_ZIGBEE_HERDSMAN_TYPE,
} from './devices-zigbee-herdsman.constants';
import { DEVICES_ZIGBEE_HERDSMAN_PLUGIN_SWAGGER_EXTRA_MODELS } from './devices-zigbee-herdsman.openapi';
import { CreateZigbeeHerdsmanChannelPropertyDto } from './dto/create-channel-property.dto';
import { CreateZigbeeHerdsmanChannelDto } from './dto/create-channel.dto';
import { CreateZigbeeHerdsmanDeviceDto } from './dto/create-device.dto';
import { UpdateZigbeeHerdsmanChannelPropertyDto } from './dto/update-channel-property.dto';
import { UpdateZigbeeHerdsmanChannelDto } from './dto/update-channel.dto';
import { ZigbeeHerdsmanUpdatePluginConfigDto } from './dto/update-config.dto';
import { UpdateZigbeeHerdsmanDeviceDto } from './dto/update-device.dto';
import {
	ZigbeeHerdsmanChannelEntity,
	ZigbeeHerdsmanChannelPropertyEntity,
	ZigbeeHerdsmanDeviceEntity,
} from './entities/devices-zigbee-herdsman.entity';
import { ZigbeeHerdsmanConfigModel } from './models/config.model';
import { ZigbeeHerdsmanDevicePlatform } from './platforms/zigbee-herdsman.device.platform';
import { ZhDeviceAdoptionService } from './services/device-adoption.service';
import { ZhDeviceConnectivityService } from './services/device-connectivity.service';
import { ZhMappingPreviewService } from './services/mapping-preview.service';
import { ZigbeeHerdsmanAdapterService } from './services/zigbee-herdsman-adapter.service';
import { ZigbeeHerdsmanConfigValidatorService } from './services/zigbee-herdsman-config-validator.service';
import { ZigbeeHerdsmanService } from './services/zigbee-herdsman.service';

@ApiTag({
	tagName: DEVICES_ZIGBEE_HERDSMAN_PLUGIN_NAME,
	displayName: DEVICES_ZIGBEE_HERDSMAN_API_TAG_NAME,
	description: DEVICES_ZIGBEE_HERDSMAN_API_TAG_DESCRIPTION,
})
@Module({
	imports: [
		TypeOrmModule.forFeature([
			ZigbeeHerdsmanDeviceEntity,
			ZigbeeHerdsmanChannelEntity,
			ZigbeeHerdsmanChannelPropertyEntity,
		]),
		DevicesModule,
		ConfigModule,
		SwaggerModule,
		ExtensionsModule,
	],
	providers: [
		// Core services
		ZigbeeHerdsmanConfigValidatorService,
		ZigbeeHerdsmanAdapterService,
		ZhDeviceConnectivityService,
		ZhMappingPreviewService,
		ZhDeviceAdoptionService,
		ZigbeeHerdsmanDevicePlatform,
		ZigbeeHerdsmanService,
	],
	controllers: [ZigbeeHerdsmanDiscoveredDevicesController],
})
export class DevicesZigbeeHerdsmanPlugin {
	constructor(
		private readonly configMapper: PluginsTypeMapperService,
		private readonly zigbeeHerdsmanService: ZigbeeHerdsmanService,
		private readonly devicesMapper: DevicesTypeMapperService,
		private readonly channelsMapper: ChannelsTypeMapperService,
		private readonly channelsPropertiesMapper: ChannelsPropertiesTypeMapperService,
		private readonly zigbeeHerdsmanDevicePlatform: ZigbeeHerdsmanDevicePlatform,
		private readonly platformRegistryService: PlatformRegistryService,
		private readonly swaggerRegistry: SwaggerModelsRegistryService,
		private readonly discriminatorRegistry: ExtendedDiscriminatorService,
		private readonly extensionsService: ExtensionsService,
		private readonly pluginServiceManager: PluginServiceManagerService,
	) {}

	onModuleInit() {
		// Register plugin config mapper
		this.configMapper.registerMapping<ZigbeeHerdsmanConfigModel, ZigbeeHerdsmanUpdatePluginConfigDto>({
			type: DEVICES_ZIGBEE_HERDSMAN_PLUGIN_NAME,
			class: ZigbeeHerdsmanConfigModel,
			configDto: ZigbeeHerdsmanUpdatePluginConfigDto,
		});

		// Register device type mapper
		this.devicesMapper.registerMapping<
			ZigbeeHerdsmanDeviceEntity,
			CreateZigbeeHerdsmanDeviceDto,
			UpdateZigbeeHerdsmanDeviceDto
		>({
			type: DEVICES_ZIGBEE_HERDSMAN_TYPE,
			createDto: CreateZigbeeHerdsmanDeviceDto,
			updateDto: UpdateZigbeeHerdsmanDeviceDto,
			class: ZigbeeHerdsmanDeviceEntity,
		});

		// Register channel type mapper
		this.channelsMapper.registerMapping<
			ZigbeeHerdsmanChannelEntity,
			CreateZigbeeHerdsmanChannelDto,
			UpdateZigbeeHerdsmanChannelDto
		>({
			type: DEVICES_ZIGBEE_HERDSMAN_TYPE,
			createDto: CreateZigbeeHerdsmanChannelDto,
			updateDto: UpdateZigbeeHerdsmanChannelDto,
			class: ZigbeeHerdsmanChannelEntity,
		});

		// Register channel property type mapper
		this.channelsPropertiesMapper.registerMapping<
			ZigbeeHerdsmanChannelPropertyEntity,
			CreateZigbeeHerdsmanChannelPropertyDto,
			UpdateZigbeeHerdsmanChannelPropertyDto
		>({
			type: DEVICES_ZIGBEE_HERDSMAN_TYPE,
			createDto: CreateZigbeeHerdsmanChannelPropertyDto,
			updateDto: UpdateZigbeeHerdsmanChannelPropertyDto,
			class: ZigbeeHerdsmanChannelPropertyEntity,
		});

		// Register device platform
		this.platformRegistryService.register(this.zigbeeHerdsmanDevicePlatform);

		// Register Swagger models
		for (const model of DEVICES_ZIGBEE_HERDSMAN_PLUGIN_SWAGGER_EXTRA_MODELS) {
			this.swaggerRegistry.register(model);
		}

		// Register discriminators for polymorphic serialization
		this.discriminatorRegistry.register({
			parentClass: DeviceEntity,
			discriminatorProperty: 'type',
			discriminatorValue: DEVICES_ZIGBEE_HERDSMAN_TYPE,
			modelClass: ZigbeeHerdsmanDeviceEntity,
		});
		this.discriminatorRegistry.register({
			parentClass: CreateDeviceDto,
			discriminatorProperty: 'type',
			discriminatorValue: DEVICES_ZIGBEE_HERDSMAN_TYPE,
			modelClass: CreateZigbeeHerdsmanDeviceDto,
		});
		this.discriminatorRegistry.register({
			parentClass: UpdateDeviceDto,
			discriminatorProperty: 'type',
			discriminatorValue: DEVICES_ZIGBEE_HERDSMAN_TYPE,
			modelClass: UpdateZigbeeHerdsmanDeviceDto,
		});
		this.discriminatorRegistry.register({
			parentClass: ChannelEntity,
			discriminatorProperty: 'type',
			discriminatorValue: DEVICES_ZIGBEE_HERDSMAN_TYPE,
			modelClass: ZigbeeHerdsmanChannelEntity,
		});
		this.discriminatorRegistry.register({
			parentClass: CreateChannelDto,
			discriminatorProperty: 'type',
			discriminatorValue: DEVICES_ZIGBEE_HERDSMAN_TYPE,
			modelClass: CreateZigbeeHerdsmanChannelDto,
		});
		this.discriminatorRegistry.register({
			parentClass: UpdateChannelDto,
			discriminatorProperty: 'type',
			discriminatorValue: DEVICES_ZIGBEE_HERDSMAN_TYPE,
			modelClass: UpdateZigbeeHerdsmanChannelDto,
		});
		this.discriminatorRegistry.register({
			parentClass: ChannelPropertyEntity,
			discriminatorProperty: 'type',
			discriminatorValue: DEVICES_ZIGBEE_HERDSMAN_TYPE,
			modelClass: ZigbeeHerdsmanChannelPropertyEntity,
		});
		this.discriminatorRegistry.register({
			parentClass: CreateChannelPropertyDto,
			discriminatorProperty: 'type',
			discriminatorValue: DEVICES_ZIGBEE_HERDSMAN_TYPE,
			modelClass: CreateZigbeeHerdsmanChannelPropertyDto,
		});
		this.discriminatorRegistry.register({
			parentClass: UpdateChannelPropertyDto,
			discriminatorProperty: 'type',
			discriminatorValue: DEVICES_ZIGBEE_HERDSMAN_TYPE,
			modelClass: UpdateZigbeeHerdsmanChannelPropertyDto,
		});

		// Register plugin metadata
		this.extensionsService.registerPluginMetadata({
			type: DEVICES_ZIGBEE_HERDSMAN_PLUGIN_NAME,
			name: 'Zigbee Herdsman Devices',
			description: 'Direct Zigbee device integration via zigbee-herdsman',
			author: 'FastyBird',
			readme: `# Zigbee Herdsman Plugin

Self-contained Zigbee device integration using the zigbee-herdsman library. Communicates directly with Zigbee coordinators — USB dongles and network-attached adapters (SLZB-06/07).

## Features

- **Direct Communication** - Talks to the Zigbee coordinator via USB serial or TCP
- **Self-Contained** - No external dependencies or middleware required
- **3000+ Device Support** - Uses zigbee-herdsman-converters for device definitions
- **Network Management** - Configure channel, PAN ID, network key
- **Device Pairing** - Permit join with timeout for secure pairing
- **Real-time Updates** - Receives ZCL attribute reports directly
- **Bidirectional Control** - Send commands via toZigbee converters

## Supported Coordinators

- Texas Instruments CC2652 (ZBDongle-P, Slaesh's, etc.)
- Silicon Labs EFR32/Ember (ZBDongle-E, SkyConnect, etc.)
- ConBee II / ConBee III (deConz adapter)
- ZiGate
- Network adapters: SLZB-06, SLZB-07, ser2net (via tcp://host:port)

## Requirements

- USB Zigbee coordinator or network-attached adapter
- Serial port or TCP access (the coordinator is exclusively locked)

## Configuration

- **Coordinator Path** - USB path (e.g., /dev/ttyUSB0) or TCP address (e.g., tcp://192.168.1.100:6638)
- **Baud Rate** - Serial baud rate (default: 115200)
- **Adapter Type** - auto, zstack, ember, deconz, or zigate
- **Channel** - Zigbee channel (11-26, recommended: 11, 15, 20, 25)
- **Network Settings** - PAN ID and network key (auto-generated on first start)`,
			links: {
				documentation: 'https://smart-panel.fastybird.com/docs',
				repository: 'https://github.com/FastyBird/smart-panel',
			},
		});

		// Register service with plugin manager
		this.pluginServiceManager.register(this.zigbeeHerdsmanService);
	}
}
