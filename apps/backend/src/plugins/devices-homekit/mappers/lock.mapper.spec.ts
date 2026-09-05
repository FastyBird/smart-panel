import { Characteristic, Service } from '@homebridge/hap-nodejs';

import {
	ChannelCategory,
	DataTypeType,
	DeviceCategory,
	PermissionType,
	PropertyCategory,
} from '../../../modules/devices/devices.constants';
import { ChannelEntity, ChannelPropertyEntity, DeviceEntity } from '../../../modules/devices/entities/devices.entity';
import { PropertyValueState } from '../../../modules/devices/models/property-value-state.model';
import { HomeKitCommandDispatcher } from '../services/homekit-command.dispatcher';

import { CharacteristicBinding, HomeKitMapperContext } from './homekit-mapper.interface';
import { LockMapper } from './lock.mapper';

describe('LockMapper', () => {
	let mapper: LockMapper;
	let commandDispatcher: { dispatch: jest.Mock };
	let registeredBindings: CharacteristicBinding[];
	let context: HomeKitMapperContext;

	beforeEach(() => {
		mapper = new LockMapper();
		commandDispatcher = { dispatch: jest.fn().mockResolvedValue(undefined) };
		registeredBindings = [];
		context = {
			commandDispatcher: commandDispatcher as unknown as HomeKitCommandDispatcher,
			registerBinding: (binding) => registeredBindings.push(binding),
			registerPropertyListener: jest.fn(),
		};
	});

	it('should validate lock channels requiring target and current status', () => {
		const device = new DeviceEntity();
		device.category = DeviceCategory.LOCK;

		const channel = new ChannelEntity();
		channel.category = ChannelCategory.LOCK;

		const onProp = new ChannelPropertyEntity();
		onProp.category = PropertyCategory.ON;

		// Only target -> false
		channel.properties = [onProp];
		device.channels = [channel];
		expect(mapper.canMap(device)).toBe(false);

		// Add status -> true
		const statusProp = new ChannelPropertyEntity();
		statusProp.category = PropertyCategory.STATUS;
		channel.properties = [onProp, statusProp];
		expect(mapper.canMap(device)).toBe(true);
	});

	it('should build Lock accessory and map LockTargetState and LockCurrentState', () => {
		const device = new DeviceEntity();
		device.id = 'dev-lock-1';
		device.name = 'Front Door Lock';
		device.category = DeviceCategory.LOCK;

		const channel = new ChannelEntity();
		channel.id = 'chan-lock-1';
		channel.category = ChannelCategory.LOCK;

		const onProp = new ChannelPropertyEntity();
		onProp.id = 'prop-lock-target';
		onProp.category = PropertyCategory.ON;
		onProp.permissions = [PermissionType.READ_WRITE];
		onProp.value = new PropertyValueState(true);

		const statusProp = new ChannelPropertyEntity();
		statusProp.id = 'prop-lock-status';
		statusProp.category = PropertyCategory.STATUS;
		statusProp.permissions = [PermissionType.READ_ONLY];
		statusProp.value = new PropertyValueState(true);

		channel.properties = [onProp, statusProp];
		device.channels = [channel];

		const accessory = mapper.buildAccessory(device, context);
		expect(accessory).not.toBeNull();

		const service = accessory?.getService(Service.LockMechanism);
		expect(service).toBeDefined();

		const currentChar = service?.getCharacteristic(Characteristic.LockCurrentState);
		const targetChar = service?.getCharacteristic(Characteristic.LockTargetState);

		expect(currentChar?.value).toBe(Characteristic.LockCurrentState.SECURED);
		expect(targetChar?.value).toBe(Characteristic.LockTargetState.SECURED);

		// Unlocking dispatches command
		targetChar?.setValue(Characteristic.LockTargetState.UNSECURED);
		expect(commandDispatcher.dispatch).toHaveBeenCalledWith('prop-lock-target', false);
	});

	it('should dispatch string "unlocked" when target property is an enum', () => {
		const device = new DeviceEntity();
		device.id = 'dev-lock-2';
		device.name = 'Front Door Lock';
		device.category = DeviceCategory.LOCK;

		const channel = new ChannelEntity();
		channel.id = 'chan-lock-2';
		channel.category = ChannelCategory.LOCK;

		const onProp = new ChannelPropertyEntity();
		onProp.id = 'prop-lock-target-2';
		onProp.category = PropertyCategory.LOCKED;
		onProp.dataType = DataTypeType.ENUM;
		onProp.permissions = [PermissionType.READ_WRITE];
		onProp.value = new PropertyValueState('locked');

		channel.properties = [onProp];
		device.channels = [channel];

		const accessory = mapper.buildAccessory(device, context);
		const service = accessory?.getService(Service.LockMechanism);
		const targetChar = service?.getCharacteristic(Characteristic.LockTargetState);

		targetChar?.setValue(Characteristic.LockTargetState.UNSECURED);
		expect(commandDispatcher.dispatch).toHaveBeenCalledWith('prop-lock-target-2', 'unlocked');
	});
});
