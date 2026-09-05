import { Accessory, Characteristic, Service } from '@homebridge/hap-nodejs';

import { ConfigService } from '../../../modules/config/services/config.service';
import { DeviceEntity } from '../../../modules/devices/entities/devices.entity';
import { DevicesService } from '../../../modules/devices/services/devices.service';
import { DEVICES_HOMEKIT_PLUGIN_NAME } from '../devices-homekit.constants';
import { HomeKitConfigModel } from '../models/config.model';

import { HomeKitBridgeService } from './homekit-bridge.service';
import { HomeKitCommandDispatcher } from './homekit-command.dispatcher';
import { HomeKitMapperRegistryService } from './homekit-mapper-registry.service';

interface MockHapBridge {
	publish: jest.Mock;
	unpublish: jest.Mock;
	destroy: jest.Mock;
	addBridgedAccessory: jest.Mock;
	removeBridgedAccessory: jest.Mock;
}

jest.mock('@homebridge/hap-nodejs', () => {
	const original = jest.requireActual<typeof import('@homebridge/hap-nodejs')>('@homebridge/hap-nodejs');

	class MockBridge {
		name: string;
		uuid: string;
		bridgedAccessories: Accessory[] = [];
		services: Service[] = [];

		constructor(name: string, uuid: string) {
			this.name = name;
			this.uuid = uuid;
		}

		getService = jest.fn().mockReturnValue(null);
		addService = jest.fn().mockReturnValue({
			setCharacteristic: jest.fn().mockReturnThis(),
		});
		publish = jest.fn().mockResolvedValue(undefined);
		unpublish = jest.fn().mockResolvedValue(undefined);
		destroy = jest.fn().mockResolvedValue(undefined);
		addBridgedAccessory = jest.fn().mockImplementation((acc: Accessory) => this.bridgedAccessories.push(acc));
		removeBridgedAccessory = jest.fn().mockImplementation((acc: Accessory) => {
			this.bridgedAccessories = this.bridgedAccessories.filter((a) => a !== acc);
		});
		setupURI = jest.fn().mockReturnValue('X-HM://MOCKURI');
	}

	return {
		...original,
		Bridge: MockBridge,
		HAPStorage: {
			setCustomStoragePath: jest.fn(),
		},
		uuid: {
			generate: jest.fn().mockReturnValue('mock-bridge-uuid'),
		},
	};
});

jest.mock('fs', () => ({
	...jest.requireActual<typeof import('fs')>('fs'),
	existsSync: jest.fn().mockReturnValue(true),
	mkdirSync: jest.fn(),
	readdirSync: jest.fn().mockReturnValue([]),
	rmSync: jest.fn(),
}));

describe('HomeKitBridgeService', () => {
	let service: HomeKitBridgeService;
	let configService: jest.Mocked<Partial<ConfigService>>;
	let devicesService: jest.Mocked<Partial<DevicesService>>;
	let mapperRegistry: jest.Mocked<Partial<HomeKitMapperRegistryService>>;
	let commandDispatcher: jest.Mocked<Partial<HomeKitCommandDispatcher>>;

	let baseConfig: HomeKitConfigModel;

	beforeEach(() => {
		baseConfig = new HomeKitConfigModel();
		baseConfig.enabled = true;
		baseConfig.bridgeName = 'Smart Panel Bridge';
		baseConfig.port = 51826;
		baseConfig.pincode = '031-45-154';
		baseConfig.username = 'CC:22:3D:E3:CE:30';
		baseConfig.setupId = 'SP01';
		baseConfig.mappedDeviceIds = ['dev-1'];

		configService = {
			getPluginConfig: jest.fn().mockReturnValue(baseConfig),
			updatePluginConfig: jest.fn().mockResolvedValue(undefined),
		};

		devicesService = {
			findOne: jest.fn().mockImplementation((id: string) => {
				return Promise.resolve({ id, name: `Device ${id}` } as DeviceEntity);
			}),
		};

		mapperRegistry = {
			clearAllBindings: jest.fn(),
			clearDeviceBindings: jest.fn(),
			buildAccessory: jest.fn().mockImplementation((dev: DeviceEntity) => {
				const acc = new Accessory(dev.name, '550e8400-e29b-41d4-a716-44665544000' + dev.id.slice(-1));
				const info = acc.getService(Service.AccessoryInformation) ?? acc.addService(Service.AccessoryInformation);
				info.setCharacteristic(Characteristic.SerialNumber, dev.id);
				return acc;
			}),
			getSnapshot: jest
				.fn()
				.mockReturnValue({ propertyBindings: new Map(), propertyListeners: new Map(), deviceProperties: new Map() }),
			restoreSnapshot: jest.fn(),
		};

		commandDispatcher = {
			dispatch: jest.fn(),
			dispatchBatch: jest.fn(),
		};

		service = new HomeKitBridgeService(
			configService as unknown as ConfigService,
			devicesService as unknown as DevicesService,
			mapperRegistry as unknown as HomeKitMapperRegistryService,
			commandDispatcher as unknown as HomeKitCommandDispatcher,
		);
	});

	const getBridge = (): MockHapBridge => {
		return (service as unknown as { bridge: MockHapBridge }).bridge;
	};

	it('should preserve pairings during normal stop (calls unpublish without destroy)', async () => {
		await service.start();
		expect(service.getState()).toBe('started');

		const bridge = getBridge();
		expect(bridge).toBeDefined();

		const unpublishSpy = jest.spyOn(bridge, 'unpublish');
		const destroySpy = jest.spyOn(bridge, 'destroy');

		await service.stop();

		expect(service.getState()).toBe('stopped');
		expect(unpublishSpy).toHaveBeenCalled();
		expect(destroySpy).not.toHaveBeenCalled();
	});

	it('should perform destructive cleanup and update credentials on resetPairing()', async () => {
		await service.start();
		const bridge = getBridge();
		const destroySpy = jest.spyOn(bridge, 'destroy');

		await service.resetPairing();

		expect(destroySpy).toHaveBeenCalled();
		expect(configService.updatePluginConfig).toHaveBeenCalledWith(
			DEVICES_HOMEKIT_PLUGIN_NAME,
			expect.objectContaining({
				type: DEVICES_HOMEKIT_PLUGIN_NAME,
				pincode: expect.any(String) as unknown as string,
				username: expect.any(String) as unknown as string,
				setup_id: expect.any(String) as unknown as string,
			}),
		);
	});

	it('should be idempotent when start is called repeatedly with identical configuration', async () => {
		await service.start();
		expect(service.getState()).toBe('started');

		const bridge = getBridge();
		const publishSpy = jest.spyOn(bridge, 'publish');
		publishSpy.mockClear();

		// Second start call
		await service.start();

		// Should not re-publish
		expect(publishSpy).not.toHaveBeenCalled();
		expect(service.getState()).toBe('started');
	});

	it('should require restart when core configuration parameters change', async () => {
		await service.start();

		// Change port
		const changedConfig = { ...baseConfig, port: 51827 };
		configService.getPluginConfig = jest.fn().mockReturnValue(changedConfig);

		const result = await service.onConfigChanged();

		expect(result).toEqual({ restartRequired: true });
	});

	it('should reconcile dynamically without restart when only mappedDeviceIds changes', async () => {
		await service.start();

		// Only change mappedDeviceIds
		const changedConfig = { ...baseConfig, mappedDeviceIds: ['dev-1', 'dev-2'] };
		configService.getPluginConfig = jest.fn().mockReturnValue(changedConfig);

		const result = await service.onConfigChanged();

		expect(result).toEqual({ restartRequired: false });
		expect(mapperRegistry.buildAccessory).toHaveBeenCalled();
	});

	it('should remove bridged accessory and clear bindings when a device is unmapped', async () => {
		await service.start();

		const bridge = getBridge();
		const removeSpy = jest.spyOn(bridge, 'removeBridgedAccessory');

		// Unmap dev-1 (empty list)
		const changedConfig = { ...baseConfig, mappedDeviceIds: [] };
		configService.getPluginConfig = jest.fn().mockReturnValue(changedConfig);

		const result = await service.onConfigChanged();

		expect(result).toEqual({ restartRequired: false });
		expect(removeSpy).toHaveBeenCalled();
		expect(mapperRegistry.clearDeviceBindings).toHaveBeenCalledWith('dev-1');
	});

	it('should rollback to snapshot if dynamic reconciliation fails', async () => {
		await service.start();

		const bridge = getBridge();
		jest.spyOn(bridge, 'addBridgedAccessory').mockImplementationOnce(() => {
			throw new Error('Mutation exploded');
		});

		const changedConfig = { ...baseConfig, mappedDeviceIds: ['dev-1', 'dev-2'] };
		configService.getPluginConfig = jest.fn().mockReturnValue(changedConfig);

		await expect(service.onConfigChanged()).rejects.toThrow('Mutation exploded');

		expect(mapperRegistry.restoreSnapshot).toHaveBeenCalled();
	});
});
