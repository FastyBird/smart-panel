/* eslint-disable @typescript-eslint/unbound-method */
import { BadRequestException } from '@nestjs/common';

import { ConfigService } from '../../modules/config/services/config.service';
import {
	PluginConfigCommit,
	PluginConfigMutationHandler,
	PluginConfigMutationRegistryService,
} from '../../modules/config/services/plugin-config-mutation-registry.service';
import { PluginsTypeMapperService } from '../../modules/config/services/plugins-type-mapper.service';
import { DeviceEntity } from '../../modules/devices/entities/devices.entity';
import { DevicesService } from '../../modules/devices/services/devices.service';
import { ExtensionsService } from '../../modules/extensions/services/extensions.service';
import { ManagedServiceManagerService } from '../../modules/extensions/services/managed-service-manager.service';
import { SwaggerModelsRegistryService } from '../../modules/swagger/services/swagger-models-registry.service';

import { DEVICES_HOMEKIT_PLUGIN_NAME } from './devices-homekit.constants';
import { DevicesHomeKitPlugin } from './devices-homekit.plugin';
import { HomeKitUpdatePluginConfigDto } from './dto/update-config.dto';
import { HomeKitConfigModel } from './models/config.model';
import { HomeKitBridgeService } from './services/homekit-bridge.service';
import { HomeKitMapperRegistryService } from './services/homekit-mapper-registry.service';

describe('DevicesHomeKitPlugin', () => {
	let plugin: DevicesHomeKitPlugin;
	let configMapper: jest.Mocked<PluginsTypeMapperService>;
	let swaggerRegistry: jest.Mocked<SwaggerModelsRegistryService>;
	let extensionsService: jest.Mocked<ExtensionsService>;
	let managedServiceManager: jest.Mocked<ManagedServiceManagerService>;
	let homeKitBridgeService: jest.Mocked<HomeKitBridgeService>;
	let pluginConfigMutations: jest.Mocked<PluginConfigMutationRegistryService>;
	let devicesService: jest.Mocked<DevicesService>;
	let mapperRegistry: jest.Mocked<HomeKitMapperRegistryService>;
	let configService: jest.Mocked<ConfigService>;
	let mutationHandler: PluginConfigMutationHandler<HomeKitUpdatePluginConfigDto>;

	beforeEach(() => {
		configMapper = {
			registerMapping: jest.fn(),
		} as unknown as jest.Mocked<PluginsTypeMapperService>;

		swaggerRegistry = {
			register: jest.fn(),
		} as unknown as jest.Mocked<SwaggerModelsRegistryService>;

		extensionsService = {
			registerPluginMetadata: jest.fn(),
		} as unknown as jest.Mocked<ExtensionsService>;

		managedServiceManager = { register: jest.fn() } as unknown as jest.Mocked<ManagedServiceManagerService>;

		homeKitBridgeService = {
			reconcileLatestMapping: jest.fn().mockResolvedValue(undefined),
		} as unknown as jest.Mocked<HomeKitBridgeService>;

		pluginConfigMutations = {
			register: jest.fn((_plugin: string, handler: PluginConfigMutationHandler<HomeKitUpdatePluginConfigDto>) => {
				mutationHandler = handler;
			}),
		} as unknown as jest.Mocked<PluginConfigMutationRegistryService>;

		devicesService = {
			findOne: jest.fn(),
		} as unknown as jest.Mocked<DevicesService>;

		mapperRegistry = {
			canMap: jest.fn().mockReturnValue(true),
		} as unknown as jest.Mocked<HomeKitMapperRegistryService>;

		configService = {
			getPluginConfig: jest.fn().mockReturnValue({
				mappedDeviceIds: ['existing-dev-1'],
			}),
			setPluginConfig: jest.fn(),
		} as unknown as jest.Mocked<ConfigService>;

		plugin = new DevicesHomeKitPlugin(
			configMapper,
			swaggerRegistry,
			extensionsService,
			managedServiceManager,
			homeKitBridgeService,
			pluginConfigMutations,
			devicesService,
			mapperRegistry,
			configService,
		);

		plugin.onModuleInit();
	});

	it('registers configuration mapping with secretFields for pincode', () => {
		expect(configMapper.registerMapping).toHaveBeenCalledWith({
			type: DEVICES_HOMEKIT_PLUGIN_NAME,
			class: HomeKitConfigModel,
			configDto: HomeKitUpdatePluginConfigDto,
			secretFields: [
				{
					path: 'pincode',
					configuredPath: 'pincode_configured',
				},
			],
		});
	});

	it('registers a mutation handler for devices-homekit', () => {
		expect(pluginConfigMutations.register).toHaveBeenCalledWith(DEVICES_HOMEKIT_PLUGIN_NAME, expect.any(Function));
		expect(mutationHandler).toBeDefined();
	});

	describe('mutation handler', () => {
		const commit: PluginConfigCommit = jest.fn().mockResolvedValue(undefined);

		it('rejects non-array mapped_device_ids', async () => {
			await expect(
				mutationHandler(
					{ type: DEVICES_HOMEKIT_PLUGIN_NAME, mapped_device_ids: 'not-an-array' as unknown as string[] },
					commit,
				),
			).rejects.toThrow(BadRequestException);
		});

		it('rejects more than 149 mapped accessories', async () => {
			const tooMany = Array.from({ length: 150 }, (_, i) => `dev-${i}`);
			await expect(
				mutationHandler({ type: DEVICES_HOMEKIT_PLUGIN_NAME, mapped_device_ids: tooMany }, commit),
			).rejects.toThrow(BadRequestException);
		});

		it('rejects duplicate device IDs', async () => {
			await expect(
				mutationHandler({ type: DEVICES_HOMEKIT_PLUGIN_NAME, mapped_device_ids: ['dev-1', 'dev-1'] }, commit),
			).rejects.toThrow(BadRequestException);
		});

		it('rejects when device is not found in database', async () => {
			devicesService.findOne.mockResolvedValue(null as unknown as DeviceEntity);

			await expect(
				mutationHandler({ type: DEVICES_HOMEKIT_PLUGIN_NAME, mapped_device_ids: ['dev-not-found'] }, commit),
			).rejects.toThrow(BadRequestException);
		});

		it('rejects when device is incompatible with HomeKit', async () => {
			devicesService.findOne.mockResolvedValue({ id: 'dev-1', name: 'Unsupported Device' } as unknown as DeviceEntity);
			mapperRegistry.canMap.mockReturnValue(false);

			await expect(
				mutationHandler({ type: DEVICES_HOMEKIT_PLUGIN_NAME, mapped_device_ids: ['dev-1'] }, commit),
			).rejects.toThrow(BadRequestException);
		});

		it('successfully commits and reconciles when mapping is valid', async () => {
			devicesService.findOne.mockResolvedValue({ id: 'dev-1', name: 'Light' } as unknown as DeviceEntity);
			mapperRegistry.canMap.mockReturnValue(true);

			await mutationHandler({ type: DEVICES_HOMEKIT_PLUGIN_NAME, mapped_device_ids: ['dev-1'] }, commit);

			expect(commit).toHaveBeenCalled();
			expect(homeKitBridgeService.reconcileLatestMapping).toHaveBeenCalled();
			expect(configService.setPluginConfig).not.toHaveBeenCalled();
		});

		it('performs compensating rollback restoring previous mapped_device_ids when reconciliation fails', async () => {
			devicesService.findOne.mockResolvedValue({ id: 'dev-1', name: 'Light' } as unknown as DeviceEntity);
			mapperRegistry.canMap.mockReturnValue(true);
			configService.getPluginConfig.mockReturnValue({
				mappedDeviceIds: ['orig-dev-1', 'orig-dev-2'],
			} as unknown as HomeKitConfigModel);

			const reconcileError = new Error('HAP bridge accessory addition failed');
			homeKitBridgeService.reconcileLatestMapping.mockRejectedValue(reconcileError);

			await expect(
				mutationHandler({ type: DEVICES_HOMEKIT_PLUGIN_NAME, mapped_device_ids: ['dev-1'] }, commit),
			).rejects.toThrow(reconcileError);

			expect(commit).toHaveBeenCalled();
			expect(configService.setPluginConfig).toHaveBeenCalledWith(DEVICES_HOMEKIT_PLUGIN_NAME, {
				type: DEVICES_HOMEKIT_PLUGIN_NAME,
				mapped_device_ids: ['orig-dev-1', 'orig-dev-2'],
			});
		});

		it('reports both reconciliation and rollback errors when compensating rollback fails', async () => {
			devicesService.findOne.mockResolvedValue({ id: 'dev-1', name: 'Light' } as unknown as DeviceEntity);
			mapperRegistry.canMap.mockReturnValue(true);
			configService.getPluginConfig.mockReturnValue({
				mappedDeviceIds: ['orig-dev-1'],
			} as unknown as HomeKitConfigModel);

			const reconcileError = new Error('Reconciliation failed');
			const rollbackError = new Error('Disk write error during rollback');
			homeKitBridgeService.reconcileLatestMapping.mockRejectedValue(reconcileError);
			configService.setPluginConfig.mockImplementation(() => {
				throw rollbackError;
			});

			await expect(
				mutationHandler({ type: DEVICES_HOMEKIT_PLUGIN_NAME, mapped_device_ids: ['dev-1'] }, commit),
			).rejects.toThrow(
				/HomeKit mapping reconciliation failed: Reconciliation failed\. Additionally, compensating rollback failed: Disk write error during rollback/,
			);
		});
	});
});
