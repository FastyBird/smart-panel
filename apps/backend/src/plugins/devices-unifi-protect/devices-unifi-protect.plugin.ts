import { Module, OnModuleInit } from '@nestjs/common';
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
import { ExtensionsModule } from '../../modules/extensions/extensions.module';
import { ExtensionsService } from '../../modules/extensions/services/extensions.service';
import { ManagedServiceManagerService } from '../../modules/extensions/services/managed-service-manager.service';
import { ApiTag } from '../../modules/swagger/decorators/api-tag.decorator';
import { ExtendedDiscriminatorService } from '../../modules/swagger/services/extended-discriminator.service';
import { SwaggerModelsRegistryService } from '../../modules/swagger/services/swagger-models-registry.service';
import { SwaggerModule } from '../../modules/swagger/swagger.module';
import { FactoryResetRegistryService } from '../../modules/system/services/factory-reset-registry.service';

import { DefaultProtectApiClientFactory, PROTECT_API_CLIENT_FACTORY } from './client/protect-api-client.factory';
import { ProtectAdoptionController } from './controllers/protect-adoption.controller';
import { ProtectDevicesController } from './controllers/protect-devices.controller';
import { ProtectDiscoveryController } from './controllers/protect-discovery.controller';
import { ProtectStatusController } from './controllers/protect-status.controller';
import { ProtectTestConnectionController } from './controllers/protect-test-connection.controller';
import {
	DEVICES_UNIFI_PROTECT_PLUGIN_API_TAG_DESCRIPTION,
	DEVICES_UNIFI_PROTECT_PLUGIN_API_TAG_NAME,
	DEVICES_UNIFI_PROTECT_PLUGIN_NAME,
	DEVICES_UNIFI_PROTECT_TYPE,
	PROTECT_TRUSTED_CA,
} from './devices-unifi-protect.constants';
import { DEVICES_UNIFI_PROTECT_PLUGIN_SWAGGER_EXTRA_MODELS } from './devices-unifi-protect.openapi';
import { CreateProtectChannelPropertyDto } from './dto/create-channel-property.dto';
import { CreateProtectChannelDto } from './dto/create-channel.dto';
import { CreateProtectDeviceDto } from './dto/create-device.dto';
import { UpdateProtectChannelPropertyDto } from './dto/update-channel-property.dto';
import { UpdateProtectChannelDto } from './dto/update-channel.dto';
import { ProtectUpdatePluginConfigDto } from './dto/update-config.dto';
import { UpdateProtectDeviceDto } from './dto/update-device.dto';
import {
	ProtectChannelEntity,
	ProtectChannelPropertyEntity,
	ProtectDeviceEntity,
} from './entities/devices-unifi-protect.entity';
import { ProtectMappingLoaderService } from './mappings/mapping-loader.service';
import { ProtectConfigModel } from './models/config.model';
import { ProtectAdoptionLockService } from './services/protect-adoption-lock.service';
import { ProtectAdoptionStreamsService } from './services/protect-adoption-streams.service';
import { ProtectAdoptionService } from './services/protect-adoption.service';
import { ProtectConfigValidatorService } from './services/protect-config-validator.service';
import { ProtectConnectionTestService } from './services/protect-connection-test.service';
import { ProtectConnectorService } from './services/protect-connector.service';
import { ProtectDiscoveryProbeService } from './services/protect-discovery-probe.service';
import { NodeProtectProbeTransport } from './services/protect-discovery-probe.transport';
import { PROTECT_DISCOVERY_ENVIRONMENT, PROTECT_PROBE_TRANSPORT } from './services/protect-discovery.constants';
import { ProtectDiscoveryService, createNodeDiscoveryEnvironment } from './services/protect-discovery.service';
import { ProtectInventoryService } from './services/protect-inventory.service';
import { ProtectMappingPreviewService } from './services/protect-mapping-preview.service';
import {
	PROTECT_DEFAULT_REALTIME_TIMINGS,
	PROTECT_REALTIME_TIMINGS,
	ProtectRealtimeService,
} from './services/protect-realtime.service';
import { ProtectSynchronizerService } from './services/protect-synchronizer.service';

@ApiTag({
	tagName: DEVICES_UNIFI_PROTECT_PLUGIN_NAME,
	displayName: DEVICES_UNIFI_PROTECT_PLUGIN_API_TAG_NAME,
	description: DEVICES_UNIFI_PROTECT_PLUGIN_API_TAG_DESCRIPTION,
})
@Module({
	imports: [
		TypeOrmModule.forFeature([ProtectDeviceEntity, ProtectChannelEntity, ProtectChannelPropertyEntity]),
		DevicesModule,
		ConfigModule,
		ExtensionsModule,
		SwaggerModule,
	],
	providers: [
		ProtectConfigValidatorService,
		// Tests override this extra trusted CA; production never sets it.
		{ provide: PROTECT_TRUSTED_CA, useValue: undefined },
		DefaultProtectApiClientFactory,
		{ provide: PROTECT_API_CLIENT_FACTORY, useExisting: DefaultProtectApiClientFactory },
		ProtectConnectorService,
		ProtectMappingLoaderService,
		ProtectInventoryService,
		ProtectMappingPreviewService,
		ProtectSynchronizerService,
		{ provide: PROTECT_REALTIME_TIMINGS, useValue: PROTECT_DEFAULT_REALTIME_TIMINGS },
		ProtectRealtimeService,
		ProtectAdoptionLockService,
		ProtectAdoptionStreamsService,
		ProtectAdoptionService,
		ProtectConnectionTestService,
		ProtectDiscoveryService,
		ProtectDiscoveryProbeService,
		{ provide: PROTECT_PROBE_TRANSPORT, useFactory: () => new NodeProtectProbeTransport() },
		{ provide: PROTECT_DISCOVERY_ENVIRONMENT, useFactory: createNodeDiscoveryEnvironment },
	],
	controllers: [
		ProtectStatusController,
		ProtectTestConnectionController,
		ProtectDiscoveryController,
		ProtectDevicesController,
		ProtectAdoptionController,
	],
	exports: [ProtectConnectorService],
})
export class DevicesUnifiProtectPlugin implements OnModuleInit {
	constructor(
		private readonly configMapper: PluginsTypeMapperService,
		private readonly devicesMapper: DevicesTypeMapperService,
		private readonly channelsMapper: ChannelsTypeMapperService,
		private readonly channelsPropertiesMapper: ChannelsPropertiesTypeMapperService,
		private readonly swaggerRegistry: SwaggerModelsRegistryService,
		private readonly discriminatorRegistry: ExtendedDiscriminatorService,
		private readonly extensionsService: ExtensionsService,
		private readonly managedServiceManager: ManagedServiceManagerService,
		private readonly protectConnectorService: ProtectConnectorService,
		private readonly factoryResetRegistry: FactoryResetRegistryService,
	) {}

	onModuleInit(): void {
		this.factoryResetRegistry.register(
			DEVICES_UNIFI_PROTECT_PLUGIN_NAME,
			async (): Promise<{ success: boolean; reason?: string }> => {
				try {
					await this.protectConnectorService.stop();

					return { success: true };
				} catch (error) {
					return { success: false, reason: error instanceof Error ? error.message : 'Unknown error' };
				}
			},
			90,
		);

		this.configMapper.registerMapping<ProtectConfigModel, ProtectUpdatePluginConfigDto>({
			type: DEVICES_UNIFI_PROTECT_PLUGIN_NAME,
			class: ProtectConfigModel,
			configDto: ProtectUpdatePluginConfigDto,
			secretFields: [
				{
					path: 'api_key',
					configuredPath: 'api_key_configured',
					inputPaths: ['apiKey'],
				},
			],
		});

		this.devicesMapper.registerMapping<ProtectDeviceEntity, CreateProtectDeviceDto, UpdateProtectDeviceDto>({
			type: DEVICES_UNIFI_PROTECT_TYPE,
			class: ProtectDeviceEntity,
			createDto: CreateProtectDeviceDto,
			updateDto: UpdateProtectDeviceDto,
			// Only the plugin writes the Protect identity; the generic create route must not reserve an identity pair.
			requiresCreationContext: true,
		});

		this.channelsMapper.registerMapping<ProtectChannelEntity, CreateProtectChannelDto, UpdateProtectChannelDto>({
			type: DEVICES_UNIFI_PROTECT_TYPE,
			class: ProtectChannelEntity,
			createDto: CreateProtectChannelDto,
			updateDto: UpdateProtectChannelDto,
		});

		this.channelsPropertiesMapper.registerMapping<
			ProtectChannelPropertyEntity,
			CreateProtectChannelPropertyDto,
			UpdateProtectChannelPropertyDto
		>({
			type: DEVICES_UNIFI_PROTECT_TYPE,
			class: ProtectChannelPropertyEntity,
			createDto: CreateProtectChannelPropertyDto,
			updateDto: UpdateProtectChannelPropertyDto,
		});

		for (const model of DEVICES_UNIFI_PROTECT_PLUGIN_SWAGGER_EXTRA_MODELS) {
			this.swaggerRegistry.register(model);
		}

		this.registerDiscriminator(DeviceEntity, ProtectDeviceEntity);
		this.registerDiscriminator(CreateDeviceDto, CreateProtectDeviceDto);
		this.registerDiscriminator(UpdateDeviceDto, UpdateProtectDeviceDto);
		this.registerDiscriminator(ChannelEntity, ProtectChannelEntity);
		this.registerDiscriminator(CreateChannelDto, CreateProtectChannelDto);
		this.registerDiscriminator(UpdateChannelDto, UpdateProtectChannelDto);
		this.registerDiscriminator(ChannelPropertyEntity, ProtectChannelPropertyEntity);
		this.registerDiscriminator(CreateChannelPropertyDto, CreateProtectChannelPropertyDto);
		this.registerDiscriminator(UpdateChannelPropertyDto, UpdateProtectChannelPropertyDto);

		this.extensionsService.registerPluginMetadata({
			type: DEVICES_UNIFI_PROTECT_PLUGIN_NAME,
			name: 'UniFi Protect',
			description: 'Connects Smart Panel to a UniFi Protect console over its local Integration API',
			author: 'FastyBird',
			defaultEnabled: false,
			readme: `# UniFi Protect

> Plugin · by FastyBird · platform: devices

Connects Smart Panel to a UniFi Protect console over its local Integration API. Protect remains responsible for adopting cameras, recording and firmware; Smart Panel adopts the devices you select as its own devices.

## What you get

- Cameras, doorbells, UP-Sense sensors and floodlights adopted as Smart Panel devices, with a mapping preview and RTSPS stream enablement per camera (on by default, opt out with \`stream.enabled: false\`)
- A fully local integration with no UniFi cloud account and no hosted Smart Panel bridge
- Live device state, detections and doorbell rings through the console's event WebSockets, with REST polling while they are unavailable
- Certificate trust that never sends the API key over an unverified connection

## Setup

1. Make sure the console runs Protect 7.2.105 or newer.
2. In Protect, open Integrations and create an API key.
3. Enter the console host and the API key in this plugin's configuration.
4. Choose how the console certificate is trusted (see TLS), save and enable the plugin.

The API key is write-only: it is stored locally and never returned by the API.

## Configuration

| Option | Description | Default |
|--------|-------------|---------|
| \`host\` | Console host name or IP address | — |
| \`port\` | Console HTTPS port | \`443\` |
| \`api_key\` | Write-only Protect API key | — |
| \`tls.mode\` | Certificate trust mode: \`verify\` or \`pinned\` | \`verify\` |
| \`tls.server_name\` | Name used for SNI and certificate verification | — |
| \`tls.fingerprint_sha256\` | SHA-256 fingerprint of the console certificate, required for \`pinned\` | — |
| \`stream_host_override\` | Host clients use to reach camera streams instead of the console host | — |
| \`default_stream_quality\` | Preferred stream quality: \`high\`, \`medium\` or \`low\` | \`medium\` |
| \`snapshot_min_interval_ms\` | Minimum interval between snapshots of one camera (500–60000) | \`2000 ms\` |
| \`poll_interval_ms\` | Interval between device state refreshes while real-time updates are unavailable (5000–600000) | \`30000 ms\` |

## Real-time updates

- Frames from the console's event WebSockets are applied within a second.
- Detections without an end clear after 60 s.
- Devices removed on the console are kept, shown disconnected and reported once.
- Protect renames are copied unless the device was renamed in Smart Panel.
- After three failed connection attempts, device state is polled every \`poll_interval_ms\` and one warning is raised until the connection recovers.

## TLS

- \`verify\` checks the certificate chain and name. Set \`tls.server_name\` to the console's direct-connect domain, which serves a valid public certificate, or use a host name the certificate covers.
- \`pinned\` skips chain validation and accepts the console only when the SHA-256 fingerprint of its certificate equals \`tls.fingerprint_sha256\`.

There is no insecure mode: the API key is never sent over a connection that is neither name-verified nor pinned.

## Boundaries

Adoption enables the RTSPS streams of every adopted camera unless the request opts out (\`stream.enabled: false\`); the plugin never deletes a stream and never changes other console settings. The plugin never disables a camera microphone. Recording, users and firmware stay in Protect.

Adoption is API-only until the admin wizard (UP-12) ships. Provider settings are managed in the Smart Panel admin application. The API key is write-only and is never returned by the API.`,
			links: {
				documentation: 'https://smart-panel.fastybird.com/docs',
				repository: 'https://github.com/FastyBird/smart-panel',
			},
		});

		this.managedServiceManager.register(this.protectConnectorService);
	}

	private registerDiscriminator(
		parentClass: new (...args: any[]) => unknown,
		modelClass: new (...args: any[]) => unknown,
	) {
		this.discriminatorRegistry.register({
			parentClass,
			discriminatorProperty: 'type',
			discriminatorValue: DEVICES_UNIFI_PROTECT_TYPE,
			modelClass,
		});
	}
}
