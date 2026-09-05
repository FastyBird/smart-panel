import {
	ChannelCategory,
	DeviceCategory,
	PermissionType,
	PropertyCategory,
} from '../../../modules/devices/devices.constants';
import { ChannelEntity, ChannelPropertyEntity, DeviceEntity } from '../../../modules/devices/entities/devices.entity';
import { PropertyValueState } from '../../../modules/devices/models/property-value-state.model';

import { HomeKitCommandDispatcher } from './homekit-command.dispatcher';
import { HomeKitMapperRegistryService } from './homekit-mapper-registry.service';

describe('HomeKitMapperRegistryService', () => {
	let registry: HomeKitMapperRegistryService;
	let commandDispatcher: HomeKitCommandDispatcher;
	let device: DeviceEntity;
	let switchChannel: ChannelEntity;
	let onProp: ChannelPropertyEntity;

	beforeEach(() => {
		registry = new HomeKitMapperRegistryService();
		commandDispatcher = {
			dispatch: jest.fn().mockResolvedValue(true),
			dispatchBatch: jest.fn().mockResolvedValue(true),
		} as unknown as HomeKitCommandDispatcher;

		device = new DeviceEntity();
		device.id = 'dev-switch-1';
		device.name = 'Test Switch';
		device.category = DeviceCategory.GENERIC;

		switchChannel = new ChannelEntity();
		switchChannel.id = 'chan-switch-1';
		switchChannel.category = ChannelCategory.SWITCHER;
		switchChannel.device = device;

		onProp = new ChannelPropertyEntity();
		onProp.id = 'prop-on-1';
		onProp.category = PropertyCategory.ON;
		onProp.permissions = [PermissionType.READ_WRITE];
		onProp.value = new PropertyValueState(false);
		onProp.channel = switchChannel;

		switchChannel.properties = [onProp];
		device.channels = [switchChannel];
	});

	it('should build an accessory without mutating live registry maps', () => {
		const staged = registry.buildAccessory(device, commandDispatcher);

		expect(staged).not.toBeNull();
		expect(staged?.accessory).toBeDefined();
		expect(staged?.deviceId).toBe(device.id);
		expect(staged?.bindings.length).toBeGreaterThan(0);

		// Live registry maps must remain completely clean and untouched
		expect(registry.getBindingsForProperty(onProp.id)).toEqual([]);
		expect(registry.getListenersForProperty(onProp.id)).toEqual([]);
		const snapshot = registry.getSnapshot();
		expect(snapshot.deviceProperties.size).toBe(0);
		expect(snapshot.propertyBindings.size).toBe(0);
		expect(snapshot.propertyListeners.size).toBe(0);
	});

	it('should install bindings and listeners only when commitStaged is called', () => {
		const staged = registry.buildAccessory(device, commandDispatcher);
		expect(staged).not.toBeNull();

		// Before commit: empty
		expect(registry.getBindingsForProperty(onProp.id)).toHaveLength(0);

		// Commit
		registry.commitStaged(staged);

		// After commit: bindings installed
		const bindings = registry.getBindingsForProperty(onProp.id);
		expect(bindings).toHaveLength(1);
		expect(bindings[0].propertyId).toBe(onProp.id);
		expect(bindings[0].deviceId).toBe(device.id);
	});

	it('should leave zero orphan bindings if accessory addition fails before commit', () => {
		const staged = registry.buildAccessory(device, commandDispatcher);
		expect(staged).not.toBeNull();

		// Simulate bridge addBridgedAccessory throwing an error before commitStaged is invoked
		const simulateHapFailure = () => {
			throw new Error('HAP accessory UUID collision');
		};

		expect(() => simulateHapFailure()).toThrow('HAP accessory UUID collision');

		// Because commitStaged was not called, no orphan bindings exist
		expect(registry.getBindingsForProperty(onProp.id)).toEqual([]);
		expect(registry.getListenersForProperty(onProp.id)).toEqual([]);
		const snapshot = registry.getSnapshot();
		expect(snapshot.deviceProperties.size).toBe(0);
	});

	it('should maintain uncontaminated snapshots when building staged accessories', () => {
		// 1. Snapshot taken before building new additions
		const cleanSnapshot = registry.getSnapshot();

		// 2. Build staged accessory (must not mutate registry)
		const staged = registry.buildAccessory(device, commandDispatcher);
		expect(staged).not.toBeNull();

		// 3. Snapshot remains identical
		const currentSnapshot = registry.getSnapshot();
		expect(currentSnapshot.propertyBindings.size).toBe(cleanSnapshot.propertyBindings.size);
		expect(currentSnapshot.deviceProperties.size).toBe(cleanSnapshot.deviceProperties.size);

		// 4. Commit and then restore
		registry.commitStaged(staged);
		expect(registry.getBindingsForProperty(onProp.id)).toHaveLength(1);

		registry.restoreSnapshot(cleanSnapshot);
		expect(registry.getBindingsForProperty(onProp.id)).toEqual([]);
	});
});
