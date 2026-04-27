import { networkInterfaces } from 'os';

import { Module } from '@nestjs/common';
import { ConfigModule as NestConfigModule, ConfigService as NestConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';

import { createExtensionLogger } from '../../common/logger';
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
import { PluginServiceManagerService } from '../../modules/extensions/services/plugin-service-manager.service';
import { ApiTag } from '../../modules/swagger/decorators/api-tag.decorator';
import { ExtendedDiscriminatorService } from '../../modules/swagger/services/extended-discriminator.service';
import { SwaggerModelsRegistryService } from '../../modules/swagger/services/swagger-models-registry.service';
import { SwaggerModule } from '../../modules/swagger/swagger.module';

import { ShellyNgDevicesController } from './controllers/shelly-ng-devices.controller';
import { DelegatesManagerService } from './delegates/delegates-manager.service';
import {
	AddressType,
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
import { ShellyNgDeviceAddressEntity } from './entities/shelly-ng-device-address.entity';
import { MappingLoaderService, PropertyMappingStorageService, TransformerRegistry } from './mappings';
import { ShellyNgConfigModel } from './models/config.model';
import { ShellyNgDevicePlatform } from './platforms/shelly-ng.device.platform';
import { DatabaseDiscovererService } from './services/database-discoverer.service';
import { DeviceAddressService } from './services/device-address.service';
import { DeviceManagerService } from './services/device-manager.service';
import { ShellyNgService } from './services/shelly-ng.service';
import { ShellyRpcClientService } from './services/shelly-rpc-client.service';
import { ShellyWsServerService } from './services/shelly-ws-server.service';
import { DeviceEntitySubscriber } from './subscribers/device-entity.subscriber';

@ApiTag({
	tagName: DEVICES_SHELLY_NG_PLUGIN_NAME,
	displayName: DEVICES_SHELLY_NG_PLUGIN_API_TAG_NAME,
	description: DEVICES_SHELLY_NG_PLUGIN_API_TAG_DESCRIPTION,
})
@Module({
	imports: [
		TypeOrmModule.forFeature([
			ShellyNgDeviceEntity,
			ShellyNgChannelEntity,
			ShellyNgChannelPropertyEntity,
			ShellyNgDeviceAddressEntity,
		]),
		DevicesModule,
		ConfigModule,
		NestConfigModule,
		SwaggerModule,
		ExtensionsModule,
	],
	providers: [
		TransformerRegistry,
		MappingLoaderService,
		PropertyMappingStorageService,
		ShellyRpcClientService,
		DeviceAddressService,
		DatabaseDiscovererService,
		DelegatesManagerService,
		DeviceManagerService,
		ShellyNgService,
		ShellyWsServerService,
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
		private readonly deviceAddressService: DeviceAddressService,
		private readonly deviceManagerService: DeviceManagerService,
		private readonly rpcClient: ShellyRpcClientService,
		private readonly nestConfigService: NestConfigService,
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
			afterCreate: async (
				device: ShellyNgDeviceEntity,
				createDto?: CreateShellyNgDeviceDto,
			): Promise<ShellyNgDeviceEntity> => {
				const logger = createExtensionLogger(DEVICES_SHELLY_NG_PLUGIN_NAME, 'DeviceAfterCreate');

				// Sync address from DTO and provision the device so the API
				// response already contains channels.
				if (createDto?.wifiAddress) {
					await this.deviceAddressService.upsertAddress(device.id, AddressType.WIFI, createDto.wifiAddress);
					await this.deviceManagerService.createOrUpdate(device.id);

					// Configure the device's outbound WebSocket to point to our
					// inbound WS server so sleeping devices can push status on wake.
					// Best-effort: non-sleeping devices will ignore this silently.
					try {
						const port = getEnvValue<number>(this.nestConfigService, 'FB_BACKEND_PORT', 3000);
						const panelIp = this.detectLocalIp(createDto.wifiAddress);

						if (panelIp) {
							const wsUrl = `ws://${panelIp}:${port}/api/v1/plugins/shelly-ng/ws`;

							await this.rpcClient.setWsOutboundConfig(createDto.wifiAddress, wsUrl, {
								password: createDto.password ?? null,
							});

							logger.log(`Configured outbound WS on device=${device.id} → ${wsUrl}`);
						}
					} catch (err) {
						// Non-fatal — device may not support outbound WS
						logger.debug(`Could not configure outbound WS on device=${device.id}: ${(err as Error).message}`);
					}
				}

				return device;
			},
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
			name: 'Shelly Next Generation',
			description: 'Support for Shelly next-generation devices',
			author: 'FastyBird',
			readme: `# Shelly Next Generation

> Plugin · by FastyBird · platform: devices

Integration for Shelly next-generation (Gen2+) devices using Shelly's RPC API. Devices are discovered via mDNS, controlled over HTTP, and stream live state over an outbound WebSocket — even battery-powered, sleeping devices push status to the backend the moment they wake.

## What you get

- Plug-and-play onboarding: power up a new Shelly Plus / Pro device on the same network and the panel sees it within seconds
- Real device telemetry, not poll snapshots: temperature, power, energy and switch state arrive at the backend as soon as the device sees a change
- Stable, locally controlled devices — no Shelly cloud account required, all RPC traffic stays on your LAN
- Per-device configuration is read on first connect (channels, ranges, units) so the panel always reflects the device's actual capabilities

## Features

- **mDNS auto-discovery** — finds Gen2+ devices on the LAN automatically; new devices show up in the discovery feed for one-click adoption
- **Outbound WebSocket** — devices initiate the WebSocket back to the backend, so battery / sleeping devices push state on wake without the backend having to poll them
- **HTTP RPC fallback** — when WebSocket isn't available the plugin falls back to plain HTTP RPC; reconnection is automatic with configurable back-off
- **Device control** — relays, dimmers, RGBW lights, covers / shutters and other outputs through one unified \`device.control\` surface
- **Sensor monitoring** — temperature, humidity, power, energy, current, voltage; mapped onto standard channel property roles so dashboards and Buddy can read them generically
- **Optional polling** — a low-rate status poll catches missed events and surfaces a clear warning when a device stops talking
- **Resilient reconnect** — back-off ladder so a noisy network doesn't hammer either side
- **Local-IP auto-detection** — works out which interface is on the device's subnet so the WebSocket URL is always reachable

## Supported Devices

Shelly Plus (Plus 1, Plus 2PM, Plus Plug, …), Shelly Pro (Pro 1, Pro 2, Pro 4PM, …), Shelly Mini and any other Gen2+ device exposing the Shelly RPC API.

## Configuration

| Option | Description | Default |
|--------|-------------|---------|
| \`status_poll_interval\` | Status poll interval in seconds (\`0\` disables polling) | \`60\` |
| \`mdns.enabled\` | Run mDNS discovery for Shelly NG devices | \`true\` |
| \`mdns.interface\` | Network interface to bind discovery to | system default |
| \`websockets.request_timeout\` | RPC request timeout (s) | \`10\` |
| \`websockets.ping_interval\` | WebSocket ping interval (s) | \`30\` |
| \`websockets.reconnect_interval\` | Reconnect back-off in seconds | \`[5, 10, 15, 30, 60]\` |`,
			links: {
				documentation: 'https://smart-panel.fastybird.com/docs',
				repository: 'https://github.com/FastyBird/smart-panel',
			},
		});

		// Register service with the centralized plugin service manager
		// The manager handles startup, shutdown, and config-based enable/disable
		this.pluginServiceManager.register(this.shellyNgService);
	}

	/**
	 * Detect the local IP address on the same subnet as the given device IP.
	 * Returns the first IPv4 address that shares the same /24 prefix, or null.
	 */
	private detectLocalIp(deviceIp: string): string | null {
		const devicePrefix = deviceIp.split('.').slice(0, 3).join('.');
		const interfaces = networkInterfaces();

		for (const addrs of Object.values(interfaces)) {
			if (!addrs) continue;

			for (const addr of addrs) {
				if (addr.family === 'IPv4' && !addr.internal && addr.address.startsWith(devicePrefix + '.')) {
					return addr.address;
				}
			}
		}

		return null;
	}
}
