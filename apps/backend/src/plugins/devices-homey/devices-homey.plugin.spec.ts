import { PluginsTypeMapperService } from '../../modules/config/services/plugins-type-mapper.service';
import { ChannelsTypeMapperService } from '../../modules/devices/services/channels-type-mapper.service';
import { ChannelsPropertiesTypeMapperService } from '../../modules/devices/services/channels.properties-type-mapper.service';
import { DevicesTypeMapperService } from '../../modules/devices/services/devices-type-mapper.service';
import { PlatformRegistryService } from '../../modules/devices/services/platform.registry.service';
import { ExtensionsService } from '../../modules/extensions/services/extensions.service';
import { PluginServiceManagerService } from '../../modules/extensions/services/plugin-service-manager.service';
import { ExtendedDiscriminatorService } from '../../modules/swagger/services/extended-discriminator.service';
import { SwaggerModelsRegistryService } from '../../modules/swagger/services/swagger-models-registry.service';
import { FactoryResetRegistryService } from '../../modules/system/services/factory-reset-registry.service';

import { HomeyLocalConnectorFactory } from './connectors/homey-local-connector.factory';
import { HomeySdkClientFactoryService } from './connectors/homey-sdk.client';
import { HomeyAdoptionController } from './controllers/homey-adoption.controller';
import { HomeyDevicesController } from './controllers/homey-devices.controller';
import { HomeyMappingPreviewController } from './controllers/homey-mapping-preview.controller';
import { HomeyTestConnectionController } from './controllers/homey-test-connection.controller';
import { DEVICES_HOMEY_PLUGIN_NAME, DEVICES_HOMEY_TYPE, HOMEY_CONNECTOR_FACTORY } from './devices-homey.constants';
import { DEVICES_HOMEY_PLUGIN_SWAGGER_EXTRA_MODELS } from './devices-homey.openapi';
import { DevicesHomeyPlugin } from './devices-homey.plugin';
import { HomeyUpdatePluginConfigDto } from './dto/update-config.dto';
import { HomeyConfigModel } from './models/config.model';
import { HomeyDevicePlatform } from './platforms/homey-device.platform';
import { HomeyLegacyConfigCleanupService } from './services/homey-legacy-config-cleanup.service';
import { HomeyService } from './services/homey.service';

describe('DevicesHomeyPlugin', () => {
	it('registers locally stored configuration and managed lifecycle', async () => {
		const configMapper = { registerMapping: jest.fn() };
		const devicesMapper = { registerMapping: jest.fn() };
		const channelsMapper = { registerMapping: jest.fn() };
		const propertiesMapper = { registerMapping: jest.fn() };
		const swaggerRegistry = { register: jest.fn() };
		const discriminatorRegistry = { register: jest.fn() };
		const extensionsService = { registerPluginMetadata: jest.fn() };
		const pluginServiceManager = { register: jest.fn() };
		const platformRegistry = { register: jest.fn() };
		const homeyService = {
			pluginName: DEVICES_HOMEY_PLUGIN_NAME,
			serviceId: 'connector',
			stop: jest.fn().mockResolvedValue(undefined),
		};
		const homeyDevicePlatform = { getType: () => DEVICES_HOMEY_TYPE };
		const legacyConfigCleanup = { cleanup: jest.fn() };
		let resetHandler: (() => Promise<{ success: boolean; reason?: string } | null>) | undefined;
		const factoryResetRegistry = {
			register: jest.fn((_name: string, handler: () => Promise<{ success: boolean; reason?: string } | null>) => {
				resetHandler = handler;
			}),
		};
		const plugin = new DevicesHomeyPlugin(
			configMapper as unknown as PluginsTypeMapperService,
			devicesMapper as unknown as DevicesTypeMapperService,
			channelsMapper as unknown as ChannelsTypeMapperService,
			propertiesMapper as unknown as ChannelsPropertiesTypeMapperService,
			swaggerRegistry as unknown as SwaggerModelsRegistryService,
			discriminatorRegistry as unknown as ExtendedDiscriminatorService,
			extensionsService as unknown as ExtensionsService,
			pluginServiceManager as unknown as PluginServiceManagerService,
			homeyService as unknown as HomeyService,
			platformRegistry as unknown as PlatformRegistryService,
			homeyDevicePlatform as unknown as HomeyDevicePlatform,
			legacyConfigCleanup as unknown as HomeyLegacyConfigCleanupService,
			factoryResetRegistry as unknown as FactoryResetRegistryService,
		);

		plugin.onModuleInit();

		expect(configMapper.registerMapping).toHaveBeenCalledWith({
			type: DEVICES_HOMEY_PLUGIN_NAME,
			class: HomeyConfigModel,
			configDto: HomeyUpdatePluginConfigDto,
			secretFields: [{ path: 'api_key', configuredPath: 'api_key_configured', inputPaths: ['apiKey'] }],
		});
		expect(legacyConfigCleanup.cleanup).toHaveBeenCalledTimes(1);
		expect(devicesMapper.registerMapping).toHaveBeenCalledWith(expect.objectContaining({ type: DEVICES_HOMEY_TYPE }));
		expect(channelsMapper.registerMapping).toHaveBeenCalledWith(expect.objectContaining({ type: DEVICES_HOMEY_TYPE }));
		expect(propertiesMapper.registerMapping).toHaveBeenCalledWith(
			expect.objectContaining({ type: DEVICES_HOMEY_TYPE }),
		);
		expect(discriminatorRegistry.register).toHaveBeenCalledTimes(9);
		expect(swaggerRegistry.register).toHaveBeenCalledTimes(DEVICES_HOMEY_PLUGIN_SWAGGER_EXTRA_MODELS.length);
		expect(extensionsService.registerPluginMetadata).toHaveBeenCalledWith(
			expect.objectContaining({ type: DEVICES_HOMEY_PLUGIN_NAME, name: 'Homey', defaultEnabled: false }),
		);
		expect(pluginServiceManager.register).toHaveBeenCalledWith(homeyService);
		expect(platformRegistry.register).toHaveBeenCalledWith(homeyDevicePlatform);
		expect(factoryResetRegistry.register).toHaveBeenCalledWith(DEVICES_HOMEY_PLUGIN_NAME, expect.any(Function), 90);
		if (!resetHandler) throw new Error('Homey factory reset handler was not registered');
		await expect(resetHandler()).resolves.toEqual({ success: true });
		expect(homeyService.stop).toHaveBeenCalledTimes(1);
	});

	it('provides the local SDK-backed connector factory through the transport-neutral token', () => {
		const providers = Reflect.getMetadata('providers', DevicesHomeyPlugin) as unknown[];
		const controllers = Reflect.getMetadata('controllers', DevicesHomeyPlugin) as unknown[];

		expect(providers).toEqual(expect.arrayContaining([HomeySdkClientFactoryService, HomeyLocalConnectorFactory]));
		expect(providers).toContainEqual({ provide: HOMEY_CONNECTOR_FACTORY, useExisting: HomeyLocalConnectorFactory });
		expect(controllers).toEqual(
			expect.arrayContaining([
				HomeyTestConnectionController,
				HomeyDevicesController,
				HomeyMappingPreviewController,
				HomeyAdoptionController,
			]),
		);
	});
});
