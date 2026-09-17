/*
Reason: The mocking and test setup requires dynamic assignment and
handling of Jest mocks, which ESLint rules flag unnecessarily.
*/
/* eslint-disable @typescript-eslint/unbound-method, @typescript-eslint/no-unsafe-member-access */
import { ChannelInputOccurrencesService } from '../../../modules/devices/services/channel-input-occurrences.service';
import { ChannelsPropertiesService } from '../../../modules/devices/services/channels.properties.service';
import { ChannelsService } from '../../../modules/devices/services/channels.service';
import {
	DEFAULT_BUTTON_DOUBLE_PRESS_MS,
	DEFAULT_BUTTON_LONG_PRESS_MS,
	DEVICES_RETERMINAL_TYPE,
	RETERMINAL_CHANNEL_IDENTIFIERS,
} from '../devices-reterminal.constants';
import {
	ReTerminalChannelEntity,
	ReTerminalChannelPropertyEntity,
	ReTerminalDeviceEntity,
} from '../entities/devices-reterminal.entity';

import { ReTerminalButtonService } from './reterminal-button.service';

describe('ReTerminalButtonService', () => {
	let service: ReTerminalButtonService;
	let channelsService: jest.Mocked<ChannelsService>;
	let channelsPropertiesService: jest.Mocked<ChannelsPropertiesService>;
	let occurrencesService: jest.Mocked<ChannelInputOccurrencesService>;

	const mockDevice = {
		id: 'device-reterminal-1',
		type: DEVICES_RETERMINAL_TYPE,
	} as unknown as ReTerminalDeviceEntity;

	const mockChannel = {
		id: 'channel-btn-f1',
		identifier: RETERMINAL_CHANNEL_IDENTIFIERS.BUTTON_F1,
		device: mockDevice,
	} as unknown as ReTerminalChannelEntity;

	const mockDetectedProp = {
		id: 'prop-detected-f1',
		identifier: 'detected',
		value: false,
	} as unknown as ReTerminalChannelPropertyEntity;

	const mockEventProp = {
		id: 'prop-event-f1',
		identifier: 'event',
		value: null,
	} as unknown as ReTerminalChannelPropertyEntity;

	beforeEach(() => {
		jest.useFakeTimers();

		channelsService = {
			findAll: jest.fn().mockResolvedValue([mockChannel]),
			findOneBy: jest.fn().mockResolvedValue(mockChannel),
		} as unknown as jest.Mocked<ChannelsService>;

		channelsPropertiesService = {
			findAll: jest.fn().mockResolvedValue([mockDetectedProp, mockEventProp]),
			findOneBy: jest.fn().mockImplementation((_col: string, val: string) => {
				if (val === 'event') return Promise.resolve(mockEventProp);
				if (val === 'detected') return Promise.resolve(mockDetectedProp);
				return Promise.resolve(null);
			}),
			update: jest.fn().mockResolvedValue(mockDetectedProp),
		} as unknown as jest.Mocked<ChannelsPropertiesService>;

		occurrencesService = {
			publishOccurrence: jest.fn().mockResolvedValue({
				id: 'occ-1',
				deviceId: mockDevice.id,
				channelId: mockChannel.id,
				propertyId: mockEventProp.id,
				event: 'press',
			}),
		} as unknown as jest.Mocked<ChannelInputOccurrencesService>;

		service = new ReTerminalButtonService(channelsService, channelsPropertiesService, occurrencesService);
		(service as any).deviceId = mockDevice.id;
	});

	afterEach(() => {
		jest.clearAllTimers();
		jest.useRealTimers();
		jest.clearAllMocks();
	});

	const flushPromises = async () => {
		for (let i = 0; i < 10; i++) {
			await Promise.resolve();
		}
	};

	const createBuffer = (type: number, code: number, value: number) => {
		const buf = Buffer.alloc(24);
		buf.writeBigInt64LE(BigInt(0), 0);
		buf.writeBigInt64LE(BigInt(0), 8);
		buf.writeUInt16LE(type, 16);
		buf.writeUInt16LE(code, 18);
		buf.writeInt32LE(value, 20);
		return buf;
	};

	it('updates detected property immediately on press and release (held state)', async () => {
		// Press (EV_KEY, code 30 -> KEY_A -> BUTTON_F1, value 1)
		service.handleInputEvent(createBuffer(1, 30, 1));
		await flushPromises();

		expect(channelsPropertiesService.update).toHaveBeenCalledWith(
			mockDetectedProp.id,
			expect.objectContaining({ value: true }),
		);
		expect(occurrencesService.publishOccurrence).not.toHaveBeenCalled();

		// Release (EV_KEY, code 30, value 0)
		service.handleInputEvent(createBuffer(1, 30, 0));
		await flushPromises();

		expect(channelsPropertiesService.update).toHaveBeenCalledWith(
			mockDetectedProp.id,
			expect.objectContaining({ value: false }),
		);
	});

	it('publishes single press occurrence after double press window expires', async () => {
		// Press and immediate release
		service.handleInputEvent(createBuffer(1, 30, 1));
		service.handleInputEvent(createBuffer(1, 30, 0));
		await flushPromises();

		// Not published immediately
		expect(occurrencesService.publishOccurrence).not.toHaveBeenCalled();

		// Advance past double press timeout
		jest.advanceTimersByTime(DEFAULT_BUTTON_DOUBLE_PRESS_MS + 10);
		await flushPromises();

		expect(occurrencesService.publishOccurrence).toHaveBeenCalledWith(
			expect.objectContaining({
				deviceId: mockDevice.id,
				channelId: mockChannel.id,
				propertyId: mockEventProp.id,
				event: 'press',
			}),
		);
	});

	it('publishes double_press occurrence and cancels single press when clicked twice quickly', async () => {
		// First click
		service.handleInputEvent(createBuffer(1, 30, 1));
		service.handleInputEvent(createBuffer(1, 30, 0));
		await flushPromises();

		// Wait 100ms (within double press window)
		jest.advanceTimersByTime(100);
		await flushPromises();

		// Second click
		service.handleInputEvent(createBuffer(1, 30, 1));
		service.handleInputEvent(createBuffer(1, 30, 0));
		await flushPromises();

		// Double press should fire immediately on second release
		expect(occurrencesService.publishOccurrence).toHaveBeenCalledWith(
			expect.objectContaining({
				deviceId: mockDevice.id,
				channelId: mockChannel.id,
				propertyId: mockEventProp.id,
				event: 'double_press',
			}),
		);

		// Advancing time should NOT trigger single press
		jest.advanceTimersByTime(DEFAULT_BUTTON_DOUBLE_PRESS_MS + 50);
		await flushPromises();

		expect(occurrencesService.publishOccurrence).toHaveBeenCalledTimes(1);
	});

	it('publishes long_press occurrence when held past long press threshold', async () => {
		// Press down
		service.handleInputEvent(createBuffer(1, 30, 1));
		await flushPromises();

		// Advance past long press duration
		jest.advanceTimersByTime(DEFAULT_BUTTON_LONG_PRESS_MS + 10);
		await flushPromises();

		expect(occurrencesService.publishOccurrence).toHaveBeenCalledWith(
			expect.objectContaining({
				deviceId: mockDevice.id,
				channelId: mockChannel.id,
				propertyId: mockEventProp.id,
				event: 'long_press',
			}),
		);

		// Release afterwards should not fire press or double_press
		service.handleInputEvent(createBuffer(1, 30, 0));
		jest.advanceTimersByTime(DEFAULT_BUTTON_DOUBLE_PRESS_MS + 50);
		await flushPromises();

		expect(occurrencesService.publishOccurrence).toHaveBeenCalledTimes(1);
	});

	it('publishes two discrete occurrences for consecutive identical clicks outside the double press window', async () => {
		// First click
		service.handleInputEvent(createBuffer(1, 30, 1));
		service.handleInputEvent(createBuffer(1, 30, 0));
		jest.advanceTimersByTime(DEFAULT_BUTTON_DOUBLE_PRESS_MS + 50);
		await flushPromises();

		// Second click
		service.handleInputEvent(createBuffer(1, 30, 1));
		service.handleInputEvent(createBuffer(1, 30, 0));
		jest.advanceTimersByTime(DEFAULT_BUTTON_DOUBLE_PRESS_MS + 50);
		await flushPromises();

		expect(occurrencesService.publishOccurrence).toHaveBeenCalledTimes(2);
		expect(occurrencesService.publishOccurrence).toHaveBeenNthCalledWith(
			1,
			expect.objectContaining({ event: 'press' }),
		);
		expect(occurrencesService.publishOccurrence).toHaveBeenNthCalledWith(
			2,
			expect.objectContaining({ event: 'press' }),
		);
	});

	it('suppresses evdev autorepeat (repeated value=1 while held)', async () => {
		// Press
		service.handleInputEvent(createBuffer(1, 30, 1));
		await flushPromises();
		expect(channelsPropertiesService.update).toHaveBeenCalledTimes(1);

		// Autorepeat press event (kernel sends value=1 again or value=2)
		service.handleInputEvent(createBuffer(1, 30, 1));
		service.handleInputEvent(createBuffer(1, 30, 2)); // EV_KEY value=2 is repeat
		await flushPromises();

		// Should not have triggered update again
		expect(channelsPropertiesService.update).toHaveBeenCalledTimes(1);
	});

	it('cleans up pending timers on stop', async () => {
		service.handleInputEvent(createBuffer(1, 30, 1));
		service.handleInputEvent(createBuffer(1, 30, 0));
		await flushPromises();

		service.stop();

		jest.advanceTimersByTime(DEFAULT_BUTTON_DOUBLE_PRESS_MS + 100);
		await flushPromises();
		expect(occurrencesService.publishOccurrence).not.toHaveBeenCalled();
	});
});
