import { join } from 'path';

import { Module } from '@nestjs/common';
import { ConfigModule as NestConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';

import { PLUGINS_PREFIX } from '../../app.constants';
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
import { ManagedServiceManagerService } from '../../modules/extensions/services/managed-service-manager.service';
import { ApiTag } from '../../modules/swagger/decorators/api-tag.decorator';
import { ExtendedDiscriminatorService } from '../../modules/swagger/services/extended-discriminator.service';
import { SwaggerModelsRegistryService } from '../../modules/swagger/services/swagger-models-registry.service';
import { SwaggerModule } from '../../modules/swagger/swagger.module';

import { ModbusDevicesController } from './controllers/modbus-devices.controller';
import { ModbusEndpointsController } from './controllers/modbus-endpoints.controller';
import { ModbusProbeController } from './controllers/modbus-probe.controller';
import { ModbusTemplatesController } from './controllers/modbus-templates.controller';
import {
	DEVICES_MODBUS_API_TAG_DESCRIPTION,
	DEVICES_MODBUS_API_TAG_NAME,
	DEVICES_MODBUS_PLUGIN_NAME,
	DEVICES_MODBUS_PLUGIN_PREFIX,
	DEVICES_MODBUS_TYPE,
} from './devices-modbus.constants';
import { DEVICES_MODBUS_PLUGIN_SWAGGER_EXTRA_MODELS } from './devices-modbus.openapi';
import { CreateModbusChannelPropertyDto } from './dto/create-channel-property.dto';
import { CreateModbusChannelDto } from './dto/create-channel.dto';
import { CreateModbusDeviceDto } from './dto/create-device.dto';
import { UpdateModbusChannelPropertyDto } from './dto/update-channel-property.dto';
import { UpdateModbusChannelDto } from './dto/update-channel.dto';
import { ModbusUpdatePluginConfigDto } from './dto/update-config.dto';
import { UpdateModbusDeviceDto } from './dto/update-device.dto';
import { ModbusChannelEntity, ModbusChannelPropertyEntity, ModbusDeviceEntity } from './entities/devices-modbus.entity';
import { ModbusBindingEntity } from './entities/modbus-binding.entity';
import { ModbusEndpointEntity } from './entities/modbus-endpoint.entity';
import { ModbusConfigModel } from './models/config.model';
import { ModbusDevicePlatform } from './platforms/modbus.device.platform';
import { ModbusBindingsService } from './services/modbus-bindings.service';
import { ModbusConnectionsService } from './services/modbus-connections.service';
import { ModbusDeviceStructureService } from './services/modbus-device-structure.service';
import { ModbusEndpointsService } from './services/modbus-endpoints.service';
import { MODBUS_PROBE_TRANSPORT_FACTORY, ModbusProbeService } from './services/modbus-probe.service';
import { ModbusRuntimeService } from './services/modbus-runtime.service';
import { MODBUS_TEMPLATES_LOCATIONS, ModbusTemplatesService } from './services/modbus-templates.service';
import { createModbusSerialTransport } from './transport/modbus-serial.transport';

@ApiTag({
	tagName: DEVICES_MODBUS_PLUGIN_NAME,
	displayName: DEVICES_MODBUS_API_TAG_NAME,
	description: DEVICES_MODBUS_API_TAG_DESCRIPTION,
})
@Module({
	imports: [
		TypeOrmModule.forFeature([
			ModbusDeviceEntity,
			ModbusChannelEntity,
			ModbusChannelPropertyEntity,
			ModbusEndpointEntity,
			ModbusBindingEntity,
		]),
		DevicesModule,
		NestConfigModule,
		ConfigModule,
		SwaggerModule,
		ExtensionsModule,
	],
	providers: [
		ModbusDevicePlatform,
		ModbusRuntimeService,
		ModbusConnectionsService,
		ModbusEndpointsService,
		ModbusBindingsService,
		ModbusDeviceStructureService,
		{
			provide: MODBUS_TEMPLATES_LOCATIONS,
			useValue: {
				builtinDirectory: join(__dirname, 'templates/definitions'),
				schemaPath: join(__dirname, 'templates/schema/modbus-templates.schema.json'),
			},
		},
		ModbusTemplatesService,
		{ provide: MODBUS_PROBE_TRANSPORT_FACTORY, useValue: createModbusSerialTransport },
		ModbusProbeService,
	],
	controllers: [ModbusEndpointsController, ModbusDevicesController, ModbusTemplatesController, ModbusProbeController],
	exports: [ModbusEndpointsService, ModbusConnectionsService, ModbusBindingsService, ModbusDeviceStructureService],
})
export class DevicesModbusPlugin {
	constructor(
		private readonly configMapper: PluginsTypeMapperService,
		private readonly runtime: ModbusRuntimeService,
		private readonly devicesMapper: DevicesTypeMapperService,
		private readonly channelsMapper: ChannelsTypeMapperService,
		private readonly channelsPropertiesMapper: ChannelsPropertiesTypeMapperService,
		private readonly modbusDevicePlatform: ModbusDevicePlatform,
		private readonly platformRegistryService: PlatformRegistryService,
		private readonly swaggerRegistry: SwaggerModelsRegistryService,
		private readonly discriminatorRegistry: ExtendedDiscriminatorService,
		private readonly extensionsService: ExtensionsService,
		private readonly managedServiceManager: ManagedServiceManagerService,
		private readonly deviceStructure: ModbusDeviceStructureService,
	) {}

	onModuleInit() {
		// Register plugin config mapper
		this.configMapper.registerMapping<ModbusConfigModel, ModbusUpdatePluginConfigDto>({
			type: DEVICES_MODBUS_PLUGIN_NAME,
			class: ModbusConfigModel,
			configDto: ModbusUpdatePluginConfigDto,
		});

		// Register device type mapper
		this.devicesMapper.registerMapping<ModbusDeviceEntity, CreateModbusDeviceDto, UpdateModbusDeviceDto>({
			type: DEVICES_MODBUS_TYPE,
			createDto: CreateModbusDeviceDto,
			updateDto: UpdateModbusDeviceDto,
			class: ModbusDeviceEntity,
			// A core PATCH may move the device to another endpoint or unit, or lower its read limit: judged on the merged
			// row like a creation, and refused with the plugin's 400 validation error.
			beforeUpdate: (device, previous) => this.deviceStructure.validateUpdate(device, previous),
			// The generic core create cannot check the endpoint, the unit or the bindings: a Modbus device is only
			// installed atomically, with its structure, by the plugin's own route.
			requiresCreationContext: true,
			creationRoute: `POST /${PLUGINS_PREFIX}/${DEVICES_MODBUS_PLUGIN_PREFIX}/devices`,
		});

		// Register channel type mapper
		this.channelsMapper.registerMapping<ModbusChannelEntity, CreateModbusChannelDto, UpdateModbusChannelDto>({
			type: DEVICES_MODBUS_TYPE,
			createDto: CreateModbusChannelDto,
			updateDto: UpdateModbusChannelDto,
			class: ModbusChannelEntity,
		});

		// Register channel property type mapper
		this.channelsPropertiesMapper.registerMapping<
			ModbusChannelPropertyEntity,
			CreateModbusChannelPropertyDto,
			UpdateModbusChannelPropertyDto
		>({
			type: DEVICES_MODBUS_TYPE,
			createDto: CreateModbusChannelPropertyDto,
			updateDto: UpdateModbusChannelPropertyDto,
			class: ModbusChannelPropertyEntity,
		});

		// Register device platform
		this.platformRegistryService.register(this.modbusDevicePlatform);

		// Register Swagger models
		for (const model of DEVICES_MODBUS_PLUGIN_SWAGGER_EXTRA_MODELS) {
			this.swaggerRegistry.register(model);
		}

		// Register discriminators for polymorphic serialization
		this.discriminatorRegistry.register({
			parentClass: DeviceEntity,
			discriminatorProperty: 'type',
			discriminatorValue: DEVICES_MODBUS_TYPE,
			modelClass: ModbusDeviceEntity,
		});

		this.discriminatorRegistry.register({
			parentClass: CreateDeviceDto,
			discriminatorProperty: 'type',
			discriminatorValue: DEVICES_MODBUS_TYPE,
			modelClass: CreateModbusDeviceDto,
		});

		this.discriminatorRegistry.register({
			parentClass: UpdateDeviceDto,
			discriminatorProperty: 'type',
			discriminatorValue: DEVICES_MODBUS_TYPE,
			modelClass: UpdateModbusDeviceDto,
		});

		this.discriminatorRegistry.register({
			parentClass: ChannelEntity,
			discriminatorProperty: 'type',
			discriminatorValue: DEVICES_MODBUS_TYPE,
			modelClass: ModbusChannelEntity,
		});

		this.discriminatorRegistry.register({
			parentClass: CreateChannelDto,
			discriminatorProperty: 'type',
			discriminatorValue: DEVICES_MODBUS_TYPE,
			modelClass: CreateModbusChannelDto,
		});

		this.discriminatorRegistry.register({
			parentClass: UpdateChannelDto,
			discriminatorProperty: 'type',
			discriminatorValue: DEVICES_MODBUS_TYPE,
			modelClass: UpdateModbusChannelDto,
		});

		this.discriminatorRegistry.register({
			parentClass: ChannelPropertyEntity,
			discriminatorProperty: 'type',
			discriminatorValue: DEVICES_MODBUS_TYPE,
			modelClass: ModbusChannelPropertyEntity,
		});

		this.discriminatorRegistry.register({
			parentClass: CreateChannelPropertyDto,
			discriminatorProperty: 'type',
			discriminatorValue: DEVICES_MODBUS_TYPE,
			modelClass: CreateModbusChannelPropertyDto,
		});

		this.discriminatorRegistry.register({
			parentClass: UpdateChannelPropertyDto,
			discriminatorProperty: 'type',
			discriminatorValue: DEVICES_MODBUS_TYPE,
			modelClass: UpdateModbusChannelPropertyDto,
		});

		// Register plugin metadata for extension discovery
		this.extensionsService.registerPluginMetadata({
			type: DEVICES_MODBUS_PLUGIN_NAME,
			name: 'Modbus',
			description: 'Support for Modbus TCP and RTU over TCP devices',
			author: 'FastyBird',
			readme: `# Modbus

> Plugin · by FastyBird · platform: devices

Integration for Modbus devices reachable over the network. Supports **Modbus TCP** and **RTU over TCP** (serial gateways that tunnel RTU frames through a TCP socket).

## What you get

- Poll coils, discrete inputs, input registers and holding registers of any Modbus device and expose them as Smart Panel properties
- Write coils and holding registers from the panel and dashboards

## Features

- **Modbus TCP** — standard MBAP framing on port 502
- **RTU over TCP** — RTU frames (with CRC) through transparent serial-to-Ethernet gateways
- **Typed registers** — bool, int16, uint16, int32, uint32 and float32 with configurable byte and word order
- **Resilient connections** — automatic reconnect with backoff and per-device health tracking
- **Device templates** — built-in templates (Qingjun 32 channel input board, Eletechsup N4D8B08) create a complete device from a unit ID. Your own templates are YAML files named \`plugin.devices-modbus.*.yaml\` in the configuration directory; when \`FB_MODBUS_TEMPLATES_PATH\` is set, every \`*.yaml\` file under that directory is read instead of those; a template with the same ID replaces the built-in one. Reload them from the API without restarting. Devices keep the structure they were created with when a template changes.

## Configuration

| Option | Description | Default |
|--------|-------------|---------|
| \`enabled\` | Enable the Modbus plugin | \`true\` |
| \`default_connect_timeout_ms\` | Connect timeout for new endpoints that do not set one | \`2000\` |
| \`default_request_timeout_ms\` | Request timeout for new endpoints that do not set one | \`1000\` |
| \`default_poll_interval_ms\` | Poll interval suggested for new devices | \`1000\` |`,
			links: {
				documentation: 'https://smart-panel.fastybird.com/docs',
				repository: 'https://github.com/FastyBird/smart-panel',
			},
		});

		// Register service with the centralized plugin service manager
		// The manager handles startup, shutdown, and config-based enable/disable
		this.managedServiceManager.register(this.runtime);
	}
}
