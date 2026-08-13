import { PluginsTypeMapperService } from '../../modules/config/services/plugins-type-mapper.service';
import { ChannelsTypeMapperService } from '../../modules/devices/services/channels-type-mapper.service';
import { ChannelsPropertiesTypeMapperService } from '../../modules/devices/services/channels.properties-type-mapper.service';
import { DevicesTypeMapperService } from '../../modules/devices/services/devices-type-mapper.service';
import { ExtensionsService } from '../../modules/extensions/services/extensions.service';
import { PluginServiceManagerService } from '../../modules/extensions/services/plugin-service-manager.service';
import { ExtendedDiscriminatorService } from '../../modules/swagger/services/extended-discriminator.service';
import { SwaggerModelsRegistryService } from '../../modules/swagger/services/swagger-models-registry.service';

import { DEVICES_HOMEY_PLUGIN_NAME, DEVICES_HOMEY_TYPE } from './devices-homey.constants';
import { DEVICES_HOMEY_PLUGIN_SWAGGER_EXTRA_MODELS } from './devices-homey.openapi';
import { DevicesHomeyPlugin } from './devices-homey.plugin';
import { HomeyUpdatePluginConfigDto } from './dto/update-config.dto';
import { HomeyConfigModel } from './models/config.model';
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
		const homeyService = { pluginName: DEVICES_HOMEY_PLUGIN_NAME, serviceId: 'connector' };

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
	});
});
