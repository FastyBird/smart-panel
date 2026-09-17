import { Characteristic } from '@homebridge/hap-nodejs';

import { ChannelCategory, PropertyCategory } from '../../../modules/devices/devices.constants';
import { ChannelPropertyEntity } from '../../../modules/devices/entities/devices.entity';
import { ChannelInputOccurrencePayload } from '../../../modules/devices/models/channel-input-occurrence.model';
import { PropertyValueState } from '../../../modules/devices/models/property-value-state.model';
import { HomeKitMapperRegistryService } from '../services/homekit-mapper-registry.service';

import { HomeKitEventListener } from './homekit-event.listener';

describe('HomeKitEventListener', () => {
	let listener: HomeKitEventListener;
	let mapperRegistry: {
		getBindingsForProperty: jest.Mock;
		getListenersForProperty: jest.Mock;
		getOccurrenceListeners: jest.Mock;
	};
	let mockCharacteristic: { updateValue: jest.Mock };

	beforeEach(() => {
		mockCharacteristic = { updateValue: jest.fn() };
		mapperRegistry = {
			getBindingsForProperty: jest.fn(),
			getListenersForProperty: jest.fn().mockReturnValue([]),
			getOccurrenceListeners: jest.fn().mockReturnValue([]),
		};
		listener = new HomeKitEventListener(mapperRegistry as unknown as HomeKitMapperRegistryService);
	});

	it('should update characteristic and notify listeners when property value changes', () => {
		const property = new ChannelPropertyEntity();
		property.id = 'prop-test-1';
		property.value = new PropertyValueState(true);

		const binding = {
			deviceId: 'dev-1',
			channelId: 'chan-1',
			propertyId: 'prop-test-1',
			characteristic: mockCharacteristic as unknown as Characteristic,
			toHomeKit: (val: unknown) => Boolean(val),
			currentValue: false,
			revision: 0,
		};

		const mockPropertyListener = { onPropertyChanged: jest.fn() };

		mapperRegistry.getBindingsForProperty.mockReturnValue([binding]);
		mapperRegistry.getListenersForProperty.mockReturnValue([mockPropertyListener]);

		listener.handlePropertyValueChanged(property);

		expect(mockCharacteristic.updateValue).toHaveBeenCalledWith(true);
		expect(binding.currentValue).toBe(true);
		expect(binding.revision).toBe(1);
		expect(mockPropertyListener.onPropertyChanged).toHaveBeenCalledWith(property, true);
	});

	it('should ignore properties with no HomeKit bindings and no listeners', () => {
		const property = new ChannelPropertyEntity();
		property.id = 'prop-unbound';
		property.value = new PropertyValueState(123);

		mapperRegistry.getBindingsForProperty.mockReturnValue([]);
		mapperRegistry.getListenersForProperty.mockReturnValue([]);

		listener.handlePropertyValueChanged(property);

		expect(mockCharacteristic.updateValue).not.toHaveBeenCalled();
	});

	it('should suppress only the pending previous HAP value after conversion', () => {
		const property = new ChannelPropertyEntity();
		property.id = 'prop-pending';
		property.value = new PropertyValueState('off');
		const binding = {
			deviceId: 'dev-1',
			channelId: 'chan-1',
			propertyId: property.id,
			characteristic: mockCharacteristic as unknown as Characteristic,
			toHomeKit: (value: unknown) => (value === 'on' ? 1 : 0),
			currentValue: 1,
			revision: 3,
			pendingWrite: {
				token: 1,
				previousValue: 0,
				requestedValue: 1,
				startingRevision: 2,
			},
		};

		mapperRegistry.getBindingsForProperty.mockReturnValue([binding]);

		listener.handlePropertyValueChanged(property);

		expect(mockCharacteristic.updateValue).not.toHaveBeenCalled();
		expect(binding.currentValue).toBe(1);
		expect(binding.revision).toBe(3);
		expect(binding.pendingWrite).toBeDefined();

		property.value = new PropertyValueState('on');
		listener.handlePropertyValueChanged(property);

		expect(mockCharacteristic.updateValue).toHaveBeenCalledWith(1);
		expect(binding.revision).toBe(4);
		expect(binding.pendingWrite).toBeUndefined();
	});

	describe('handleChannelInputOccurrence', () => {
		it('should route occurrence to registered occurrence listeners', () => {
			const mockOccListener = {
				deviceId: 'dev-1',
				channelId: 'chan-1',
				propertyId: 'prop-event-1',
				onOccurrence: jest.fn(),
			};
			mapperRegistry.getOccurrenceListeners.mockReturnValue([mockOccListener]);

			const occurrence: ChannelInputOccurrencePayload = {
				id: 'occ-1',
				deviceId: 'dev-1',
				channelId: 'chan-1',
				propertyId: 'prop-event-1',
				channelCategory: ChannelCategory.BUTTON,
				propertyCategory: PropertyCategory.EVENT,
				event: 'press',
				timestamp: new Date().toISOString(),
			};

			listener.handleChannelInputOccurrence(occurrence);

			expect(mapperRegistry.getOccurrenceListeners).toHaveBeenCalledWith('prop-event-1', 'chan-1');
			expect(mockOccListener.onOccurrence).toHaveBeenCalledWith(occurrence);
		});

		it('should safely ignore undefined occurrences or occurrences without propertyId', () => {
			listener.handleChannelInputOccurrence(null as unknown as ChannelInputOccurrencePayload);
			listener.handleChannelInputOccurrence({} as unknown as ChannelInputOccurrencePayload);
			expect(mapperRegistry.getOccurrenceListeners).not.toHaveBeenCalled();
		});

		it('should catch and log errors in occurrence listener without throwing', () => {
			const mockOccListener = {
				deviceId: 'dev-1',
				channelId: 'chan-1',
				propertyId: 'prop-event-1',
				onOccurrence: jest.fn().mockImplementation(() => {
					throw new Error('HAP failure');
				}),
			};
			mapperRegistry.getOccurrenceListeners.mockReturnValue([mockOccListener]);

			const occurrence: ChannelInputOccurrencePayload = {
				id: 'occ-1',
				deviceId: 'dev-1',
				channelId: 'chan-1',
				propertyId: 'prop-event-1',
				channelCategory: ChannelCategory.BUTTON,
				propertyCategory: PropertyCategory.EVENT,
				event: 'press',
				timestamp: new Date().toISOString(),
			};

			expect(() => listener.handleChannelInputOccurrence(occurrence)).not.toThrow();
			expect(mockOccListener.onOccurrence).toHaveBeenCalledWith(occurrence);
		});
	});
});
