import { EventEmitter2 } from '@nestjs/event-emitter';

import {
	ChannelCategory,
	DataTypeType,
	DeviceCategory,
	EventType,
	PermissionType,
	PropertyCategory,
} from '../devices.constants';
import { DevicesNotFoundException, DevicesValidationException } from '../devices.exceptions';
import { ChannelEntity, ChannelPropertyEntity, DeviceEntity } from '../entities/devices.entity';
import { ChannelInputOccurrencePayload } from '../models/channel-input-occurrence.model';

import { ChannelInputDeduplicationService } from './channel-input-deduplication.service';
import { ChannelInputOccurrencesService } from './channel-input-occurrences.service';
import { ChannelsPropertiesService } from './channels.properties.service';
import { ChannelsService } from './channels.service';
import { DevicesService } from './devices.service';

describe('ChannelInputOccurrencesService', () => {
	let service: ChannelInputOccurrencesService;
	let devicesService: { findOne: jest.Mock };
	let channelsService: { findOne: jest.Mock };
	let channelsPropertiesService: { findOne: jest.Mock; findAll: jest.Mock };
	let deduplicationService: ChannelInputDeduplicationService;
	let eventEmitter: { emit: jest.Mock; on: jest.Mock; off: jest.Mock };

	const mockDevice = Object.assign(new DeviceEntity(), {
		id: 'dev-1',
		category: DeviceCategory.INPUT_CONTROLLER,
		name: 'Wall Controller',
		enabled: true,
	});

	const mockChannel = Object.assign(new ChannelEntity(), {
		id: 'ch-1',
		category: ChannelCategory.BUTTON,
		name: 'Button 1',
		device: mockDevice,
	});

	const mockProperty = Object.assign(new ChannelPropertyEntity(), {
		id: 'prop-1',
		category: PropertyCategory.EVENT,
		name: 'Press Event',
		dataType: DataTypeType.ENUM,
		permissions: [PermissionType.EVENT_ONLY],
		format: ['press', 'double_press', 'triple_press', 'long_press', 'release', 'down', 'up'],
		channel: mockChannel,
	});

	beforeEach(() => {
		devicesService = { findOne: jest.fn().mockResolvedValue(mockDevice) };
		channelsService = { findOne: jest.fn().mockResolvedValue(mockChannel) };
		channelsPropertiesService = { findOne: jest.fn().mockResolvedValue(mockProperty), findAll: jest.fn() };
		deduplicationService = new ChannelInputDeduplicationService();

		const handlers = new Map<string, Set<(payload: unknown) => void>>();
		eventEmitter = {
			emit: jest.fn((event: string, payload: unknown) => {
				const set = handlers.get(event);
				if (set) {
					for (const handler of set) {
						handler(payload);
					}
				}
				return true;
			}),
			on: jest.fn((event: string, handler: (payload: unknown) => void) => {
				if (!handlers.has(event)) {
					handlers.set(event, new Set());
				}
				handlers.get(event).add(handler);
			}),
			off: jest.fn((event: string, handler: (payload: unknown) => void) => {
				handlers.get(event)?.delete(handler);
			}),
		};

		service = new ChannelInputOccurrencesService(
			devicesService as unknown as DevicesService,
			channelsService as unknown as ChannelsService,
			channelsPropertiesService as unknown as ChannelsPropertiesService,
			deduplicationService,
			eventEmitter as unknown as EventEmitter2,
		);
	});

	describe('ingestOccurrence', () => {
		it('throws DevicesNotFoundException if device is not found', async () => {
			devicesService.findOne.mockResolvedValue(null);

			await expect(
				service.ingestOccurrence({
					deviceId: 'dev-unknown',
					channelId: 'ch-1',
					propertyId: 'prop-1',
					event: 'press',
				}),
			).rejects.toThrow(DevicesNotFoundException);
		});

		it('returns null and suppresses delivery if device is disabled', async () => {
			const disabledDevice = Object.assign(new DeviceEntity(), { ...mockDevice, enabled: false });
			devicesService.findOne.mockResolvedValue(disabledDevice);

			const result = await service.ingestOccurrence({
				deviceId: 'dev-1',
				channelId: 'ch-1',
				propertyId: 'prop-1',
				event: 'press',
			});

			expect(result).toBeNull();
			expect(eventEmitter.emit).not.toHaveBeenCalled();
		});

		it('throws DevicesNotFoundException if channel is not found', async () => {
			devicesService.findOne.mockResolvedValue(mockDevice);
			channelsService.findOne.mockResolvedValue(null);

			await expect(
				service.ingestOccurrence({
					deviceId: 'dev-1',
					channelId: 'ch-unknown',
					propertyId: 'prop-1',
					event: 'press',
				}),
			).rejects.toThrow(DevicesNotFoundException);
		});

		it('throws DevicesValidationException if channel belongs to a different device', async () => {
			const otherDevice = Object.assign(new DeviceEntity(), { id: 'dev-other' });
			const mismatchedChannel = Object.assign(new ChannelEntity(), {
				id: 'ch-1',
				device: otherDevice,
			});

			devicesService.findOne.mockResolvedValue(mockDevice);
			channelsService.findOne.mockResolvedValue(mismatchedChannel);

			await expect(
				service.ingestOccurrence({
					deviceId: 'dev-1',
					channelId: 'ch-1',
					propertyId: 'prop-1',
					event: 'press',
				}),
			).rejects.toThrow(DevicesValidationException);
		});

		it('throws DevicesNotFoundException if property is not found', async () => {
			devicesService.findOne.mockResolvedValue(mockDevice);
			channelsService.findOne.mockResolvedValue(mockChannel);
			channelsPropertiesService.findOne.mockResolvedValue(null);

			await expect(
				service.ingestOccurrence({
					deviceId: 'dev-1',
					channelId: 'ch-1',
					propertyId: 'prop-unknown',
					event: 'press',
				}),
			).rejects.toThrow(DevicesNotFoundException);
		});

		it('throws DevicesValidationException if property belongs to a different channel', async () => {
			const mismatchedProperty = Object.assign(new ChannelPropertyEntity(), {
				...mockProperty,
				channel: { id: 'ch-other' },
			});

			devicesService.findOne.mockResolvedValue(mockDevice);
			channelsService.findOne.mockResolvedValue(mockChannel);
			channelsPropertiesService.findOne.mockResolvedValue(mismatchedProperty);

			await expect(
				service.ingestOccurrence({
					deviceId: 'dev-1',
					channelId: 'ch-1',
					propertyId: 'prop-1',
					event: 'press',
				}),
			).rejects.toThrow(DevicesValidationException);
		});

		it('throws DevicesValidationException if property is not an input property (not ev/ro)', async () => {
			const writableProperty = Object.assign(new ChannelPropertyEntity(), {
				...mockProperty,
				permissions: [PermissionType.READ_WRITE],
			});

			devicesService.findOne.mockResolvedValue(mockDevice);
			channelsService.findOne.mockResolvedValue(mockChannel);
			channelsPropertiesService.findOne.mockResolvedValue(writableProperty);

			await expect(
				service.ingestOccurrence({
					deviceId: 'dev-1',
					channelId: 'ch-1',
					propertyId: 'prop-1',
					event: 'press',
				}),
			).rejects.toThrow(DevicesValidationException);
		});

		it('throws DevicesValidationException if channel is not an input channel and property has only READ_ONLY', async () => {
			const nonInputChannel = Object.assign(new ChannelEntity(), {
				id: 'ch-sensor',
				category: ChannelCategory.GENERIC,
				device: mockDevice,
			});
			const readOnlyProp = Object.assign(new ChannelPropertyEntity(), {
				...mockProperty,
				channel: nonInputChannel,
				permissions: [PermissionType.READ_ONLY],
			});

			devicesService.findOne.mockResolvedValue(mockDevice);
			channelsService.findOne.mockResolvedValue(nonInputChannel);
			channelsPropertiesService.findOne.mockResolvedValue(readOnlyProp);

			await expect(
				service.ingestOccurrence({
					deviceId: 'dev-1',
					channelId: 'ch-sensor',
					propertyId: 'prop-1',
					event: 'press',
				}),
			).rejects.toThrow(DevicesValidationException);
		});

		it('throws DevicesValidationException if event is not in format enum', async () => {
			devicesService.findOne.mockResolvedValue(mockDevice);
			channelsService.findOne.mockResolvedValue(mockChannel);
			channelsPropertiesService.findOne.mockResolvedValue(mockProperty);

			await expect(
				service.ingestOccurrence({
					deviceId: 'dev-1',
					channelId: 'ch-1',
					propertyId: 'prop-1',
					event: 'invalid_event',
				}),
			).rejects.toThrow(DevicesValidationException);
		});

		it('suppresses duplicate occurrence when sourceOccurrenceId is duplicated', async () => {
			devicesService.findOne.mockResolvedValue(mockDevice);
			channelsService.findOne.mockResolvedValue(mockChannel);
			channelsPropertiesService.findOne.mockResolvedValue(mockProperty);

			const first = await service.ingestOccurrence({
				deviceId: 'dev-1',
				channelId: 'ch-1',
				propertyId: 'prop-1',
				event: 'press',
				sourceOccurrenceId: 'src-dup-1',
			});

			expect(first).not.toBeNull();
			expect(eventEmitter.emit).toHaveBeenCalledTimes(1);

			const second = await service.ingestOccurrence({
				deviceId: 'dev-1',
				channelId: 'ch-1',
				propertyId: 'prop-1',
				event: 'press',
				sourceOccurrenceId: 'src-dup-1',
			});

			expect(second).toBeNull();
			expect(eventEmitter.emit).toHaveBeenCalledTimes(1);
		});

		it('allows subsequent occurrence with reused sourceOccurrenceId when event differs', async () => {
			devicesService.findOne.mockResolvedValue(mockDevice);
			channelsService.findOne.mockResolvedValue(mockChannel);
			channelsPropertiesService.findOne.mockResolvedValue(mockProperty);

			const first = await service.ingestOccurrence({
				deviceId: 'dev-1',
				channelId: 'ch-1',
				propertyId: 'prop-1',
				event: 'press',
				sourceOccurrenceId: 'shared-seq-1',
			});

			const second = await service.ingestOccurrence({
				deviceId: 'dev-1',
				channelId: 'ch-1',
				propertyId: 'prop-1',
				event: 'long_press',
				sourceOccurrenceId: 'shared-seq-1',
			});

			expect(first).not.toBeNull();
			expect(second).not.toBeNull();
			expect(eventEmitter.emit).toHaveBeenCalledTimes(2);
		});

		it('successfully delivers occurrence, emits event, and delivers to subscribers', async () => {
			devicesService.findOne.mockResolvedValue(mockDevice);
			channelsService.findOne.mockResolvedValue(mockChannel);
			channelsPropertiesService.findOne.mockResolvedValue(mockProperty);

			const subscriber = jest.fn();
			const unsubscribe = service.subscribe(subscriber);

			const occurrence = await service.ingestOccurrence({
				deviceId: 'dev-1',
				channelId: 'ch-1',
				propertyId: 'prop-1',
				event: 'triple_press',
				sourceOccurrenceId: 'src-unique-1',
			});

			expect(occurrence).not.toBeNull();
			expect(occurrence?.event).toBe('triple_press');
			expect(occurrence?.deviceId).toBe('dev-1');
			expect(occurrence?.channelId).toBe('ch-1');
			expect(occurrence?.propertyId).toBe('prop-1');
			expect(occurrence?.sourceOccurrenceId).toBe('src-unique-1');
			expect(occurrence?.endpoint).toBeNull();
			expect(occurrence?.id).toBeDefined();
			expect(occurrence?.timestamp).toBeDefined();

			expect(eventEmitter.emit).toHaveBeenCalledWith(
				EventType.CHANNEL_INPUT_OCCURRENCE,
				expect.objectContaining({
					event: 'triple_press',
					deviceId: 'dev-1',
				}),
			);

			expect(subscriber).toHaveBeenCalledWith(occurrence);

			// Test unsubscribe
			unsubscribe();

			await service.ingestOccurrence({
				deviceId: 'dev-1',
				channelId: 'ch-1',
				propertyId: 'prop-1',
				event: 'press',
			});

			expect(subscriber).toHaveBeenCalledTimes(1);
		});

		it('populates endpoint and integration from native device identifier and type', async () => {
			class ShellyDeviceEntity extends DeviceEntity {}
			const nativeDevice = Object.assign(new ShellyDeviceEntity(), {
				...mockDevice,
				identifier: 'shelly-123456',
			});
			devicesService.findOne.mockResolvedValue(nativeDevice);
			channelsService.findOne.mockResolvedValue(mockChannel);
			channelsPropertiesService.findOne.mockResolvedValue(mockProperty);

			const occurrence = await service.ingestOccurrence({
				deviceId: 'dev-1',
				channelId: 'ch-1',
				propertyId: 'prop-1',
				event: 'press',
			});

			expect(occurrence?.integration).toBe('shellydeviceentity');
			expect(occurrence?.endpoint).toBe('shelly-123456');
		});

		it('isolates async subscriber rejection so other subscribers still receive occurrences', async () => {
			devicesService.findOne.mockResolvedValue(mockDevice);
			channelsService.findOne.mockResolvedValue(mockChannel);
			channelsPropertiesService.findOne.mockResolvedValue(mockProperty);

			const rejectingSubscriber = jest.fn().mockRejectedValue(new Error('Async subscriber failed'));
			const goodSubscriber = jest.fn();

			service.subscribe(rejectingSubscriber);
			service.subscribe(goodSubscriber);

			const occurrence = await service.ingestOccurrence({
				deviceId: 'dev-1',
				channelId: 'ch-1',
				propertyId: 'prop-1',
				event: 'press',
			});

			expect(goodSubscriber).toHaveBeenCalledWith(occurrence);
			expect(rejectingSubscriber).toHaveBeenCalledWith(occurrence);
		});

		it('isolates subscriber errors so other subscribers still receive occurrences', async () => {
			devicesService.findOne.mockResolvedValue(mockDevice);
			channelsService.findOne.mockResolvedValue(mockChannel);
			channelsPropertiesService.findOne.mockResolvedValue(mockProperty);

			const faultySubscriber = jest.fn(() => {
				throw new Error('Subscriber exploded');
			});
			const goodSubscriber = jest.fn();

			service.subscribe(faultySubscriber);
			service.subscribe(goodSubscriber);

			const occurrence = await service.ingestOccurrence({
				deviceId: 'dev-1',
				channelId: 'ch-1',
				propertyId: 'prop-1',
				event: 'press',
			});

			expect(occurrence).not.toBeNull();
			expect(faultySubscriber).toHaveBeenCalled();
			expect(goodSubscriber).toHaveBeenCalledWith(occurrence);
		});
	});

	describe('getInputCapabilities', () => {
		it('returns null when channel does not exist', async () => {
			channelsService.findOne.mockResolvedValue(null);

			const result = await service.getInputCapabilities('ch-nonexistent');
			expect(result).toBeNull();
		});

		it('discovers button capabilities with supported gestures', async () => {
			const channelWithProperties = Object.assign(new ChannelEntity(), {
				...mockChannel,
				properties: [mockProperty],
			});
			channelsService.findOne.mockResolvedValue(channelWithProperties);

			const result = await service.getInputCapabilities('ch-1');

			expect(result).not.toBeNull();
			expect(result?.channel_id).toBe('ch-1');
			expect(result?.category).toBe(ChannelCategory.BUTTON);
			expect(result?.is_input).toBe(true);
			expect(result?.supported_events).toEqual([
				'press',
				'double_press',
				'triple_press',
				'long_press',
				'release',
				'down',
				'up',
			]);
			expect(result?.properties).toHaveLength(1);
			expect(result?.properties[0]).toEqual({
				id: 'prop-1',
				category: PropertyCategory.EVENT,
				permissions: [PermissionType.EVENT_ONLY],
				data_type: DataTypeType.ENUM,
				format: ['press', 'double_press', 'triple_press', 'long_press', 'release', 'down', 'up'],
			});
		});
	});

	describe('Acceptance Criteria Consumer Scenarios', () => {
		it('Example 1: Button 1 single click triggers light toggle; consecutive clicks delivered without suppression', async () => {
			devicesService.findOne.mockResolvedValue(mockDevice);
			channelsService.findOne.mockResolvedValue(mockChannel);
			channelsPropertiesService.findOne.mockResolvedValue(mockProperty);

			let lightState = false;
			const testActionConsumer = jest.fn((occ: ChannelInputOccurrencePayload) => {
				if (occ.channelId === 'ch-1' && occ.event === 'press') {
					lightState = !lightState;
				}
			});

			service.subscribe(testActionConsumer);

			// First single click
			await service.ingestOccurrence({
				deviceId: 'dev-1',
				channelId: 'ch-1',
				propertyId: 'prop-1',
				event: 'press',
			});

			expect(lightState).toBe(true);

			// Second consecutive single click (same event 'press')
			// In a property-state-only architecture, identical value updates might be suppressed.
			// Hardware input occurrences must deliver every click!
			await service.ingestOccurrence({
				deviceId: 'dev-1',
				channelId: 'ch-1',
				propertyId: 'prop-1',
				event: 'press',
			});

			expect(lightState).toBe(false);

			// Third consecutive click
			await service.ingestOccurrence({
				deviceId: 'dev-1',
				channelId: 'ch-1',
				propertyId: 'prop-1',
				event: 'press',
			});

			expect(lightState).toBe(true);
			expect(testActionConsumer).toHaveBeenCalledTimes(3);
		});

		it('Example 2: Button 2 double click sets light brightness to 100%', async () => {
			const channel2 = Object.assign(new ChannelEntity(), {
				id: 'ch-2',
				category: ChannelCategory.BUTTON,
				name: 'Button 2',
				device: mockDevice,
			});

			const prop2 = Object.assign(new ChannelPropertyEntity(), {
				id: 'prop-2',
				category: PropertyCategory.EVENT,
				name: 'Press Event',
				dataType: DataTypeType.ENUM,
				permissions: [PermissionType.EVENT_ONLY],
				format: ['press', 'double_press', 'triple_press', 'long_press'],
				channel: channel2,
			});

			devicesService.findOne.mockResolvedValue(mockDevice);
			channelsService.findOne.mockResolvedValue(channel2);
			channelsPropertiesService.findOne.mockResolvedValue(prop2);

			let lightBrightness = 0;
			const testActionConsumer = jest.fn((occ: ChannelInputOccurrencePayload) => {
				if (occ.channelId === 'ch-2' && occ.event === 'double_press') {
					lightBrightness = 100;
				}
			});

			service.subscribe(testActionConsumer);

			await service.ingestOccurrence({
				deviceId: 'dev-1',
				channelId: 'ch-2',
				propertyId: 'prop-2',
				event: 'double_press',
			});

			expect(lightBrightness).toBe(100);
			expect(testActionConsumer).toHaveBeenCalledTimes(1);
		});
	});
});
