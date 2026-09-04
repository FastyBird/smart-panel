import { Characteristic } from '@homebridge/hap-nodejs';

import { ChannelPropertyEntity } from '../../../modules/devices/entities/devices.entity';
import { PropertyValueState } from '../../../modules/devices/models/property-value-state.model';
import { HomeKitMapperRegistryService } from '../services/homekit-mapper-registry.service';

import { HomeKitEventListener } from './homekit-event.listener';

describe('HomeKitEventListener', () => {
	let listener: HomeKitEventListener;
	let mapperRegistry: { getBindingsForProperty: jest.Mock };
	let mockCharacteristic: { updateValue: jest.Mock };

	beforeEach(() => {
		mockCharacteristic = { updateValue: jest.fn() };
		mapperRegistry = {
			getBindingsForProperty: jest.fn(),
		};
		listener = new HomeKitEventListener(mapperRegistry as unknown as HomeKitMapperRegistryService);
	});

	it('should update characteristic when property value changes', () => {
		const property = new ChannelPropertyEntity();
		property.id = 'prop-test-1';
		property.value = new PropertyValueState(true);

		mapperRegistry.getBindingsForProperty.mockReturnValue([
			{
				deviceId: 'dev-1',
				channelId: 'chan-1',
				propertyId: 'prop-test-1',
				characteristic: mockCharacteristic as unknown as Characteristic,
				toHomeKit: (val: unknown) => Boolean(val),
			},
		]);

		listener.handlePropertyValueChanged(property);

		expect(mockCharacteristic.updateValue).toHaveBeenCalledWith(true);
	});

	it('should ignore properties with no HomeKit bindings', () => {
		const property = new ChannelPropertyEntity();
		property.id = 'prop-unbound';
		property.value = new PropertyValueState(123);

		mapperRegistry.getBindingsForProperty.mockReturnValue([]);

		listener.handlePropertyValueChanged(property);

		expect(mockCharacteristic.updateValue).not.toHaveBeenCalled();
	});
});
