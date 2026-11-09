import { PluginsTypeMapperService } from '../../modules/config/services/plugins-type-mapper.service';
import { ChannelsTypeMapperService } from '../../modules/devices/services/channels-type-mapper.service';
import { ChannelsPropertiesTypeMapperService } from '../../modules/devices/services/channels.properties-type-mapper.service';
import { DevicesTypeMapperService } from '../../modules/devices/services/devices-type-mapper.service';
import { PlatformRegistryService } from '../../modules/devices/services/platform.registry.service';
import { ExtensionsService } from '../../modules/extensions/services/extensions.service';
import { ManagedServiceManagerService } from '../../modules/extensions/services/managed-service-manager.service';
import { ExtendedDiscriminatorService } from '../../modules/swagger/services/extended-discriminator.service';
import { SwaggerModelsRegistryService } from '../../modules/swagger/services/swagger-models-registry.service';

import { DEVICES_MODBUS_PLUGIN_NAME, DEVICES_MODBUS_TYPE } from './devices-modbus.constants';
import { DevicesModbusPlugin } from './devices-modbus.plugin';
import { ModbusUpdatePluginConfigDto } from './dto/update-config.dto';
import { ModbusConfigModel } from './models/config.model';
import { ModbusDevicePlatform } from './platforms/modbus.device.platform';
import { ModbusRuntimeService } from './services/modbus-runtime.service';

describe('DevicesModbusPlugin', () => {
	const registerMapping = (): { registerMapping: jest.Mock } => ({ registerMapping: jest.fn() });

	const configMapper = registerMapping();
	const devicesMapper = registerMapping();
	const channelsMapper = registerMapping();
	const channelsPropertiesMapper = registerMapping();
	const platformRegistryService = { register: jest.fn() };
	const swaggerRegistry = { register: jest.fn() };
	const discriminatorRegistry = { register: jest.fn() };
	const extensionsService = { registerPluginMetadata: jest.fn() };
	const managedServiceManager = { register: jest.fn() };
	const platform = new ModbusDevicePlatform();
	const runtime = new ModbusRuntimeService();

	beforeEach(() => {
		jest.clearAllMocks();

		new DevicesModbusPlugin(
			configMapper as unknown as PluginsTypeMapperService,
			runtime,
			devicesMapper as unknown as DevicesTypeMapperService,
			channelsMapper as unknown as ChannelsTypeMapperService,
			channelsPropertiesMapper as unknown as ChannelsPropertiesTypeMapperService,
			platform,
			platformRegistryService as unknown as PlatformRegistryService,
			swaggerRegistry as unknown as SwaggerModelsRegistryService,
			discriminatorRegistry as unknown as ExtendedDiscriminatorService,
			extensionsService as unknown as ExtensionsService,
			managedServiceManager as unknown as ManagedServiceManagerService,
		).onModuleInit();
	});

	it('registers the plugin config mapping', () => {
		expect(configMapper.registerMapping).toHaveBeenCalledWith({
			type: DEVICES_MODBUS_PLUGIN_NAME,
			class: ModbusConfigModel,
			configDto: ModbusUpdatePluginConfigDto,
		});
		expect(DEVICES_MODBUS_PLUGIN_NAME).toBe('devices-modbus-plugin');
	});

	it('registers device, channel and property type mappings', () => {
		for (const mapper of [devicesMapper, channelsMapper, channelsPropertiesMapper]) {
			expect(mapper.registerMapping).toHaveBeenCalledTimes(1);
			expect(mapper.registerMapping).toHaveBeenCalledWith(expect.objectContaining({ type: DEVICES_MODBUS_TYPE }));
		}
		expect(DEVICES_MODBUS_TYPE).toBe('devices-modbus');
	});

	it('registers the platform', () => {
		expect(platformRegistryService.register).toHaveBeenCalledWith(platform);
	});

	it('registers nine discriminators for the modbus type', () => {
		expect(discriminatorRegistry.register).toHaveBeenCalledTimes(9);
		for (const [arg] of discriminatorRegistry.register.mock.calls as Array<[{ discriminatorValue: string }]>) {
			expect(arg.discriminatorValue).toBe('devices-modbus');
		}
	});

	it('registers the runtime as a managed service', () => {
		expect(managedServiceManager.register).toHaveBeenCalledWith(runtime);
	});
});
