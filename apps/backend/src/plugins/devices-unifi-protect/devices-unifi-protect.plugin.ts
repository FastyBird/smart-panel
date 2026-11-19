import { Module, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { createExtensionLogger } from '../../common/logger/extension-logger.service';
import { CamerasModule } from '../../modules/cameras/cameras.module';
import { CameraStreamProviderRegistryService } from '../../modules/cameras/services/camera-stream-provider.registry.service';
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
import { UnifiProtectDevicePlatform } from './platforms/unifi-protect-device.platform';
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
import { ProtectStreamAvailabilityService } from './services/protect-stream-availability.service';
import { ProtectStreamAvailabilityStore } from './services/protect-stream-availability.store';
import { ProtectStreamBridgeService } from './services/protect-stream-bridge.service';
import { UnifiProtectStreamProvider } from './services/protect-stream.provider';
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
		// Provides the relay state (`Go2rtcService`) to the stream bridge.
		CamerasModule,
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
		ProtectStreamAvailabilityStore,
		ProtectStreamAvailabilityService,
		ProtectStreamBridgeService,
		UnifiProtectStreamProvider,
		ProtectSynchronizerService,
		UnifiProtectDevicePlatform,
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
export class DevicesUnifiProtectPlugin implements OnModuleInit, OnModuleDestroy {
	private readonly logger = createExtensionLogger(DEVICES_UNIFI_PROTECT_PLUGIN_NAME, 'DevicesUnifiProtectPlugin');

	private streamProviderRegistration: Readonly<{ dispose: () => void }> | null = null;

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
		private readonly platformRegistry: PlatformRegistryService,
		private readonly unifiProtectDevicePlatform: UnifiProtectDevicePlatform,
		private readonly cameraStreamProviders: CameraStreamProviderRegistryService,
		private readonly unifiProtectStreamProvider: UnifiProtectStreamProvider,
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
- Live view and snapshots of cameras and doorbells through the cameras module, with camera status that follows the console
- Control of floodlight light, brightness and status LED, and camera and doorbell status LED and microphone volume
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
| \`stream_host_override\` | Host Smart Panel connects to for camera streams instead of the console host | — |
| \`default_stream_quality\` | Preferred stream quality: \`high\`, \`medium\` or \`low\` | \`medium\` |
| \`snapshot_min_interval_ms\` | Minimum interval between snapshots of one camera (500–60000) | \`2000 ms\` |
| \`poll_interval_ms\` | Interval between device state refreshes while real-time updates are unavailable (5000–600000) | \`30000 ms\` |

## Real-time updates

- Frames from the console's event WebSockets are applied within a second.
- Detections without an end clear after 60 s.
- Devices removed on the console are kept, shown disconnected and reported once.
- Protect renames are copied unless the device was renamed in Smart Panel.
- After three failed connection attempts, device state is polled every \`poll_interval_ms\` and one warning is raised until the connection recovers.

## Control

- Each change becomes one partial update per Protect device, sent through the same request pacing as every other console request.
- A change counts as done only when the console confirms it, by its next device update or a read-back within a few seconds; otherwise the command fails and Smart Panel keeps showing the console's state.
- In polling mode each command's read-back advances the snapshot sequence, so during a burst of commands an overlapping poll can be discarded and other devices refresh at the next poll.
- Floodlight brightness has six levels on the console; a value between two levels is set to the nearest one.
- Devices adopted before this version need to be adopted again to make the microphone volume and the floodlight status LED writable.
- Known limit: room-level lighting intents fail for floodlights; control a floodlight through its own device.
- Known limit: switching \`light.on\` off on a floodlight lit by motion clears only the forced-on state, so the command is confirmed while the light stays lit until the motion timer ends.
- Known limit: a heavily queued command can exceed the core's 24 s command timeout and be reported as failed while it is later confirmed; the stored value stays correct because the console read-back is authoritative.

## Streams and snapshots

- Each adopted camera offers the \`high\`, \`medium\` and \`low\` stream qualities, plus \`package\` on doorbells with a package camera; \`default_stream_quality\` is listed first. A quality that is not enabled on the console is listed as unavailable (\`stream_not_enabled\`): enable it in Protect, or adopt the camera again with streams enabled. Beyond adoption's opt-out stream enablement, the plugin never enables or deletes a stream on its own.
- A quality can also be unavailable for these reasons: \`console_unavailable\` (no console session, or the camera belongs to another console), \`camera_offline\` (the camera is not connected, or Smart Panel has not seen it yet), \`stream_state_unknown\` (the console has not been read yet or did not answer) and \`stream_tls_unverified\` (see below).
- Live streams reach the console through a small bridge in Smart Panel that checks the console certificate exactly like the API connection (\`tls.mode\`). go2rtc reads plain RTSP from a loopback listener of the bridge; the bridge opens the TLS connection to the console's stream port and verifies it before it forwards a single byte. There is no \`rtsps\` shortcut around the bridge and no unverified path: if the stream port presents a certificate that does not pass, live view stays unavailable (\`stream_tls_unverified\`) and the stream fails closed. The bridge also drops any RTSP redirect from the console. The \`stream_tls_unverified\` reason appears only after a stream handshake has failed in the current session; it is not a proactive check. It is forgotten after 60 s and when the console session changes, the quality is then offered again and the check repeats, and playback itself fails closed on every attempt.
- Listing a camera's qualities also reads the console in the background, paced like every other request, to learn which qualities are enabled; only the enabled flags and the stream ports are kept. Stream addresses are read from the console each time a live stream starts and are kept only in memory: they are never stored, logged or returned by the API.
- \`stream_host_override\` replaces the host Smart Panel connects to for camera streams, for a stream endpoint that differs from the API host. The address in the console's stream URL is never used: Smart Panel connects to \`host\` or to the override. The console's certificate is still verified against its own name (\`host\` or \`tls.server_name\`) and \`tls.mode\`, never against the override. An invalid override is never replaced by the console host: live view stays unavailable, with one warning in the log, until it is fixed or cleared.
- Snapshots use the same request pacing as every other console request, at most one per camera every \`snapshot_min_interval_ms\`. Full-HD snapshots are requested only from cameras that support them.
- Camera status follows the console: \`offline\` while a camera is disconnected, \`initializing\` while it connects, \`available\` when a stream quality is enabled and \`unavailable\` when none is.

### External relay

- With the managed go2rtc the bridge listens on loopback only. With an external go2rtc on another host, the listener binds only the local address on the route to the relay, and it accepts only the relay's addresses (the peer the relay answered from plus its resolved addresses); any other peer is refused.
- An external go2rtc on the same host, reached through a loopback URL, gets a loopback listener with no allow-list, like the managed one.
- The hop from go2rtc to the bridge is not encrypted. Use an external relay only on a network you trust.
- A relay in a container on the same host, reached through \`localhost\` or published ports, cannot reach the loopback bridge. A relay reached through the host's LAN IP connects from a bridge-network address that is not in the allow-list and is refused. Both fail closed.
- The allow-list is learnt once per relay generation. If the relay's DNS name or DHCP address changes, the old address stays allowed until the relay changes (restart, or a different relay URL).

### Known limits

- While a listener is closed (plugin disabled, shutdown, or the relay seen as not running) and go2rtc still holds its stream URL, a local process that binds the freed port can receive the stream alias.
- When the console rotates a stream alias, that stream fails at the console until it is registered again.
- The bridge allows at most 16 concurrent connections and 32 new connections per 10 s; local connection exhaustion or a flood of connections can block live view until it passes. Idle connections close after 60 s.
- Streams have not yet been verified against a real console.
- The certificate presented on the stream port (7441) has not been measured on a real console yet; until then a console whose stream port does not pass \`tls.mode\` stays unavailable.
- While a listener is open, any local process can connect to it. It cannot reach a stream without the alias, but it can trigger console TLS handshakes within the 32-per-10-s budget.
- At most 8 listeners are open at once (one per console stream port).
- The bridge also closes a connection when the console sends a malformed or oversized RTSP message, not only on a redirect.

## TLS

- \`verify\` checks the certificate chain and name. Set \`tls.server_name\` to the console's direct-connect domain, which serves a valid public certificate, or use a host name the certificate covers.
- \`pinned\` skips chain validation and accepts the console only when the SHA-256 fingerprint of its certificate equals \`tls.fingerprint_sha256\`.

There is no insecure mode: the API key is never sent over a connection that is neither name-verified nor pinned.

## Boundaries

Adoption enables the RTSPS streams of every adopted camera unless the request opts out (\`stream.enabled: false\`); the plugin never deletes a stream, and changes no console setting other than those listed under Control. The plugin never disables a camera microphone. Recording, users and firmware stay in Protect.

Adoption is API-only until the admin wizard (UP-12) ships. Provider settings are managed in the Smart Panel admin application. The API key is write-only and is never returned by the API.`,
			links: {
				documentation: 'https://smart-panel.fastybird.com/docs',
				repository: 'https://github.com/FastyBird/smart-panel',
			},
		});

		this.managedServiceManager.register(this.protectConnectorService);
		this.platformRegistry.register(this.unifiProtectDevicePlatform);

		this.streamProviderRegistration = this.cameraStreamProviders.register(this.unifiProtectStreamProvider);

		if (this.streamProviderRegistration === null) {
			this.logger.warn('UniFi Protect stream provider was not registered');
		}
	}

	onModuleDestroy(): void {
		// Destroy order: the bridge may already be destroyed, so a late `prepare` rejects and this window is safe.
		this.streamProviderRegistration?.dispose();
		this.streamProviderRegistration = null;
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
