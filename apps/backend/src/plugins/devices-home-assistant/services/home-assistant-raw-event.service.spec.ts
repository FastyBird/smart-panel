/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/unbound-method */
import { ChannelCategory, PropertyCategory } from '../../../modules/devices/devices.constants';
import { ChannelInputOccurrencesService } from '../../../modules/devices/services/channel-input-occurrences.service';
import { ChannelsPropertiesService } from '../../../modules/devices/services/channels.properties.service';
import { ChannelsService } from '../../../modules/devices/services/channels.service';
import { DevicesService } from '../../../modules/devices/services/devices.service';
import {
	HomeAssistantChannelEntity,
	HomeAssistantChannelPropertyEntity,
	HomeAssistantDeviceEntity,
} from '../entities/devices-home-assistant.entity';

import { HomeAssistantRawEventService } from './home-assistant-raw-event.service';

describe('HomeAssistantRawEventService', () => {
	let service: HomeAssistantRawEventService;
	let devicesService: jest.Mocked<DevicesService>;
	let channelsService: jest.Mocked<ChannelsService>;
	let channelsPropertiesService: jest.Mocked<ChannelsPropertiesService>;
	let inputOccurrencesService: jest.Mocked<ChannelInputOccurrencesService>;

	beforeEach(() => {
		devicesService = {
			findAll: jest.fn(),
		} as unknown as jest.Mocked<DevicesService>;

		channelsService = {
			findAll: jest.fn(),
		} as unknown as jest.Mocked<ChannelsService>;

		channelsPropertiesService = {
			findAll: jest.fn(),
		} as unknown as jest.Mocked<ChannelsPropertiesService>;

		inputOccurrencesService = {
			publishOccurrence: jest.fn(),
		} as unknown as jest.Mocked<ChannelInputOccurrencesService>;

		service = new HomeAssistantRawEventService(
			devicesService,
			channelsService,
			channelsPropertiesService,
			inputOccurrencesService,
		);
	});

	describe('parseZhaEvent', () => {
		it('parses valid zha_event commands correctly', () => {
			const parsed = service.parseZhaEvent({
				device_ieee: '00:15:8d:00:01:23:45:67',
				command: 'button_single',
				endpoint_id: 1,
			});

			expect(parsed).toEqual({
				deviceIdentifier: '00:15:8d:00:01:23:45:67',
				eventType: 'press',
				nativeCommand: 'button_single',
				endpointId: 1,
				sourceOccurrenceId: expect.stringContaining('00:15:8d:00:01:23:45:67:button_single:'),
			});
		});

		it('parses hold/move command as long_press', () => {
			const parsed = service.parseZhaEvent({
				device_ieee: '00:15:8d:00:01:23:45:67',
				command: 'button_hold',
			});

			expect(parsed?.eventType).toBe('long_press');
		});

		it('returns null if missing required attributes', () => {
			expect(service.parseZhaEvent({})).toBeNull();
			expect(service.parseZhaEvent({ device_ieee: '00:11:22' })).toBeNull();
		});
	});

	describe('parseDeconzEvent', () => {
		it('parses valid deconz_event payload with button number and gesture', () => {
			const parsed = service.parseDeconzEvent({
				id: 'smart_switch_1',
				event: 2002, // Button 2, short press
			});

			expect(parsed).toEqual({
				deviceIdentifier: 'smart_switch_1',
				eventType: 'press',
				nativeCommand: '2002',
				endpointId: 2,
				sourceOccurrenceId: expect.stringContaining('smart_switch_1:2002:'),
			});
		});

		it('parses hold gesture (01) as long_press', () => {
			const parsed = service.parseDeconzEvent({
				unique_id: '00:11:22:33:44:55:66:77',
				event: 1001,
			});

			expect(parsed?.eventType).toBe('long_press');
			expect(parsed?.endpointId).toBe(1);
		});

		it('returns null if missing id or event number', () => {
			expect(service.parseDeconzEvent({})).toBeNull();
			expect(service.parseDeconzEvent({ id: 'switch' })).toBeNull();
		});
	});

	describe('diagnoseUnsupportedEvent', () => {
		it('returns actionable diagnostic for arbitrary event bus events', () => {
			const msg = service.diagnoseUnsupportedEvent('custom_user_event', { foo: 'bar' });
			expect(msg).toContain('Unsupported raw event source "custom_user_event"');
			expect(msg).toContain("To integrate buttons reliably, use standard Home Assistant 'event.*' entities.");
		});

		it('returns diagnostic for malformed zha_event', () => {
			const msg = service.diagnoseUnsupportedEvent('zha_event', {});
			expect(msg).toContain('Incomplete payload for documented raw event "zha_event"');
		});
	});

	describe('handle', () => {
		it('routes and publishes occurrence for matching adopted device', async () => {
			const device: HomeAssistantDeviceEntity = {
				id: 'dev-1',
				haDeviceId: '00:15:8d:00:01:23:45:67',
			} as HomeAssistantDeviceEntity;

			const channel: HomeAssistantChannelEntity = {
				id: 'chan-1',
				category: ChannelCategory.BUTTON,
			} as HomeAssistantChannelEntity;

			const property: HomeAssistantChannelPropertyEntity = {
				id: 'prop-1',
				category: PropertyCategory.EVENT,
			} as HomeAssistantChannelPropertyEntity;

			devicesService.findAll.mockResolvedValue([device]);
			channelsService.findAll.mockResolvedValue([channel]);
			channelsPropertiesService.findAll.mockResolvedValue([property]);

			await service.handle({
				event_type: 'zha_event',
				data: {
					device_ieee: '00:15:8d:00:01:23:45:67',
					command: 'single',
				},
			});

			expect(inputOccurrencesService.publishOccurrence).toHaveBeenCalledWith(
				expect.objectContaining({
					deviceId: 'dev-1',
					channelId: 'chan-1',
					propertyId: 'prop-1',
					event: 'press',
					nativeEventType: 'single',
				}),
			);
		});

		it('does nothing when device is not adopted', async () => {
			devicesService.findAll.mockResolvedValue([]);

			await service.handle({
				event_type: 'zha_event',
				data: {
					device_ieee: 'unknown_ieee',
					command: 'press',
				},
			});

			expect(inputOccurrencesService.publishOccurrence).not.toHaveBeenCalled();
		});
	});
});
