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

import { HomeKitMapperContext, PropertyEventListener } from './homekit-mapper.interface';
import { ThermostatMapper } from './thermostat.mapper';

describe('ThermostatMapper', () => {
	let mapper: ThermostatMapper;
	let commandDispatcher: { dispatch: jest.Mock; dispatchBatch: jest.Mock };
	let registeredListeners: PropertyEventListener[];
	let context: HomeKitMapperContext;

	beforeEach(() => {
		mapper = new ThermostatMapper();
		commandDispatcher = {
			dispatch: jest.fn().mockResolvedValue(undefined),
			dispatchBatch: jest.fn().mockResolvedValue(undefined),
		};
		registeredListeners = [];
		context = {
			commandDispatcher: commandDispatcher as unknown as HomeKitCommandDispatcher,
			registerBinding: jest.fn(),
			registerPropertyListener: (listener) => registeredListeners.push(listener),
		};
	});

	it('should return true for canMap when ambient temp and valid heater are present', () => {
		const device = new DeviceEntity();
		device.id = 'dev-t-1';
		device.name = 'Living Room Thermostat';
		device.category = DeviceCategory.THERMOSTAT;

		const ambientChannel = new ChannelEntity();
		ambientChannel.id = 'ch-ambient';
		ambientChannel.category = ChannelCategory.TEMPERATURE;
		const ambientProp = new ChannelPropertyEntity();
		ambientProp.id = 'prop-ambient';
		ambientProp.category = PropertyCategory.TEMPERATURE;
		ambientProp.permissions = [PermissionType.READ_ONLY];
		ambientChannel.properties = [ambientProp];

		const heaterChannel = new ChannelEntity();
		heaterChannel.id = 'ch-heater';
		heaterChannel.category = ChannelCategory.HEATER;
		const onProp = new ChannelPropertyEntity();
		onProp.id = 'prop-on';
		onProp.category = PropertyCategory.ON;
		onProp.permissions = [PermissionType.READ_WRITE];
		const tempProp = new ChannelPropertyEntity();
		tempProp.id = 'prop-temp';
		tempProp.category = PropertyCategory.TEMPERATURE;
		tempProp.permissions = [PermissionType.READ_WRITE];
		heaterChannel.properties = [onProp, tempProp];

		device.channels = [ambientChannel, heaterChannel];

		expect(mapper.canMap(device)).toBe(true);
	});

	it('should return false for canMap when ambient temp is missing', () => {
		const device = new DeviceEntity();
		device.id = 'dev-t-2';
		device.channels = [];

		expect(mapper.canMap(device)).toBe(false);
	});

	it('should discover child lock on standalone THERMOSTAT channel and attach LockPhysicalControls', () => {
		const device = new DeviceEntity();
		device.id = 'dev-t-childlock';
		device.name = 'Child Lock Thermostat';
		device.category = DeviceCategory.THERMOSTAT;

		// 1. Separate ambient temperature channel
		const ambientChannel = new ChannelEntity();
		ambientChannel.id = 'ch-ambient';
		ambientChannel.category = ChannelCategory.TEMPERATURE;
		const ambientProp = new ChannelPropertyEntity();
		ambientProp.id = 'prop-ambient';
		ambientProp.category = PropertyCategory.TEMPERATURE;
		ambientProp.permissions = [PermissionType.READ_ONLY];
		ambientProp.value = new PropertyValueState(20.5);
		ambientChannel.properties = [ambientProp];

		// 2. Separate heater channel with ON and TEMPERATURE
		const heaterChannel = new ChannelEntity();
		heaterChannel.id = 'ch-heater';
		heaterChannel.category = ChannelCategory.HEATER;
		const onProp = new ChannelPropertyEntity();
		onProp.id = 'prop-heater-on';
		onProp.category = PropertyCategory.ON;
		onProp.permissions = [PermissionType.READ_WRITE];
		onProp.value = new PropertyValueState(true);
		const tempProp = new ChannelPropertyEntity();
		tempProp.id = 'prop-heater-temp';
		tempProp.category = PropertyCategory.TEMPERATURE;
		tempProp.permissions = [PermissionType.READ_WRITE];
		tempProp.value = new PropertyValueState(22.0);
		heaterChannel.properties = [onProp, tempProp];

		// 3. Separate THERMOSTAT channel containing only LOCKED property
		const thermostatChannel = new ChannelEntity();
		thermostatChannel.id = 'ch-thermostat-controls';
		thermostatChannel.category = ChannelCategory.THERMOSTAT;
		const lockProp = new ChannelPropertyEntity();
		lockProp.id = 'prop-child-lock';
		lockProp.category = PropertyCategory.LOCKED;
		lockProp.permissions = [PermissionType.READ_WRITE];
		lockProp.value = new PropertyValueState(false);
		thermostatChannel.properties = [lockProp];

		device.channels = [ambientChannel, heaterChannel, thermostatChannel];

		const accessory = mapper.buildAccessory(device, context);
		expect(accessory).not.toBeNull();

		const service = accessory?.getService(Service.Thermostat);
		expect(service).toBeDefined();

		const lockChar = service?.getCharacteristic(Characteristic.LockPhysicalControls);
		expect(lockChar).toBeDefined();
		expect(lockChar?.value).toBe(Characteristic.LockPhysicalControls.CONTROL_LOCK_DISABLED);
	});
});
