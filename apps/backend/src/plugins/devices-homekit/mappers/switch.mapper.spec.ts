import { Characteristic, Service } from '@homebridge/hap-nodejs';

import { ChannelCategory, DeviceCategory, PropertyCategory } from '../../../modules/devices/devices.constants';
import { ChannelEntity, ChannelPropertyEntity, DeviceEntity } from '../../../modules/devices/entities/devices.entity';
import { PropertyValueState } from '../../../modules/devices/models/property-value-state.model';
import { HomeKitCommandDispatcher } from '../services/homekit-command.dispatcher';

import { CharacteristicBinding, HomeKitMapperContext } from './homekit-mapper.interface';
import { SwitchMapper } from './switch.mapper';

describe('SwitchMapper', () => {
	let mapper: SwitchMapper;
	let commandDispatcher: { dispatch: jest.Mock };
	let registeredBindings: CharacteristicBinding[];
	let context: HomeKitMapperContext;

	beforeEach(() => {
		mapper = new SwitchMapper();
		commandDispatcher = { dispatch: jest.fn().mockResolvedValue(undefined) };
		registeredBindings = [];
		context = {
			commandDispatcher: commandDispatcher as unknown as HomeKitCommandDispatcher,
			registerBinding: (binding) => registeredBindings.push(binding),
		};
	});

	it('should build Switch accessory and bind On characteristic', () => {
		const device = new DeviceEntity();
		device.id = 'dev-sw-1';
		device.name = 'Kitchen Switch';
		device.category = DeviceCategory.SWITCHER;

		const channel = new ChannelEntity();
		channel.id = 'chan-sw-1';
		channel.category = ChannelCategory.SWITCHER;

		const onProp = new ChannelPropertyEntity();
		onProp.id = 'prop-on-sw';
		onProp.category = PropertyCategory.ON;
		onProp.value = new PropertyValueState(false);

		channel.properties = [onProp];
		device.channels = [channel];

		const accessory = mapper.buildAccessory(device, context);
		expect(accessory).not.toBeNull();

		const service = accessory?.getService(Service.Switch);
		expect(service).toBeDefined();

		const onChar = service?.getCharacteristic(Characteristic.On);
		expect(onChar).toBeDefined();

		expect(registeredBindings).toHaveLength(1);
		expect(registeredBindings[0].propertyId).toBe('prop-on-sw');

		onChar?.setValue(true);
		expect(commandDispatcher.dispatch).toHaveBeenCalledWith('prop-on-sw', true);
	});
});
