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
		it('prefers device_id registry identifier when present', () => {
			const parsed = service.parseZhaEvent({
				device_id: 'ha_reg_device_123',
				device_ieee: '00:15:8d:00:01:23:45:67',
				unique_id: 'some_unique_id',
				command: 'button_single',
				endpoint_id: 1,
			});

			expect(parsed).toEqual({
				deviceIdentifier: 'ha_reg_device_123',
				eventType: 'press',
				nativeCommand: 'button_single',
				endpointId: 1,
				sourceOccurrenceId: expect.stringContaining('ha_reg_device_123:button_single:'),
			});
		});

		it('falls back to device_ieee when device_id is omitted', () => {
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

		it('generates collision-resistant unique sourceOccurrenceId for consecutive same-command events', () => {
			const event1 = service.parseZhaEvent({
				device_ieee: '00:15:8d:00:01:23:45:67',
				command: 'button_single',
			});
			const event2 = service.parseZhaEvent({
				device_ieee: '00:15:8d:00:01:23:45:67',
				command: 'button_single',
			});

			expect(event1?.sourceOccurrenceId).not.toEqual(event2?.sourceOccurrenceId);
			expect(event1?.sourceOccurrenceId).toMatch(/^00:15:8d:00:01:23:45:67:button_single:\d+_\d+$/);
			expect(event2?.sourceOccurrenceId).toMatch(/^00:15:8d:00:01:23:45:67:button_single:\d+_\d+$/);
		});

		it('uses upstream context ID in sourceOccurrenceId when provided', () => {
			const event = service.parseZhaEvent(
				{
					device_ieee: '00:15:8d:00:01:23:45:67',
					command: 'button_single',
				},
				'ctx-upstream-123',
			);

			expect(event?.sourceOccurrenceId).toBe('00:15:8d:00:01:23:45:67:button_single:ctx-upstream-123');
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

		it('returns null for unsupported deCONZ action codes', () => {
			// Action code 6 is not mapped
			expect(service.parseDeconzEvent({ id: 'smart_switch_1', event: 1006 })).toBeNull();
			// Action code 99 is not mapped
			expect(service.parseDeconzEvent({ id: 'smart_switch_1', event: 2099 })).toBeNull();
		});

		it('returns null for non-integer event numbers', () => {
			expect(service.parseDeconzEvent({ id: 'smart_switch_1', event: 1002.5 })).toBeNull();
			expect(service.parseDeconzEvent({ id: 'smart_switch_1', event: Number.NaN })).toBeNull();
		});

		it('returns null if missing id or event number', () => {
			expect(service.parseDeconzEvent({})).toBeNull();
			expect(service.parseDeconzEvent({ id: 'switch' })).toBeNull();
		});

		it('generates collision-resistant unique sourceOccurrenceId for consecutive same-command events', () => {
			const event1 = service.parseDeconzEvent({
				id: 'smart_switch_1',
				event: 2002,
			});
			const event2 = service.parseDeconzEvent({
				id: 'smart_switch_1',
				event: 2002,
			});

			expect(event1?.sourceOccurrenceId).not.toEqual(event2?.sourceOccurrenceId);
			expect(event1?.sourceOccurrenceId).toMatch(/^smart_switch_1:2002:\d+_\d+$/);
			expect(event2?.sourceOccurrenceId).toMatch(/^smart_switch_1:2002:\d+_\d+$/);
		});

		it('uses upstream context ID in sourceOccurrenceId when provided', () => {
			const event = service.parseDeconzEvent(
				{
					id: 'smart_switch_1',
					event: 2002,
				},
				'ctx-deconz-456',
			);

			expect(event?.sourceOccurrenceId).toBe('smart_switch_1:2002:ctx-deconz-456');
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
		it('routes and publishes occurrence using Home Assistant registry device_id', async () => {
			const device: HomeAssistantDeviceEntity = {
				id: 'dev-1',
				haDeviceId: 'ha-reg-device-id-1',
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
				context: { id: 'ctx-msg-789' },
				data: {
					device_id: 'ha-reg-device-id-1',
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
					sourceOccurrenceId: 'ha-reg-device-id-1:single:ctx-msg-789',
				}),
			);
		});

		it('routes multi-endpoint event to exact matching button channel', async () => {
			const device: HomeAssistantDeviceEntity = {
				id: 'dev-multi',
				haDeviceId: 'ha-multi-btn',
			} as HomeAssistantDeviceEntity;

			const chan1: HomeAssistantChannelEntity = {
				id: 'chan-btn-1',
				category: ChannelCategory.BUTTON,
				identifier: 'button_1',
			} as HomeAssistantChannelEntity;

			const chan2: HomeAssistantChannelEntity = {
				id: 'chan-btn-2',
				category: ChannelCategory.BUTTON,
				identifier: 'button_2',
			} as HomeAssistantChannelEntity;

			const prop1: HomeAssistantChannelPropertyEntity = {
				id: 'prop-btn-1',
				category: PropertyCategory.EVENT,
			} as HomeAssistantChannelPropertyEntity;

			const prop2: HomeAssistantChannelPropertyEntity = {
				id: 'prop-btn-2',
				category: PropertyCategory.EVENT,
			} as HomeAssistantChannelPropertyEntity;

			// Order deliberately reversed in findAll to verify resolution is not index-dependent
			devicesService.findAll.mockResolvedValue([device]);
			channelsService.findAll.mockResolvedValue([chan2, chan1]);
			channelsPropertiesService.findAll.mockImplementation((channelId: string) => {
				if (channelId === 'chan-btn-1') return Promise.resolve([prop1]);
				if (channelId === 'chan-btn-2') return Promise.resolve([prop2]);
				return Promise.resolve([] as HomeAssistantChannelPropertyEntity[]);
			});

			await service.handle({
				event_type: 'zha_event',
				data: {
					device_id: 'ha-multi-btn',
					command: 'single',
					endpoint_id: 1,
				},
			});

			expect(inputOccurrencesService.publishOccurrence).toHaveBeenCalledWith(
				expect.objectContaining({
					deviceId: 'dev-multi',
					channelId: 'chan-btn-1',
					propertyId: 'prop-btn-1',
					event: 'press',
				}),
			);
		});

		it('does not publish occurrence when endpoint does not match any channel', async () => {
			const device: HomeAssistantDeviceEntity = {
				id: 'dev-multi',
				haDeviceId: 'ha-multi-btn',
			} as HomeAssistantDeviceEntity;

			const chan1: HomeAssistantChannelEntity = {
				id: 'chan-btn-1',
				category: ChannelCategory.BUTTON,
				identifier: 'button_1',
			} as HomeAssistantChannelEntity;

			devicesService.findAll.mockResolvedValue([device]);
			channelsService.findAll.mockResolvedValue([chan1]);

			await service.handle({
				event_type: 'zha_event',
				data: {
					device_id: 'ha-multi-btn',
					command: 'single',
					endpoint_id: 99,
				},
			});

			expect(inputOccurrencesService.publishOccurrence).not.toHaveBeenCalled();
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
