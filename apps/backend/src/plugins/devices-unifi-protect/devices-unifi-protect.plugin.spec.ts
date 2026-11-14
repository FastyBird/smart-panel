import { readFileSync } from 'fs';
import { resolve } from 'path';

import { ConfigSecretsService } from '../../modules/config/services/config-secrets.service';
import { PluginsTypeMapperService } from '../../modules/config/services/plugins-type-mapper.service';
import { ChannelsTypeMapperService } from '../../modules/devices/services/channels-type-mapper.service';
import { ChannelsPropertiesTypeMapperService } from '../../modules/devices/services/channels.properties-type-mapper.service';
import { DevicesTypeMapperService } from '../../modules/devices/services/devices-type-mapper.service';
import { ExtensionsService } from '../../modules/extensions/services/extensions.service';
import { ManagedServiceManagerService } from '../../modules/extensions/services/managed-service-manager.service';
import { ExtendedDiscriminatorService } from '../../modules/swagger/services/extended-discriminator.service';
import { SwaggerModelsRegistryService } from '../../modules/swagger/services/swagger-models-registry.service';
import { FactoryResetRegistryService } from '../../modules/system/services/factory-reset-registry.service';

import { ProtectStatusController } from './controllers/protect-status.controller';
import { ProtectTestConnectionController } from './controllers/protect-test-connection.controller';
import { DEVICES_UNIFI_PROTECT_PLUGIN_NAME, DEVICES_UNIFI_PROTECT_TYPE } from './devices-unifi-protect.constants';
import { DEVICES_UNIFI_PROTECT_PLUGIN_SWAGGER_EXTRA_MODELS } from './devices-unifi-protect.openapi';
import { DevicesUnifiProtectPlugin } from './devices-unifi-protect.plugin';
import { CreateProtectChannelPropertyDto } from './dto/create-channel-property.dto';
import { CreateProtectChannelDto } from './dto/create-channel.dto';
import { CreateProtectDeviceDto } from './dto/create-device.dto';
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
import { ProtectStatusModel, ProtectStatusResponseModel } from './models/status.model';
import {
	ProtectCertificateModel,
	ProtectTestConnectionModel,
	ProtectTestConnectionResponseModel,
} from './models/test-connection.model';
import { ProtectConfigValidatorService } from './services/protect-config-validator.service';
import { ProtectConnectionTestService } from './services/protect-connection-test.service';
import { ProtectConnectorService } from './services/protect-connector.service';

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
		expect(metadata.readme).toContain('There is no insecure mode');
		expect(metadata.readme).toContain('never disables a camera microphone');
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

	it('reports a factory-reset failure without leaking the error details beyond its message', async () => {
		const { plugin, connector, runFactoryReset } = build();

		connector.stop.mockRejectedValueOnce(new Error('stop failed'));
		plugin.onModuleInit();

		await expect(runFactoryReset()).resolves.toEqual({ success: false, reason: 'stop failed' });
	});

	it('provides and exports the connector and serves the status and test-connection controllers', () => {
		const providers = Reflect.getMetadata('providers', DevicesUnifiProtectPlugin) as unknown[];
		const controllers = Reflect.getMetadata('controllers', DevicesUnifiProtectPlugin) as unknown[];
		const exported = Reflect.getMetadata('exports', DevicesUnifiProtectPlugin) as unknown[];

		expect(providers).toContain(ProtectConnectorService);
		expect(providers).toContain(ProtectConnectionTestService);
		expect(controllers).toEqual([ProtectStatusController, ProtectTestConnectionController]);
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

	it('provides the config validator and imports the device, config and extension modules', () => {
		const providers = Reflect.getMetadata('providers', DevicesUnifiProtectPlugin) as unknown[];
		const imports = Reflect.getMetadata('imports', DevicesUnifiProtectPlugin) as unknown[];

		expect(providers).toContain(ProtectConfigValidatorService);
		expect(imports).toHaveLength(5);
	});

	it('is wired into the application router', () => {
		const source = readFileSync(resolve(__dirname, '../../app.module.ts'), 'utf8');

		expect(source).toMatch(/path: DEVICES_UNIFI_PROTECT_PLUGIN_PREFIX,\s*module: DevicesUnifiProtectPlugin,/);
		expect(source).toMatch(/RemoteAccessCloudflareTunnelPlugin,\s*DevicesUnifiProtectPlugin,/);
	});
});
