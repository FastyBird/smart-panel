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
import { PropertyValueSourceRegistryService } from '../../modules/devices/services/property-value-source.registry.service';
import { ExtensionsModule } from '../../modules/extensions/extensions.module';
import { ExtensionsService } from '../../modules/extensions/services/extensions.service';
import { ApiTag } from '../../modules/swagger/decorators/api-tag.decorator';
import { ExtendedDiscriminatorService } from '../../modules/swagger/services/extended-discriminator.service';
import { SwaggerModelsRegistryService } from '../../modules/swagger/services/swagger-models-registry.service';
import { SwaggerModule } from '../../modules/swagger/swagger.module';

import { VirtualDevicesController } from './controllers/virtual-devices.controller';
import {
	DEVICES_VIRTUAL_PLUGIN_API_TAG_DESCRIPTION,
	DEVICES_VIRTUAL_PLUGIN_API_TAG_NAME,
	DEVICES_VIRTUAL_PLUGIN_NAME,
	DEVICES_VIRTUAL_TYPE,
} from './devices-virtual.constants';
import { DEVICES_VIRTUAL_PLUGIN_SWAGGER_EXTRA_MODELS } from './devices-virtual.openapi';
import { CreateVirtualChannelPropertyDto } from './dto/create-channel-property.dto';
import { CreateVirtualChannelDto } from './dto/create-channel.dto';
import { CreateVirtualDeviceDto } from './dto/create-device.dto';
import { UpdateVirtualChannelPropertyDto } from './dto/update-channel-property.dto';
import { UpdateVirtualChannelDto } from './dto/update-channel.dto';
import { VirtualUpdatePluginConfigDto } from './dto/update-config.dto';
import { UpdateVirtualDeviceDto } from './dto/update-device.dto';
import {
	VirtualChannelEntity,
	VirtualChannelPropertyEntity,
	VirtualDeviceEntity,
} from './entities/devices-virtual.entity';
import { VirtualDeviceInformationListener } from './listeners/virtual-device-information.listener';
import { VirtualIndexMaintenanceListener } from './listeners/virtual-index-maintenance.listener';
import { VirtualProjectionListener } from './listeners/virtual-projection.listener';
import { VirtualStatusListener } from './listeners/virtual-status.listener';
import { VirtualConfigModel } from './models/config.model';
import { VirtualDevicePlatform } from './platforms/virtual-device.platform';
import { VirtualDevicesService } from './services/virtual-devices.service';
import { VirtualPropertyIndexService } from './services/virtual-property-index.service';
import { VirtualValueSourceService } from './services/virtual-value-source.service';
import { CategoryAllowedConstraintValidator } from './validators/category-allowed-constraint.validator';
import { SourceNotVirtualConstraintValidator } from './validators/source-not-virtual-constraint.validator';

@ApiTag({
	tagName: DEVICES_VIRTUAL_PLUGIN_NAME,
	displayName: DEVICES_VIRTUAL_PLUGIN_API_TAG_NAME,
	description: DEVICES_VIRTUAL_PLUGIN_API_TAG_DESCRIPTION,
})
@Module({
	imports: [
		TypeOrmModule.forFeature([VirtualDeviceEntity, VirtualChannelPropertyEntity]),
		DevicesModule,
		ConfigModule,
		ExtensionsModule,
		SwaggerModule,
	],
	providers: [
		VirtualValueSourceService,
		VirtualDevicePlatform,
		VirtualPropertyIndexService,
		VirtualDevicesService,
		VirtualProjectionListener,
		VirtualStatusListener,
		VirtualIndexMaintenanceListener,
		VirtualDeviceInformationListener,
		CategoryAllowedConstraintValidator,
		SourceNotVirtualConstraintValidator,
	],
	controllers: [VirtualDevicesController],
})
export class DevicesVirtualPlugin {
	constructor(
		private readonly configMapper: PluginsTypeMapperService,
		private readonly devicesMapper: DevicesTypeMapperService,
		private readonly channelsMapper: ChannelsTypeMapperService,
		private readonly channelsPropertiesMapper: ChannelsPropertiesTypeMapperService,
		private readonly swaggerRegistry: SwaggerModelsRegistryService,
		private readonly discriminatorRegistry: ExtendedDiscriminatorService,
		private readonly extensionsService: ExtensionsService,
		private readonly virtualValueSourceService: VirtualValueSourceService,
		private readonly propertyValueSourceRegistry: PropertyValueSourceRegistryService,
		private readonly virtualDevicePlatform: VirtualDevicePlatform,
		private readonly platformRegistryService: PlatformRegistryService,
	) {}

	onModuleInit() {
		this.configMapper.registerMapping<VirtualConfigModel, VirtualUpdatePluginConfigDto>({
			type: DEVICES_VIRTUAL_PLUGIN_NAME,
			class: VirtualConfigModel,
			configDto: VirtualUpdatePluginConfigDto,
		});

		this.devicesMapper.registerMapping<VirtualDeviceEntity, CreateVirtualDeviceDto, UpdateVirtualDeviceDto>({
			type: DEVICES_VIRTUAL_TYPE,
			class: VirtualDeviceEntity,
			createDto: CreateVirtualDeviceDto,
			updateDto: UpdateVirtualDeviceDto,
		});

		this.channelsMapper.registerMapping<VirtualChannelEntity, CreateVirtualChannelDto, UpdateVirtualChannelDto>({
			type: DEVICES_VIRTUAL_TYPE,
			class: VirtualChannelEntity,
			createDto: CreateVirtualChannelDto,
			updateDto: UpdateVirtualChannelDto,
		});

		this.channelsPropertiesMapper.registerMapping<
			VirtualChannelPropertyEntity,
			CreateVirtualChannelPropertyDto,
			UpdateVirtualChannelPropertyDto
		>({
			type: DEVICES_VIRTUAL_TYPE,
			class: VirtualChannelPropertyEntity,
			createDto: CreateVirtualChannelPropertyDto,
			updateDto: UpdateVirtualChannelPropertyDto,
		});

		for (const model of DEVICES_VIRTUAL_PLUGIN_SWAGGER_EXTRA_MODELS) {
			this.swaggerRegistry.register(model);
		}

		this.discriminatorRegistry.register({
			parentClass: DeviceEntity,
			discriminatorProperty: 'type',
			discriminatorValue: DEVICES_VIRTUAL_TYPE,
			modelClass: VirtualDeviceEntity,
		});

		this.discriminatorRegistry.register({
			parentClass: CreateDeviceDto,
			discriminatorProperty: 'type',
			discriminatorValue: DEVICES_VIRTUAL_TYPE,
			modelClass: CreateVirtualDeviceDto,
		});

		this.discriminatorRegistry.register({
			parentClass: UpdateDeviceDto,
			discriminatorProperty: 'type',
			discriminatorValue: DEVICES_VIRTUAL_TYPE,
			modelClass: UpdateVirtualDeviceDto,
		});

		this.discriminatorRegistry.register({
			parentClass: ChannelEntity,
			discriminatorProperty: 'type',
			discriminatorValue: DEVICES_VIRTUAL_TYPE,
			modelClass: VirtualChannelEntity,
		});

		this.discriminatorRegistry.register({
			parentClass: CreateChannelDto,
			discriminatorProperty: 'type',
			discriminatorValue: DEVICES_VIRTUAL_TYPE,
			modelClass: CreateVirtualChannelDto,
		});

		this.discriminatorRegistry.register({
			parentClass: UpdateChannelDto,
			discriminatorProperty: 'type',
			discriminatorValue: DEVICES_VIRTUAL_TYPE,
			modelClass: UpdateVirtualChannelDto,
		});

		this.discriminatorRegistry.register({
			parentClass: ChannelPropertyEntity,
			discriminatorProperty: 'type',
			discriminatorValue: DEVICES_VIRTUAL_TYPE,
			modelClass: VirtualChannelPropertyEntity,
		});

		this.discriminatorRegistry.register({
			parentClass: CreateChannelPropertyDto,
			discriminatorProperty: 'type',
			discriminatorValue: DEVICES_VIRTUAL_TYPE,
			modelClass: CreateVirtualChannelPropertyDto,
		});

		this.discriminatorRegistry.register({
			parentClass: UpdateChannelPropertyDto,
			discriminatorProperty: 'type',
			discriminatorValue: DEVICES_VIRTUAL_TYPE,
			modelClass: UpdateVirtualChannelPropertyDto,
		});

		this.propertyValueSourceRegistry.register(this.virtualValueSourceService);

		this.platformRegistryService.register(this.virtualDevicePlatform);

		// Register extension metadata
		this.extensionsService.registerPluginMetadata({
			type: DEVICES_VIRTUAL_PLUGIN_NAME,
			name: 'Virtual Devices',
			description: 'Build devices by splitting or combining the channels and properties of other devices',
			author: 'FastyBird',
			readme: `# Virtual Devices

> Plugin · by FastyBird · platform: devices

Build new devices out of channels and properties that already belong to other devices. Split one physical device into several logical ones — for example a four-relay switch into four separate room switches — or combine several physical devices into one, such as a Zigbee temperature sensor and a relay presented together as a single device.

Every channel and property a virtual device exposes is a real row with a real id, so it works with rooms, spaces, tiles, scenes and dashboards exactly like a native device. Nothing is duplicated: a linked property reads and writes through its source, so the value and its history live in one place, not two.

## What you get

- A way to reorganise devices around how your home is actually laid out, instead of how the hardware happens to be wired
- One dashboard tile, one room assignment and one set of scenes for properties that used to be scattered across several devices — or split apart from one device that covered too much
- No duplicated history: energy and timeseries data are recorded once, at the source, no matter how many virtual devices project it

## Features

- **Splitting** — turn one multi-channel physical device into several independent devices, each with its own room, category and identity
- **Composition** — assemble one logical device from channels and properties taken from several physical devices
- **Live projection** — a linked property always reflects its source; writes are forwarded back to the source rather than stored separately
- **Graceful degradation** — if a source property is deleted, the property that projected it is marked orphaned instead of breaking the device, so it can be remapped later

## What it doesn't do (yet)

- **No closed-loop control.** Categories that need a control algorithm to turn a setpoint into action — thermostats, air conditioners, humidifiers and similar — aren't offered, so a virtual device never accepts a command it can't actually carry out
- **No computed or aggregated values.** Every linked property mirrors its source 1:1; there is no averaging, scaling or combining of several sources into one value
- **Admin only.** Virtual devices are configured from the admin app; there is no panel-side creation flow

## Use Cases

- Splitting a multi-relay device so each load gets its own room and its own place on the dashboard
- Combining a temperature sensor and a switch into one device that reads and behaves like a single piece of hardware
- Reshaping how imported or auto-discovered devices are organised without touching the integration that created them`,
			links: {
				documentation: 'https://smart-panel.fastybird.com/docs',
				repository: 'https://github.com/FastyBird/smart-panel',
			},
		});
	}
}
