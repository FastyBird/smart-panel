import { Characteristic, Service } from '@homebridge/hap-nodejs';

import {
	ChannelCategory,
	DeviceCategory,
	PermissionType,
	PropertyCategory,
} from '../../../modules/devices/devices.constants';
import { ChannelEntity, ChannelPropertyEntity, DeviceEntity } from '../../../modules/devices/entities/devices.entity';
import { PropertyValueState } from '../../../modules/devices/models/property-value-state.model';
import { HomeKitCommandDispatcher } from '../services/homekit-command.dispatcher';

import { CharacteristicBinding, HomeKitMapperContext } from './homekit-mapper.interface';
import { WindowCoveringMapper } from './window-covering.mapper';

describe('WindowCoveringMapper', () => {
	let mapper: WindowCoveringMapper;
	let commandDispatcher: { dispatch: jest.Mock };
	let registeredBindings: CharacteristicBinding[];
	let context: HomeKitMapperContext;

	beforeEach(() => {
		mapper = new WindowCoveringMapper();
		commandDispatcher = { dispatch: jest.fn().mockResolvedValue(undefined) };
		registeredBindings = [];
		context = {
			commandDispatcher: commandDispatcher as unknown as HomeKitCommandDispatcher,
			registerBinding: (binding) => registeredBindings.push(binding),
			registerPropertyListener: jest.fn(),
		};
	});

	it('should strictly require both POSITION and STATUS to be compatible', () => {
		const device = new DeviceEntity();
		device.category = DeviceCategory.WINDOW_COVERING;

		const channel = new ChannelEntity();
		channel.category = ChannelCategory.WINDOW_COVERING;

		const posProp = new ChannelPropertyEntity();
		posProp.category = PropertyCategory.POSITION;

		// Only POSITION -> cannot map
		channel.properties = [posProp];
		device.channels = [channel];
		expect(mapper.canMap(device)).toBe(false);

		// Now add STATUS -> can map
		const statusProp = new ChannelPropertyEntity();
		statusProp.category = PropertyCategory.STATUS;
		channel.properties = [posProp, statusProp];
		expect(mapper.canMap(device)).toBe(true);

		// Only STATUS -> cannot map
		channel.properties = [statusProp];
		expect(mapper.canMap(device)).toBe(false);
	});

	it('should build WindowCovering accessory with position and state characteristics', () => {
		const device = new DeviceEntity();
		device.id = 'dev-blind-1';
		device.name = 'Living Room Blinds';
		device.category = DeviceCategory.WINDOW_COVERING;

		const channel = new ChannelEntity();
		channel.id = 'chan-blind-1';
		channel.category = ChannelCategory.WINDOW_COVERING;

		const posProp = new ChannelPropertyEntity();
		posProp.id = 'prop-pos';
		posProp.category = PropertyCategory.POSITION;
		posProp.permissions = [PermissionType.READ_WRITE];
		posProp.value = new PropertyValueState(75);

		const statusProp = new ChannelPropertyEntity();
		statusProp.id = 'prop-status';
		statusProp.category = PropertyCategory.STATUS;
		statusProp.permissions = [PermissionType.READ_ONLY];
		statusProp.value = new PropertyValueState('opening');

		const obstructionProp = new ChannelPropertyEntity();
		obstructionProp.id = 'prop-obstruction';
		obstructionProp.category = PropertyCategory.OBSTRUCTION;
		obstructionProp.permissions = [PermissionType.READ_ONLY];
		obstructionProp.value = new PropertyValueState(false);

		channel.properties = [posProp, statusProp, obstructionProp];
		device.channels = [channel];

		const accessory = mapper.buildAccessory(device, context);
		expect(accessory).not.toBeNull();

		const service = accessory?.getService(Service.WindowCovering);
		expect(service).toBeDefined();

		const currentPosChar = service?.getCharacteristic(Characteristic.CurrentPosition);
		const targetPosChar = service?.getCharacteristic(Characteristic.TargetPosition);
		const positionStateChar = service?.getCharacteristic(Characteristic.PositionState);
		const obstructionChar = service?.getCharacteristic(Characteristic.ObstructionDetected);

		expect(currentPosChar?.value).toBe(75);
		expect(positionStateChar?.value).toBe(Characteristic.PositionState.INCREASING);
		expect(obstructionChar?.value).toBe(false);

		// Setting TargetPosition dispatches command
		targetPosChar?.setValue(50);
		expect(commandDispatcher.dispatch).toHaveBeenCalledWith('prop-pos', 50);
	});
});
