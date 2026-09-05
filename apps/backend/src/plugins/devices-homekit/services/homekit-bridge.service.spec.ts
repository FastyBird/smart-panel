import { Accessory, Characteristic, Service } from '@homebridge/hap-nodejs';
import { EventEmitter2 } from '@nestjs/event-emitter';

import { ConfigService } from '../../../modules/config/services/config.service';
import { DeviceEntity } from '../../../modules/devices/entities/devices.entity';
import { DevicesService } from '../../../modules/devices/services/devices.service';
import { DEVICES_HOMEKIT_PLUGIN_NAME } from '../devices-homekit.constants';
import { HomeKitConfigModel } from '../models/config.model';

import { HomeKitBridgeService } from './homekit-bridge.service';
import { HomeKitCommandDispatcher } from './homekit-command.dispatcher';
import { HomeKitMapperRegistryService } from './homekit-mapper-registry.service';

interface MockHapBridge {
	on: jest.Mock<void, [string, () => void]>;
	publish: jest.Mock;
	unpublish: jest.Mock;
	destroy: jest.Mock;
	addBridgedAccessory: jest.Mock;
	removeBridgedAccessory: jest.Mock;
	bridgedAccessories: Accessory[];
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
		on = jest.fn();
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

jest.mock('qrcode', () => ({
	toDataURL: jest.fn().mockResolvedValue('data:image/png;base64,mock-qr-code'),
}));

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
	let eventEmitter: { emit: jest.Mock };

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
			commitStaged: jest.fn(),
			buildAccessory: jest.fn().mockImplementation((dev: DeviceEntity) => {
				const acc = new Accessory(dev.name, '550e8400-e29b-41d4-a716-44665544000' + dev.id.slice(-1));
				const info = acc.getService(Service.AccessoryInformation) ?? acc.addService(Service.AccessoryInformation);
				info.setCharacteristic(Characteristic.SerialNumber, dev.id);
				return {
					accessory: acc,
					deviceId: dev.id,
					bindings: [],
					listeners: [],
				};
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

		eventEmitter = {
			emit: jest.fn(),
		};

		service = new HomeKitBridgeService(
			configService as unknown as ConfigService,
			devicesService as unknown as DevicesService,
			mapperRegistry as unknown as HomeKitMapperRegistryService,
			commandDispatcher as unknown as HomeKitCommandDispatcher,
			eventEmitter as unknown as EventEmitter2,
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

	it('should abort reconciliation before mutating bridge when an added device fails pre-building', async () => {
		await service.start();

		const bridge = getBridge();
		const removeSpy = jest.spyOn(bridge, 'removeBridgedAccessory');
		const addSpy = jest.spyOn(bridge, 'addBridgedAccessory');
		addSpy.mockClear();

		// dev-fail returns null from buildAccessory
		mapperRegistry.buildAccessory.mockImplementationOnce(() => null);

		const changedConfig = { ...baseConfig, mappedDeviceIds: ['dev-2'] };
		configService.getPluginConfig = jest.fn().mockReturnValue(changedConfig);

		await expect(service.onConfigChanged()).rejects.toThrow(
			'Device dev-2 could not be mapped to any supported HomeKit accessory.',
		);

		// Neither removal of dev-1 nor addition should have happened
		expect(removeSpy).not.toHaveBeenCalled();
		expect(addSpy).not.toHaveBeenCalled();
		expect(bridge.bridgedAccessories).toHaveLength(1);
	});

	it('should abort reconciliation before mutating bridge when an added device is missing in database', async () => {
		await service.start();

		const bridge = getBridge();
		const removeSpy = jest.spyOn(bridge, 'removeBridgedAccessory');

		devicesService.findOne.mockImplementationOnce(() => Promise.resolve(null));

		const changedConfig = { ...baseConfig, mappedDeviceIds: ['dev-missing'] };
		configService.getPluginConfig = jest.fn().mockReturnValue(changedConfig);

		await expect(service.onConfigChanged()).rejects.toThrow(
			'Device dev-missing not found in database during reconciliation.',
		);

		expect(removeSpy).not.toHaveBeenCalled();
		expect(bridge.bridgedAccessories).toHaveLength(1);
	});

	it('should enter error state if bridge rollback cannot restore original state', async () => {
		await service.start();

		const bridge = getBridge();
		// Simulate addBridgedAccessory mutating internal state before throwing
		jest.spyOn(bridge, 'addBridgedAccessory').mockImplementationOnce((acc: Accessory) => {
			bridge.bridgedAccessories.push(acc);
			throw new Error('HAP addition failed');
		});
		// Also fail during rollback when removing extra accessory
		jest.spyOn(bridge, 'removeBridgedAccessory').mockImplementationOnce(() => {
			throw new Error('Rollback remove failed');
		});

		const changedConfig = { ...baseConfig, mappedDeviceIds: ['dev-1', 'dev-2'] };
		configService.getPluginConfig = jest.fn().mockReturnValue(changedConfig);

		await expect(service.onConfigChanged()).rejects.toThrow('HAP addition failed');

		// Service state should be set to error
		expect(service.getState()).toBe('error');
		// Registry snapshot must still be restored
		expect(mapperRegistry.restoreSnapshot).toHaveBeenCalled();
	});

	it('should emit BRIDGE_STATUS_CHANGED event when bridge starts and stops', async () => {
		await service.start();
		expect(eventEmitter.emit).toHaveBeenCalledWith(
			'DevicesHomeKitPlugin.Bridge.StatusChanged',
			expect.objectContaining({
				running: true,
				bridgeName: 'Smart Panel Bridge',
			}),
		);

		eventEmitter.emit.mockClear();
		await service.stop();
		expect(eventEmitter.emit).toHaveBeenCalledWith(
			'DevicesHomeKitPlugin.Bridge.StatusChanged',
			expect.objectContaining({
				running: false,
			}),
		);
	});

	it('should register listeners on HAP bridge for paired and unpaired events', async () => {
		await service.start();
		const bridge = getBridge();
		expect(bridge.on).toHaveBeenCalledWith('paired', expect.any(Function));
		expect(bridge.on).toHaveBeenCalledWith('unpaired', expect.any(Function));

		// Find the paired listener and invoke it
		const pairedCall = bridge.on.mock.calls.find((call) => call[0] === 'paired');
		expect(pairedCall).toBeDefined();

		eventEmitter.emit.mockClear();
		if (pairedCall) {
			pairedCall[1]();
		}
		// Let async getStatus resolve
		await new Promise((r) => setImmediate(r));

		expect(eventEmitter.emit).toHaveBeenCalledWith('DevicesHomeKitPlugin.Bridge.StatusChanged', expect.any(Object));
	});
});
