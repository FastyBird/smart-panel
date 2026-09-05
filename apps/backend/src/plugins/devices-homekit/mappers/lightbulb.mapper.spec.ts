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
import { LightbulbMapper } from './lightbulb.mapper';

describe('LightbulbMapper', () => {
	let mapper: LightbulbMapper;
	let commandDispatcher: { dispatch: jest.Mock };
	let registeredBindings: CharacteristicBinding[];
	let context: HomeKitMapperContext;

	beforeEach(() => {
		mapper = new LightbulbMapper();
		commandDispatcher = { dispatch: jest.fn().mockResolvedValue(undefined) };
		registeredBindings = [];
		context = {
			commandDispatcher: commandDispatcher as unknown as HomeKitCommandDispatcher,
			registerBinding: (binding) => registeredBindings.push(binding),
			registerPropertyListener: jest.fn(),
		};
	});

	it('should identify compatible devices strictly requiring LIGHT channel with ON property', () => {
		const validLightDevice = new DeviceEntity();
		validLightDevice.category = DeviceCategory.LIGHTING;
		const validChannel = new ChannelEntity();
		validChannel.category = ChannelCategory.LIGHT;
		const onProp = new ChannelPropertyEntity();
		onProp.category = PropertyCategory.ON;
		validChannel.properties = [onProp];
		validLightDevice.channels = [validChannel];

		expect(mapper.canMap(validLightDevice)).toBe(true);

		const lightDeviceNoProps = new DeviceEntity();
		lightDeviceNoProps.category = DeviceCategory.LIGHTING;
		const emptyChannel = new ChannelEntity();
		emptyChannel.category = ChannelCategory.LIGHT;
		emptyChannel.properties = [];
		lightDeviceNoProps.channels = [emptyChannel];
		expect(mapper.canMap(lightDeviceNoProps)).toBe(false);

		const switchDevice = new DeviceEntity();
		switchDevice.category = DeviceCategory.SWITCHER;
		expect(mapper.canMap(switchDevice)).toBe(false);
	});

	it('should build accessory with On, Brightness, and ColorTemperature characteristics', () => {
		const device = new DeviceEntity();
		device.id = 'dev-light-1';
		device.name = 'Ceiling Light';
		device.category = DeviceCategory.LIGHTING;

		const channel = new ChannelEntity();
		channel.id = 'chan-light-1';
		channel.category = ChannelCategory.LIGHT;

		const onProp = new ChannelPropertyEntity();
		onProp.id = 'prop-on-1';
		onProp.category = PropertyCategory.ON;
		onProp.permissions = [PermissionType.READ_WRITE];
		onProp.value = new PropertyValueState(true);

		const brightnessProp = new ChannelPropertyEntity();
		brightnessProp.id = 'prop-bright-1';
		brightnessProp.category = PropertyCategory.BRIGHTNESS;
		brightnessProp.permissions = [PermissionType.READ_WRITE];
		brightnessProp.value = new PropertyValueState(80);

		const ctProp = new ChannelPropertyEntity();
		ctProp.id = 'prop-ct-1';
		ctProp.category = PropertyCategory.COLOR_TEMPERATURE;
		ctProp.permissions = [PermissionType.READ_WRITE];
		ctProp.value = new PropertyValueState(2700);

		channel.properties = [onProp, brightnessProp, ctProp];
		device.channels = [channel];

		const accessory = mapper.buildAccessory(device, context);
		expect(accessory).not.toBeNull();

		const service = accessory?.getService(Service.Lightbulb);
		expect(service).toBeDefined();

		// Check characteristics exist
		const onChar = service?.getCharacteristic(Characteristic.On);
		expect(onChar).toBeDefined();

		const brightnessChar = service?.getCharacteristic(Characteristic.Brightness);
		expect(brightnessChar).toBeDefined();

		const ctChar = service?.getCharacteristic(Characteristic.ColorTemperature);
		expect(ctChar).toBeDefined();

		// Check bindings were registered
		expect(registeredBindings).toHaveLength(3);
		expect(registeredBindings.map((b) => b.propertyId)).toEqual(['prop-on-1', 'prop-bright-1', 'prop-ct-1']);

		// Test onSet dispatches command
		onChar?.setValue(false);
		expect(commandDispatcher.dispatch).toHaveBeenCalledWith('prop-on-1', false);

		brightnessChar?.setValue(50);
		expect(commandDispatcher.dispatch).toHaveBeenCalledWith('prop-bright-1', 50);
	});
});
