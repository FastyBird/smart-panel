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

import {
	DEVICES_RETERMINAL_API_TAG_DESCRIPTION,
	DEVICES_RETERMINAL_API_TAG_NAME,
	DEVICES_RETERMINAL_PLUGIN_NAME,
	DEVICES_RETERMINAL_TYPE,
} from './devices-reterminal.constants';
import { DEVICES_RETERMINAL_PLUGIN_SWAGGER_EXTRA_MODELS } from './devices-reterminal.openapi';
import { CreateReTerminalChannelPropertyDto } from './dto/create-channel-property.dto';
import { CreateReTerminalChannelDto } from './dto/create-channel.dto';
import { CreateReTerminalDeviceDto } from './dto/create-device.dto';
import { UpdateReTerminalChannelPropertyDto } from './dto/update-channel-property.dto';
import { UpdateReTerminalChannelDto } from './dto/update-channel.dto';
import { ReTerminalUpdatePluginConfigDto } from './dto/update-config.dto';
import { UpdateReTerminalDeviceDto } from './dto/update-device.dto';
import {
	ReTerminalChannelEntity,
	ReTerminalChannelPropertyEntity,
	ReTerminalDeviceEntity,
} from './entities/devices-reterminal.entity';
import { ReTerminalConfigModel } from './models/config.model';
import { ReTerminalDevicePlatform } from './platforms/reterminal.device.platform';
import { ReTerminalDeviceMapperService } from './services/device-mapper.service';
import { ReTerminalButtonService } from './services/reterminal-button.service';
import { ReTerminalSysfsService } from './services/reterminal-sysfs.service';
import { ReTerminalService } from './services/reterminal.service';

@ApiTag({
	tagName: DEVICES_RETERMINAL_PLUGIN_NAME,
	displayName: DEVICES_RETERMINAL_API_TAG_NAME,
	description: DEVICES_RETERMINAL_API_TAG_DESCRIPTION,
})
@Module({
	imports: [
		TypeOrmModule.forFeature([ReTerminalDeviceEntity, ReTerminalChannelEntity, ReTerminalChannelPropertyEntity]),
		DevicesModule,
		ConfigModule,
		SwaggerModule,
		ExtensionsModule,
	],
	providers: [
		ReTerminalSysfsService,
		ReTerminalButtonService,
		ReTerminalDeviceMapperService,
		ReTerminalDevicePlatform,
		ReTerminalService,
	],
})
export class DevicesReTerminalPlugin {
	constructor(
		private readonly configMapper: PluginsTypeMapperService,
		private readonly reTerminalService: ReTerminalService,
		private readonly devicesMapper: DevicesTypeMapperService,
		private readonly channelsMapper: ChannelsTypeMapperService,
		private readonly channelsPropertiesMapper: ChannelsPropertiesTypeMapperService,
		private readonly reTerminalDevicePlatform: ReTerminalDevicePlatform,
		private readonly platformRegistryService: PlatformRegistryService,
		private readonly swaggerRegistry: SwaggerModelsRegistryService,
		private readonly discriminatorRegistry: ExtendedDiscriminatorService,
		private readonly extensionsService: ExtensionsService,
		private readonly pluginServiceManager: PluginServiceManagerService,
	) {}

	onModuleInit() {
		// Register plugin config mapper
		this.configMapper.registerMapping<ReTerminalConfigModel, ReTerminalUpdatePluginConfigDto>({
			type: DEVICES_RETERMINAL_PLUGIN_NAME,
			class: ReTerminalConfigModel,
			configDto: ReTerminalUpdatePluginConfigDto,
		});

		// Register device type mapper
		this.devicesMapper.registerMapping<ReTerminalDeviceEntity, CreateReTerminalDeviceDto, UpdateReTerminalDeviceDto>({
			type: DEVICES_RETERMINAL_TYPE,
			createDto: CreateReTerminalDeviceDto,
			updateDto: UpdateReTerminalDeviceDto,
			class: ReTerminalDeviceEntity,
		});

		// Register channel type mapper
		this.channelsMapper.registerMapping<
			ReTerminalChannelEntity,
			CreateReTerminalChannelDto,
			UpdateReTerminalChannelDto
		>({
			type: DEVICES_RETERMINAL_TYPE,
			createDto: CreateReTerminalChannelDto,
			updateDto: UpdateReTerminalChannelDto,
			class: ReTerminalChannelEntity,
		});

		// Register channel property type mapper
		this.channelsPropertiesMapper.registerMapping<
			ReTerminalChannelPropertyEntity,
			CreateReTerminalChannelPropertyDto,
			UpdateReTerminalChannelPropertyDto
		>({
			type: DEVICES_RETERMINAL_TYPE,
			createDto: CreateReTerminalChannelPropertyDto,
			updateDto: UpdateReTerminalChannelPropertyDto,
			class: ReTerminalChannelPropertyEntity,
		});

		// Register device platform
		this.platformRegistryService.register(this.reTerminalDevicePlatform);

		// Register Swagger models
		for (const model of DEVICES_RETERMINAL_PLUGIN_SWAGGER_EXTRA_MODELS) {
			this.swaggerRegistry.register(model);
		}

		// Register discriminators for polymorphic serialization
		this.discriminatorRegistry.register({
			parentClass: DeviceEntity,
			discriminatorProperty: 'type',
			discriminatorValue: DEVICES_RETERMINAL_TYPE,
			modelClass: ReTerminalDeviceEntity,
		});

		this.discriminatorRegistry.register({
			parentClass: CreateDeviceDto,
			discriminatorProperty: 'type',
			discriminatorValue: DEVICES_RETERMINAL_TYPE,
			modelClass: CreateReTerminalDeviceDto,
		});

		this.discriminatorRegistry.register({
			parentClass: UpdateDeviceDto,
			discriminatorProperty: 'type',
			discriminatorValue: DEVICES_RETERMINAL_TYPE,
			modelClass: UpdateReTerminalDeviceDto,
		});

		this.discriminatorRegistry.register({
			parentClass: ChannelEntity,
			discriminatorProperty: 'type',
			discriminatorValue: DEVICES_RETERMINAL_TYPE,
			modelClass: ReTerminalChannelEntity,
		});

		this.discriminatorRegistry.register({
			parentClass: CreateChannelDto,
			discriminatorProperty: 'type',
			discriminatorValue: DEVICES_RETERMINAL_TYPE,
			modelClass: CreateReTerminalChannelDto,
		});

		this.discriminatorRegistry.register({
			parentClass: UpdateChannelDto,
			discriminatorProperty: 'type',
			discriminatorValue: DEVICES_RETERMINAL_TYPE,
			modelClass: UpdateReTerminalChannelDto,
		});

		this.discriminatorRegistry.register({
			parentClass: ChannelPropertyEntity,
			discriminatorProperty: 'type',
			discriminatorValue: DEVICES_RETERMINAL_TYPE,
			modelClass: ReTerminalChannelPropertyEntity,
		});

		this.discriminatorRegistry.register({
			parentClass: CreateChannelPropertyDto,
			discriminatorProperty: 'type',
			discriminatorValue: DEVICES_RETERMINAL_TYPE,
			modelClass: CreateReTerminalChannelPropertyDto,
		});

		this.discriminatorRegistry.register({
			parentClass: UpdateChannelPropertyDto,
			discriminatorProperty: 'type',
			discriminatorValue: DEVICES_RETERMINAL_TYPE,
			modelClass: UpdateReTerminalChannelPropertyDto,
		});

		// Register plugin metadata for extension discovery
		this.extensionsService.registerPluginMetadata({
			type: DEVICES_RETERMINAL_PLUGIN_NAME,
			name: 'reTerminal Devices',
			description: 'Support for SeeedStudio reTerminal hardware peripherals',
			author: 'FastyBird',
			readme: `# reTerminal Devices Plugin

Host device integration plugin for SeeedStudio reTerminal hardware.

## Supported Hardware

- **reTerminal CM4** (5" touchscreen) - Buttons (F1, F2, F3, O), USR LED, STA LED (red/green), buzzer, light sensor, accelerometer
- **reTerminal DM** (10.1" industrial) - Status LED, digital inputs/outputs, CPU temperature

## Features

- **Auto-Detection** - Automatically detects reTerminal hardware variant
- **Button Events** - Press, long press, and double press detection via evdev
- **LED Control** - On/off, brightness, and color control via sysfs
- **Buzzer Control** - Audible alert output
- **Sensor Polling** - Light sensor, accelerometer, and CPU temperature monitoring
- **Orientation Detection** - Computed from accelerometer data

## Communication

Uses Linux sysfs and evdev interfaces:
- \`/sys/class/leds/\` for LED and buzzer control
- \`/dev/input/\` for button event monitoring
- \`/sys/bus/iio/devices/\` for sensor data
- \`/sys/class/thermal/\` for CPU temperature`,
			links: {
				documentation: 'https://smart-panel.fastybird.com/docs',
				repository: 'https://github.com/FastyBird/smart-panel',
			},
		});

		// Register service with the centralized plugin service manager
		this.pluginServiceManager.register(this.reTerminalService);
	}
}
