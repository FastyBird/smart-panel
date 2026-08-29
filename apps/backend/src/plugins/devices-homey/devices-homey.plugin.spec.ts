import { ConfigModule as NestConfigModule } from '@nestjs/config';

import { PluginsTypeMapperService } from '../../modules/config/services/plugins-type-mapper.service';
import { ChannelsTypeMapperService } from '../../modules/devices/services/channels-type-mapper.service';
import { ChannelsPropertiesTypeMapperService } from '../../modules/devices/services/channels.properties-type-mapper.service';
import { DevicesTypeMapperService } from '../../modules/devices/services/devices-type-mapper.service';
import { PlatformRegistryService } from '../../modules/devices/services/platform.registry.service';
import { ExtensionsService } from '../../modules/extensions/services/extensions.service';
import { PluginServiceManagerService } from '../../modules/extensions/services/plugin-service-manager.service';
import { ExtendedDiscriminatorService } from '../../modules/swagger/services/extended-discriminator.service';
import { SwaggerModelsRegistryService } from '../../modules/swagger/services/swagger-models-registry.service';
import { UserLifecycleMutationRegistryService } from '../../modules/users/services/user-lifecycle-mutation-registry.service';

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
import { HomeyMappingLoaderService } from './mappings/mapping-loader.service';
import { HomeyMappingTransformerService } from './mappings/mapping-transformer.service';
import { HomeyPropertyMappingStorageService } from './mappings/property-mapping-storage.service';
import { HomeyConfigModel } from './models/config.model';
import { HomeyDevicePlatform } from './platforms/homey-device.platform';
import { HomeyAdoptionLockService } from './services/homey-adoption-lock.service';
import { HomeyCloudAuthorizationStateService } from './services/homey-cloud-authorization-state.service';
import { HomeyCloudClientConfigService } from './services/homey-cloud-client-config.service';
import { HomeyCloudGrantMutationService } from './services/homey-cloud-grant-mutation.service';
import { HomeyConnectionTestService } from './services/homey-connection-test.service';
import { HomeyDeviceAdoptionService } from './services/homey-device-adoption.service';
import { HomeyDeviceInventoryService } from './services/homey-device-inventory.service';
import { HomeyMappingPreviewService } from './services/homey-mapping-preview.service';
import { HomeySynchronizerService } from './services/homey-synchronizer.service';
import { HomeyService } from './services/homey.service';

describe('DevicesHomeyPlugin', () => {
	it('registers config, entities, discriminators, metadata, Swagger models, and managed lifecycle', () => {
		const configMapper = { registerMapping: jest.fn() };
		const devicesMapper = { registerMapping: jest.fn() };
		const channelsMapper = { registerMapping: jest.fn() };
		const propertiesMapper = { registerMapping: jest.fn() };
		const swaggerRegistry = { register: jest.fn() };
		const discriminatorRegistry = { register: jest.fn() };
		const extensionsService = { registerPluginMetadata: jest.fn() };
		const pluginServiceManager = { register: jest.fn() };
		const platformRegistry = { register: jest.fn() };
		const homeyService = { pluginName: DEVICES_HOMEY_PLUGIN_NAME, serviceId: 'connector' };
		const homeyDevicePlatform = { getType: () => DEVICES_HOMEY_TYPE };
		const userLifecycleMutations = { registerParticipant: jest.fn() };
		const homeyCloudGrantMutations = {};

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
			userLifecycleMutations as unknown as UserLifecycleMutationRegistryService,
			homeyCloudGrantMutations as unknown as HomeyCloudGrantMutationService,
		);

		plugin.onModuleInit();

		expect(configMapper.registerMapping).toHaveBeenCalledWith({
			type: DEVICES_HOMEY_PLUGIN_NAME,
			class: HomeyConfigModel,
			configDto: HomeyUpdatePluginConfigDto,
			secretFields: [
				{
					path: 'api_key',
					configuredPath: 'api_key_configured',
					inputPaths: ['apiKey'],
				},
			],
		});
		expect(devicesMapper.registerMapping).toHaveBeenCalledWith(expect.objectContaining({ type: DEVICES_HOMEY_TYPE }));
		expect(channelsMapper.registerMapping).toHaveBeenCalledWith(expect.objectContaining({ type: DEVICES_HOMEY_TYPE }));
		expect(propertiesMapper.registerMapping).toHaveBeenCalledWith(
			expect.objectContaining({ type: DEVICES_HOMEY_TYPE }),
		);
		expect(discriminatorRegistry.register).toHaveBeenCalledTimes(9);
		expect(discriminatorRegistry.register).toHaveBeenCalledWith(
			expect.objectContaining({ discriminatorProperty: 'type', discriminatorValue: DEVICES_HOMEY_TYPE }),
		);
		expect(swaggerRegistry.register).toHaveBeenCalledTimes(DEVICES_HOMEY_PLUGIN_SWAGGER_EXTRA_MODELS.length);
		expect(extensionsService.registerPluginMetadata).toHaveBeenCalledWith(
			expect.objectContaining({ type: DEVICES_HOMEY_PLUGIN_NAME, name: 'Homey', defaultEnabled: false }),
		);
		expect(pluginServiceManager.register).toHaveBeenCalledWith(homeyService);
		expect(platformRegistry.register).toHaveBeenCalledWith(homeyDevicePlatform);
		expect(userLifecycleMutations.registerParticipant).toHaveBeenCalledWith(homeyCloudGrantMutations);
	});

	it('provides a production SDK-backed connector factory through the transport-neutral token', () => {
		const imports = Reflect.getMetadata('imports', DevicesHomeyPlugin) as unknown[];
		const providers = Reflect.getMetadata('providers', DevicesHomeyPlugin) as unknown[];
		const controllers = Reflect.getMetadata('controllers', DevicesHomeyPlugin) as unknown[];

		expect(providers).toEqual(
			expect.arrayContaining([
				HomeySdkClientFactoryService,
				HomeyCloudClientConfigService,
				HomeyCloudAuthorizationStateService,
				HomeyCloudGrantMutationService,
				HomeyLocalConnectorFactory,
				HomeyConnectionTestService,
				HomeyMappingLoaderService,
				HomeyMappingTransformerService,
				HomeyPropertyMappingStorageService,
				HomeyDeviceInventoryService,
				HomeyMappingPreviewService,
				HomeyAdoptionLockService,
				HomeyDeviceAdoptionService,
				HomeySynchronizerService,
				HomeyDevicePlatform,
			]),
		);
		expect(providers).toContainEqual({
			provide: HOMEY_CONNECTOR_FACTORY,
			useExisting: HomeyLocalConnectorFactory,
		});
		expect(imports).toContain(NestConfigModule);
		expect(controllers).toContain(HomeyTestConnectionController);
		expect(controllers).toContain(HomeyDevicesController);
		expect(controllers).toContain(HomeyMappingPreviewController);
		expect(controllers).toContain(HomeyAdoptionController);
	});
});
