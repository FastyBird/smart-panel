import { readFileSync } from 'fs';
import { resolve } from 'path';

import { Logger } from '@nestjs/common';

import { CamerasModule } from '../../modules/cameras/cameras.module';
import { ICameraStreamProvider } from '../../modules/cameras/platforms/camera-stream.provider';
import { CameraStreamProviderRegistryService } from '../../modules/cameras/services/camera-stream-provider.registry.service';
import { ConfigSecretsService } from '../../modules/config/services/config-secrets.service';
import { PluginsTypeMapperService } from '../../modules/config/services/plugins-type-mapper.service';
import { ChannelsTypeMapperService } from '../../modules/devices/services/channels-type-mapper.service';
import { ChannelsPropertiesTypeMapperService } from '../../modules/devices/services/channels.properties-type-mapper.service';
import { DevicesTypeMapperService } from '../../modules/devices/services/devices-type-mapper.service';
import { PlatformRegistryService } from '../../modules/devices/services/platform.registry.service';
import { ExtensionsService } from '../../modules/extensions/services/extensions.service';
import { ManagedServiceManagerService } from '../../modules/extensions/services/managed-service-manager.service';
import { ExtendedDiscriminatorService } from '../../modules/swagger/services/extended-discriminator.service';
import { SwaggerModelsRegistryService } from '../../modules/swagger/services/swagger-models-registry.service';
import { FactoryResetRegistryService } from '../../modules/system/services/factory-reset-registry.service';

import { ProtectAdoptionController } from './controllers/protect-adoption.controller';
import { ProtectDevicesController } from './controllers/protect-devices.controller';
import { ProtectDiscoveryController } from './controllers/protect-discovery.controller';
import { ProtectStatusController } from './controllers/protect-status.controller';
import { ProtectTestConnectionController } from './controllers/protect-test-connection.controller';
import { DEVICES_UNIFI_PROTECT_PLUGIN_NAME, DEVICES_UNIFI_PROTECT_TYPE } from './devices-unifi-protect.constants';
import { DEVICES_UNIFI_PROTECT_PLUGIN_SWAGGER_EXTRA_MODELS } from './devices-unifi-protect.openapi';
import { DevicesUnifiProtectPlugin } from './devices-unifi-protect.plugin';
import { CreateProtectChannelPropertyDto } from './dto/create-channel-property.dto';
import { CreateProtectChannelDto } from './dto/create-channel.dto';
import { CreateProtectDeviceDto } from './dto/create-device.dto';
import { ProtectProbeDto, ProtectProbeRequestDto } from './dto/protect-discovery-probe.dto';
import {
	ProtectTestCandidateConnectionDto,
	ProtectTestConnectionRequestDto,
	ProtectTestSavedConnectionDto,
	ProtectTestTlsDto,
} from './dto/test-connection.dto';
import { UpdateProtectChannelPropertyDto } from './dto/update-channel-property.dto';
import { UpdateProtectChannelDto } from './dto/update-channel.dto';
import { ProtectUpdatePluginConfigDto } from './dto/update-config.dto';
import { UpdateProtectDeviceDto } from './dto/update-device.dto';
import {
	ProtectChannelEntity,
	ProtectChannelPropertyEntity,
	ProtectDeviceEntity,
} from './entities/devices-unifi-protect.entity';
import { ProtectConfigModel } from './models/config.model';
import {
	ProtectDiscoveredConsoleModel,
	ProtectDiscoveryInterfaceModel,
	ProtectDiscoveryModel,
	ProtectDiscoveryResponseModel,
	ProtectProbeCertificateModel,
	ProtectProbeModel,
	ProtectProbeResponseModel,
} from './models/protect-discovery.model';
import { ProtectStatusModel, ProtectStatusResponseModel } from './models/status.model';
import {
	ProtectCertificateModel,
	ProtectTestConnectionModel,
	ProtectTestConnectionResponseModel,
} from './models/test-connection.model';
import { UnifiProtectDevicePlatform } from './platforms/unifi-protect-device.platform';
import { ProtectAdoptionLockService } from './services/protect-adoption-lock.service';
import { ProtectAdoptionService } from './services/protect-adoption.service';
import { ProtectConfigValidatorService } from './services/protect-config-validator.service';
import { ProtectConnectionTestService } from './services/protect-connection-test.service';
import { ProtectConnectorService } from './services/protect-connector.service';
import { ProtectDiscoveryProbeService } from './services/protect-discovery-probe.service';
import { ProtectDiscoveryService } from './services/protect-discovery.service';
import { ProtectInventoryService } from './services/protect-inventory.service';
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

const SECRET_FIELDS = [{ path: 'api_key', configuredPath: 'api_key_configured', inputPaths: ['apiKey'] }];

describe('DevicesUnifiProtectPlugin', () => {
	const build = () => {
		const configMapper = { registerMapping: jest.fn() };
		const devicesMapper = { registerMapping: jest.fn() };
		const channelsMapper = { registerMapping: jest.fn() };
		const propertiesMapper = { registerMapping: jest.fn() };
		const swaggerRegistry = { register: jest.fn() };
		const discriminators = { register: jest.fn() };
		const extensions = { registerPluginMetadata: jest.fn() };
		const managedServiceManager = { register: jest.fn() };
		const connector = {
			owner: { kind: 'plugin', type: DEVICES_UNIFI_PROTECT_PLUGIN_NAME },
			serviceId: 'connector',
			stop: jest.fn().mockResolvedValue(undefined),
		};
		let resetHandler: (() => Promise<{ success: boolean; reason?: string } | null>) | undefined;
		const factoryReset = {
			register: jest.fn((_name: string, handler: () => Promise<{ success: boolean; reason?: string } | null>) => {
				resetHandler = handler;
			}),
		};
		const platformRegistry = { register: jest.fn() };
		const devicePlatform = {} as UnifiProtectDevicePlatform;
		const registration = { dispose: jest.fn() };
		const streamProviders = { register: jest.fn().mockReturnValue(registration) };
		const streamProvider = { getType: () => DEVICES_UNIFI_PROTECT_TYPE } as unknown as UnifiProtectStreamProvider;
		const plugin = new DevicesUnifiProtectPlugin(
			configMapper as unknown as PluginsTypeMapperService,
			devicesMapper as unknown as DevicesTypeMapperService,
			channelsMapper as unknown as ChannelsTypeMapperService,
			propertiesMapper as unknown as ChannelsPropertiesTypeMapperService,
			swaggerRegistry as unknown as SwaggerModelsRegistryService,
			discriminators as unknown as ExtendedDiscriminatorService,
			extensions as unknown as ExtensionsService,
			managedServiceManager as unknown as ManagedServiceManagerService,
			connector as unknown as ProtectConnectorService,
			factoryReset as unknown as FactoryResetRegistryService,
			platformRegistry as unknown as PlatformRegistryService,
			devicePlatform,
			streamProviders as unknown as CameraStreamProviderRegistryService,
			streamProvider,
		);

		return {
			plugin,
			configMapper,
			devicesMapper,
			channelsMapper,
			propertiesMapper,
			swaggerRegistry,
			discriminators,
			extensions,
			managedServiceManager,
			connector,
			factoryReset,
			platformRegistry,
			devicePlatform,
			streamProviders,
			streamProvider,
			registration,
			runFactoryReset: () => {
				if (!resetHandler) {
					throw new Error('factory reset handler was not registered');
				}

				return resetHandler();
			},
		};
	};

	it('registers config, secret field, type mappers, discriminators and disabled-by-default metadata', () => {
		const { plugin, configMapper, devicesMapper, channelsMapper, propertiesMapper, discriminators, extensions } =
			build();

		plugin.onModuleInit();

		expect(configMapper.registerMapping).toHaveBeenCalledWith({
			type: DEVICES_UNIFI_PROTECT_PLUGIN_NAME,
			class: ProtectConfigModel,
			configDto: ProtectUpdatePluginConfigDto,
			secretFields: SECRET_FIELDS,
		});
		expect(DEVICES_UNIFI_PROTECT_PLUGIN_NAME).toBe('devices-unifi-protect-plugin');

		for (const mapper of [devicesMapper, channelsMapper, propertiesMapper]) {
			expect(mapper.registerMapping).toHaveBeenCalledTimes(1);
			expect(mapper.registerMapping).toHaveBeenCalledWith(
				expect.objectContaining({ type: DEVICES_UNIFI_PROTECT_TYPE }),
			);
		}

		expect(discriminators.register).toHaveBeenCalledTimes(9);
		for (const call of discriminators.register.mock.calls as [{ discriminatorValue: string }][]) {
			expect(call[0].discriminatorValue).toBe(DEVICES_UNIFI_PROTECT_TYPE);
		}

		expect(extensions.registerPluginMetadata).toHaveBeenCalledWith(
			expect.objectContaining({
				type: DEVICES_UNIFI_PROTECT_PLUGIN_NAME,
				name: 'UniFi Protect',
				defaultEnabled: false,
			}),
		);

		const metadata = (extensions.registerPluginMetadata.mock.calls[0] as unknown as [{ readme: string }])[0];

		expect(metadata.readme).toMatch(/7\.2\.105/);
		expect(metadata.readme).toContain('## What you get');
		expect(metadata.readme).toContain('## Setup');
		expect(metadata.readme).toContain('## Configuration');
		expect(metadata.readme).toContain('## TLS');
		expect(metadata.readme).toContain('## Boundaries');
		expect(metadata.readme).toContain('## Real-time updates');
		expect(metadata.readme).toContain('clear after 60 s');
		expect(metadata.readme).toContain('There is no insecure mode');
		expect(metadata.readme).toContain('never disables a camera microphone');
		expect(metadata.readme).toContain('never deletes a stream');
		expect(metadata.readme).not.toContain('creates no devices yet');
		expect(metadata.readme).toContain('## Control');
		expect(metadata.readme).toContain('microphone volume');
		expect(metadata.readme).not.toContain('never changes other console settings');
		expect(metadata.readme).toContain('## Streams and snapshots');
		expect(metadata.readme).toContain('stream_tls_unverified');
		expect(metadata.readme).not.toContain('rtspx');
		expect(metadata.readme).not.toContain('Host clients use');
	});

	it('registers the connector as a managed service and a factory-reset handler', async () => {
		const { plugin, managedServiceManager, connector, factoryReset, runFactoryReset } = build();

		plugin.onModuleInit();

		expect(managedServiceManager.register).toHaveBeenCalledTimes(1);
		expect(managedServiceManager.register).toHaveBeenCalledWith(connector);
		expect(factoryReset.register).toHaveBeenCalledWith(DEVICES_UNIFI_PROTECT_PLUGIN_NAME, expect.any(Function), 90);

		await expect(runFactoryReset()).resolves.toEqual({ success: true });
		expect(connector.stop).toHaveBeenCalledTimes(1);
	});

	it('registers the device platform for the plugin type', () => {
		const { plugin, platformRegistry, devicePlatform } = build();

		plugin.onModuleInit();

		expect(platformRegistry.register).toHaveBeenCalledTimes(1);
		expect(platformRegistry.register).toHaveBeenCalledWith(devicePlatform);
	});

	it('reports a factory-reset failure without leaking the error details beyond its message', async () => {
		const { plugin, connector, runFactoryReset } = build();

		connector.stop.mockRejectedValueOnce(new Error('stop failed'));
		plugin.onModuleInit();

		await expect(runFactoryReset()).resolves.toEqual({ success: false, reason: 'stop failed' });
	});

	it('provides and exports the connector and serves the status, test-connection and discovery controllers', () => {
		const providers = Reflect.getMetadata('providers', DevicesUnifiProtectPlugin) as unknown[];
		const controllers = Reflect.getMetadata('controllers', DevicesUnifiProtectPlugin) as unknown[];
		const exported = Reflect.getMetadata('exports', DevicesUnifiProtectPlugin) as unknown[];

		expect(providers).toContain(ProtectConnectorService);
		expect(providers).toContain(ProtectConnectionTestService);
		expect(providers).toEqual(expect.arrayContaining([ProtectDiscoveryService, ProtectDiscoveryProbeService]));
		expect(controllers).toEqual([
			ProtectStatusController,
			ProtectTestConnectionController,
			ProtectDiscoveryController,
			ProtectDevicesController,
			ProtectAdoptionController,
		]);
		expect(providers).toContain(ProtectInventoryService);
		expect(providers).toContain(UnifiProtectDevicePlatform);
		expect(providers).toEqual(expect.arrayContaining([ProtectSynchronizerService, ProtectRealtimeService]));
		expect(providers).toContainEqual({
			provide: PROTECT_REALTIME_TIMINGS,
			useValue: PROTECT_DEFAULT_REALTIME_TIMINGS,
		});
		expect(providers).toEqual(expect.arrayContaining([ProtectAdoptionLockService, ProtectAdoptionService]));
		expect(exported).not.toContain(ProtectDiscoveryService);
		expect(exported).toContain(ProtectConnectorService);
		expect(DEVICES_UNIFI_PROTECT_PLUGIN_SWAGGER_EXTRA_MODELS).toEqual(
			expect.arrayContaining([
				ProtectStatusModel,
				ProtectStatusResponseModel,
				ProtectTestConnectionRequestDto,
				ProtectTestSavedConnectionDto,
				ProtectTestCandidateConnectionDto,
				ProtectTestTlsDto,
				ProtectCertificateModel,
				ProtectTestConnectionModel,
				ProtectTestConnectionResponseModel,
				ProtectDiscoveryInterfaceModel,
				ProtectProbeCertificateModel,
				ProtectProbeModel,
				ProtectDiscoveredConsoleModel,
				ProtectDiscoveryModel,
				ProtectDiscoveryResponseModel,
				ProtectProbeResponseModel,
				ProtectProbeDto,
				ProtectProbeRequestDto,
			]),
		);
	});

	it('maps the Protect type to the Protect entity and DTO classes in every type mapper', () => {
		const { plugin, devicesMapper, channelsMapper, propertiesMapper } = build();

		plugin.onModuleInit();

		expect(devicesMapper.registerMapping).toHaveBeenCalledWith({
			type: DEVICES_UNIFI_PROTECT_TYPE,
			class: ProtectDeviceEntity,
			createDto: CreateProtectDeviceDto,
			updateDto: UpdateProtectDeviceDto,
			requiresCreationContext: true,
		});
		expect(channelsMapper.registerMapping).toHaveBeenCalledWith({
			type: DEVICES_UNIFI_PROTECT_TYPE,
			class: ProtectChannelEntity,
			createDto: CreateProtectChannelDto,
			updateDto: UpdateProtectChannelDto,
		});
		expect(propertiesMapper.registerMapping).toHaveBeenCalledWith({
			type: DEVICES_UNIFI_PROTECT_TYPE,
			class: ProtectChannelPropertyEntity,
			createDto: CreateProtectChannelPropertyDto,
			updateDto: UpdateProtectChannelPropertyDto,
		});
	});

	it('registers the stream provider for the plugin type', () => {
		const { plugin, streamProviders, streamProvider } = build();

		plugin.onModuleInit();

		expect(streamProviders.register).toHaveBeenCalledTimes(1);
		expect(streamProviders.register).toHaveBeenCalledWith(streamProvider);
	});

	it('serves the provider from the real registry until destroy', () => {
		const { plugin, streamProviders, streamProvider } = build();
		const registry = new CameraStreamProviderRegistryService();

		streamProviders.register.mockImplementation((provider: ICameraStreamProvider) => registry.register(provider));

		plugin.onModuleInit();

		expect(registry.get({ type: DEVICES_UNIFI_PROTECT_TYPE })).toBe(streamProvider);

		plugin.onModuleDestroy();

		expect(registry.get({ type: DEVICES_UNIFI_PROTECT_TYPE })).toBeNull();
	});

	it('releases the stream provider on destroy', () => {
		const { plugin, registration } = build();

		plugin.onModuleInit();
		plugin.onModuleDestroy();
		plugin.onModuleDestroy();

		expect(registration.dispose).toHaveBeenCalledTimes(1);
	});

	it('does not fail destroy when the stream provider was never registered', () => {
		const { plugin, streamProviders, registration } = build();

		streamProviders.register.mockReturnValue(null);

		expect(() => plugin.onModuleDestroy()).not.toThrow();
		expect(registration.dispose).not.toHaveBeenCalled();
	});

	it('logs once when the provider type is already taken', () => {
		const { plugin, streamProviders } = build();
		const warn = jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);

		streamProviders.register.mockReturnValue(null);

		try {
			plugin.onModuleInit();
			plugin.onModuleDestroy();

			const lines = warn.mock.calls.filter((call) =>
				String(call[0]).includes('UniFi Protect stream provider was not registered'),
			);

			expect(lines).toHaveLength(1);
		} finally {
			warn.mockRestore();
		}
	});

	it('registers every extra swagger model', () => {
		const { plugin, swaggerRegistry } = build();

		plugin.onModuleInit();

		expect(DEVICES_UNIFI_PROTECT_PLUGIN_SWAGGER_EXTRA_MODELS).toEqual(
			expect.arrayContaining([ProtectConfigModel, ProtectUpdatePluginConfigDto, ProtectDeviceEntity]),
		);
		expect(swaggerRegistry.register).toHaveBeenCalledTimes(DEVICES_UNIFI_PROTECT_PLUGIN_SWAGGER_EXTRA_MODELS.length);
	});

	it('projects the registered secret field as api_key_configured and never exposes the key', () => {
		const { plugin, configMapper } = build();

		plugin.onModuleInit();

		const registration = (
			configMapper.registerMapping.mock.calls[0] as unknown as [{ secretFields: typeof SECRET_FIELDS }]
		)[0];
		const config = Object.assign(new ProtectConfigModel(), {
			host: 'protect.local',
			apiKey: 'PROTECT_SENTINEL_KEY_7f3a9c0d1e2b4a6f',
		});
		const projected = new ConfigSecretsService().toPublic(config, registration.secretFields) as unknown as Record<
			string,
			unknown
		>;

		expect(projected).toHaveProperty('api_key_configured', true);
		expect(projected).not.toHaveProperty('api_key');
		expect(projected).not.toHaveProperty('apiKey');
		expect(JSON.stringify(projected)).not.toContain('PROTECT_SENTINEL_KEY_7f3a9c0d1e2b4a6f');
	});

	it('provides the config validator and imports the device, config, extension and cameras modules', () => {
		const providers = Reflect.getMetadata('providers', DevicesUnifiProtectPlugin) as unknown[];
		const imports = Reflect.getMetadata('imports', DevicesUnifiProtectPlugin) as unknown[];

		expect(providers).toContain(ProtectConfigValidatorService);
		expect(providers).toEqual(
			expect.arrayContaining([
				ProtectStreamAvailabilityStore,
				ProtectStreamAvailabilityService,
				ProtectStreamBridgeService,
				UnifiProtectStreamProvider,
			]),
		);
		expect(imports).toHaveLength(6);
		// The stream bridge needs the relay's state (`Go2rtcService`), which the cameras module exports.
		expect(imports).toContain(CamerasModule);
	});

	it('is wired into the application router', () => {
		const source = readFileSync(resolve(__dirname, '../../app.module.ts'), 'utf8');

		expect(source).toMatch(/path: DEVICES_UNIFI_PROTECT_PLUGIN_PREFIX,\s*module: DevicesUnifiProtectPlugin,/);
		expect(source).toMatch(/RemoteAccessCloudflareTunnelPlugin,\s*DevicesUnifiProtectPlugin,/);
	});
});
