import { Accessory, Characteristic, Service } from '@homebridge/hap-nodejs';

import {
	ChannelCategory,
	DeviceCategory,
	PermissionType,
	PropertyCategory,
} from '../../../modules/devices/devices.constants';
import { ChannelEntity, ChannelPropertyEntity, DeviceEntity } from '../../../modules/devices/entities/devices.entity';
import { PropertyValueState } from '../../../modules/devices/models/property-value-state.model';
import { HomeKitCommandDispatcher } from '../services/homekit-command.dispatcher';

import { BatteryMapper } from './battery.mapper';
import { CharacteristicBinding, HomeKitMapperContext, PropertyEventListener } from './homekit-mapper.interface';

describe('BatteryMapper', () => {
	let accessory: Accessory;
	let device: DeviceEntity;
	let batteryChannel: ChannelEntity;
	let levelProp: ChannelPropertyEntity;
	let statusProp: ChannelPropertyEntity;

	let registeredBindings: CharacteristicBinding[];
	let registeredListeners: PropertyEventListener[];
	let context: HomeKitMapperContext;

	beforeEach(() => {
		accessory = new Accessory('Battery Device', '550e8400-e29b-41d4-a716-446655440001');

		device = new DeviceEntity();
		device.id = 'dev-battery-1';
		device.name = 'Battery Sensor';
		device.category = DeviceCategory.SENSOR;

		batteryChannel = new ChannelEntity();
		batteryChannel.id = 'chan-battery-1';
		batteryChannel.category = ChannelCategory.BATTERY;

		levelProp = new ChannelPropertyEntity();
		levelProp.id = 'prop-bat-level';
		levelProp.category = PropertyCategory.PERCENTAGE;
		levelProp.permissions = [PermissionType.READ_ONLY];
		levelProp.value = new PropertyValueState(85);

		statusProp = new ChannelPropertyEntity();
		statusProp.id = 'prop-bat-status';
		statusProp.category = PropertyCategory.STATUS;
		statusProp.permissions = [PermissionType.READ_ONLY];
		statusProp.value = new PropertyValueState('normal');

		batteryChannel.properties = [levelProp, statusProp];
		device.channels = [batteryChannel];

		registeredBindings = [];
		registeredListeners = [];
		context = {
			commandDispatcher: { dispatch: jest.fn(), dispatchBatch: jest.fn() } as unknown as HomeKitCommandDispatcher,
			registerBinding: (binding) => registeredBindings.push(binding),
			registerPropertyListener: (listener) => registeredListeners.push(listener),
		};
	});

	it('should attach battery service with numeric level and derive normal battery status', () => {
		BatteryMapper.attachBatteryService(accessory, device, context);

		const service = accessory.getService(Service.Battery);
		expect(service).toBeDefined();

		const levelChar = service?.getCharacteristic(Characteristic.BatteryLevel);
		const lowBatChar = service?.getCharacteristic(Characteristic.StatusLowBattery);

		expect(levelChar?.value).toBe(85);
		expect(lowBatChar?.value).toBe(Characteristic.StatusLowBattery.BATTERY_LEVEL_NORMAL);
	});

	it('should convert discrete enum levels correctly', () => {
		levelProp.value = new PropertyValueState('low');

		BatteryMapper.attachBatteryService(accessory, device, context);

		const service = accessory.getService(Service.Battery);
		const levelChar = service?.getCharacteristic(Characteristic.BatteryLevel);
		const lowBatChar = service?.getCharacteristic(Characteristic.StatusLowBattery);

		// 'low' -> 25%, which triggers low battery or status derivation
		expect(levelChar?.value).toBe(25);
		expect(lowBatChar?.value).toBe(Characteristic.StatusLowBattery.BATTERY_LEVEL_LOW);
	});

	it('should recompute StatusLowBattery when either level or status property updates', () => {
		levelProp.value = new PropertyValueState(50);
		statusProp.value = new PropertyValueState('normal');

		BatteryMapper.attachBatteryService(accessory, device, context);

		const service = accessory.getService(Service.Battery);
		const lowBatChar = service?.getCharacteristic(Characteristic.StatusLowBattery);
		expect(lowBatChar?.value).toBe(Characteristic.StatusLowBattery.BATTERY_LEVEL_NORMAL);

		// 1. Status changes to 'low_battery'
		for (const listener of registeredListeners) {
			if (listener.propertyId === statusProp.id) {
				listener.onPropertyChanged(statusProp, 'low_battery');
			}
		}
		expect(lowBatChar?.value).toBe(Characteristic.StatusLowBattery.BATTERY_LEVEL_LOW);

		// 2. Status resets to 'normal', but level drops to 15% (<= 20% threshold)
		for (const listener of registeredListeners) {
			if (listener.propertyId === statusProp.id) {
				listener.onPropertyChanged(statusProp, 'normal');
			}
		}
		for (const listener of registeredListeners) {
			if (listener.propertyId === levelProp.id) {
				listener.onPropertyChanged(levelProp, 15);
			}
		}
		expect(lowBatChar?.value).toBe(Characteristic.StatusLowBattery.BATTERY_LEVEL_LOW);

		// 3. Level rises to 90% and status is normal -> resets to normal
		for (const listener of registeredListeners) {
			if (listener.propertyId === levelProp.id) {
				listener.onPropertyChanged(levelProp, 90);
			}
		}
		expect(lowBatChar?.value).toBe(Characteristic.StatusLowBattery.BATTERY_LEVEL_NORMAL);
	});

	it('should treat missing battery level as normal for status-only battery devices', () => {
		statusProp.value = new PropertyValueState('ok');
		batteryChannel.properties = [statusProp]; // No level property

		BatteryMapper.attachBatteryService(accessory, device, context);

		const service = accessory.getService(Service.Battery);
		const levelChar = service?.getCharacteristic(Characteristic.BatteryLevel);
		const lowBatChar = service?.getCharacteristic(Characteristic.StatusLowBattery);

		expect(levelChar?.value).toBe(100);
		expect(lowBatChar?.value).toBe(Characteristic.StatusLowBattery.BATTERY_LEVEL_NORMAL);
	});
});
