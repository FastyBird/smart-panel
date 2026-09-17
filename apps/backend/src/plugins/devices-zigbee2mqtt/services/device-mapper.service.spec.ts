/*eslint-disable @typescript-eslint/unbound-method, @typescript-eslint/require-await, @typescript-eslint/no-unsafe-assignment*/
import { Test, TestingModule } from '@nestjs/testing';

import {
	ChannelCategory,
	DataTypeType,
	PermissionType,
	PropertyCategory,
} from '../../../modules/devices/devices.constants';
import { ChannelInputOccurrencesService } from '../../../modules/devices/services/channel-input-occurrences.service';
import { ChannelsPropertiesService } from '../../../modules/devices/services/channels.properties.service';
import { ChannelsService } from '../../../modules/devices/services/channels.service';
import { DeviceConnectivityService } from '../../../modules/devices/services/device-connectivity.service';
import { DeviceProvisionQueueService } from '../../../modules/devices/services/device-provision-queue.service';
import { DevicesService } from '../../../modules/devices/services/devices.service';
import { DEVICES_ZIGBEE2MQTT_TYPE } from '../devices-zigbee2mqtt.constants';
import {
	Zigbee2mqttChannelEntity,
	Zigbee2mqttChannelPropertyEntity,
	Zigbee2mqttDeviceEntity,
} from '../entities/devices-zigbee2mqtt.entity';
import { ConfigDrivenConverter } from '../mappings/config-driven.converter';
import { MappingLoaderService } from '../mappings/mapping-loader.service';
import { TransformerRegistry } from '../mappings/transformers';

import { Z2mDeviceMapperService } from './device-mapper.service';
import { Z2mExposesMapperService } from './exposes-mapper.service';
import { Z2mVirtualPropertyService } from './virtual-property.service';

describe('Z2mDeviceMapperService', () => {
	let service: Z2mDeviceMapperService;
	let devicesService: jest.Mocked<DevicesService>;
	let channelsService: jest.Mocked<ChannelsService>;
	let channelsPropertiesService: jest.Mocked<ChannelsPropertiesService>;
	let channelInputOccurrencesService: jest.Mocked<ChannelInputOccurrencesService>;

	beforeEach(async () => {
		devicesService = {
			findOneBy: jest.fn(),
			findByIdentifier: jest.fn(),
			findAll: jest.fn(),
		} as unknown as jest.Mocked<DevicesService>;

		channelsService = {
			findAll: jest.fn(),
		} as unknown as jest.Mocked<ChannelsService>;

		channelsPropertiesService = {
			findAll: jest.fn(),
			update: jest.fn().mockResolvedValue({}),
		} as unknown as jest.Mocked<ChannelsPropertiesService>;

		channelInputOccurrencesService = {
			publishOccurrence: jest.fn().mockResolvedValue({
				id: 'occ-1',
				deviceId: 'dev-1',
				channelId: 'ch-1',
				propertyId: 'prop-1',
				event: 'press',
				nativeEventType: 'single',
				sourceOccurrenceId: 'source-1',
				sourceTimestamp: new Date().toISOString(),
				createdAt: new Date().toISOString(),
			}),
		} as unknown as jest.Mocked<ChannelInputOccurrencesService>;

		const module: TestingModule = await Test.createTestingModule({
			providers: [
				Z2mDeviceMapperService,
				{ provide: DevicesService, useValue: devicesService },
				{ provide: ChannelsService, useValue: channelsService },
				{ provide: ChannelsPropertiesService, useValue: channelsPropertiesService },
				{ provide: DeviceConnectivityService, useValue: { setStatus: jest.fn() } },
				{ provide: Z2mExposesMapperService, useValue: { mapExposes: jest.fn() } },
				{ provide: Z2mVirtualPropertyService, useValue: { resolveVirtualPropertyValue: jest.fn() } },
				{
					provide: MappingLoaderService,
					useValue: { loadAllMappings: jest.fn(), getDerivedPropertiesForChannel: jest.fn().mockReturnValue([]) },
				},
				{ provide: ConfigDrivenConverter, useValue: { getRuntimeMappings: jest.fn() } },
				{ provide: TransformerRegistry, useValue: { get: jest.fn() } },
				{ provide: DeviceProvisionQueueService, useValue: { queueDevice: jest.fn() } },
				{ provide: ChannelInputOccurrencesService, useValue: channelInputOccurrencesService },
			],
		}).compile();

		service = module.get<Z2mDeviceMapperService>(Z2mDeviceMapperService);
	});

	const createMockDevice = (identifier: string): Zigbee2mqttDeviceEntity =>
		({
			id: 'device-uuid-1',
			identifier,
			name: 'Remote Control',
			type: DEVICES_ZIGBEE2MQTT_TYPE,
			enabled: true,
		}) as unknown as Zigbee2mqttDeviceEntity;

	const createMockChannel = (id: string, identifier: string, category: ChannelCategory): Zigbee2mqttChannelEntity =>
		({
			id,
			identifier,
			name: identifier,
			category,
			type: DEVICES_ZIGBEE2MQTT_TYPE,
		}) as unknown as Zigbee2mqttChannelEntity;

	const createMockProperty = (
		id: string,
		identifier: string,
		category: PropertyCategory,
		z2mProperty: string,
	): Zigbee2mqttChannelPropertyEntity =>
		({
			id,
			identifier,
			name: identifier,
			category,
			dataType: DataTypeType.ENUM,
			permissions: [PermissionType.EVENT_ONLY],
			z2mProperty,
			type: DEVICES_ZIGBEE2MQTT_TYPE,
		}) as unknown as Zigbee2mqttChannelPropertyEntity;

	describe('Input Occurrences - Single Button Remote', () => {
		let device: Zigbee2mqttDeviceEntity;
		let buttonChannel: Zigbee2mqttChannelEntity;
		let eventProperty: Zigbee2mqttChannelPropertyEntity;

		beforeEach(() => {
			device = createMockDevice('sonoff-button');
			buttonChannel = createMockChannel('chan-button-1', 'button', ChannelCategory.BUTTON);
			eventProperty = createMockProperty('prop-event-1', 'event', PropertyCategory.EVENT, 'action');

			devicesService.findOneBy.mockResolvedValue(device);
			channelsService.findAll.mockResolvedValue([buttonChannel]);
			channelsPropertiesService.findAll.mockResolvedValue([eventProperty]);
		});

		it('should publish occurrence and update property for a fresh press action', async () => {
			await service.updateDeviceState('sonoff-button', { action: 'single' });

			expect(channelInputOccurrencesService.publishOccurrence).toHaveBeenCalledTimes(1);
			expect(channelInputOccurrencesService.publishOccurrence).toHaveBeenCalledWith(
				expect.objectContaining({
					deviceId: device.id,
					channelId: buttonChannel.id,
					propertyId: eventProperty.id,
					event: 'press',
					nativeEventType: 'single',
					sourceOccurrenceId: expect.stringContaining(`${buttonChannel.id}:single:`),
				}),
			);

			expect(channelsPropertiesService.update).toHaveBeenCalledWith(
				eventProperty.id,
				expect.objectContaining({
					value: 'press',
				}),
			);
		});

		it('should produce distinct occurrences for two consecutive identical actions', async () => {
			await service.updateDeviceState('sonoff-button', { action: 'single' });
			await service.updateDeviceState('sonoff-button', { action: 'single' });

			expect(channelInputOccurrencesService.publishOccurrence).toHaveBeenCalledTimes(2);

			const call1 = channelInputOccurrencesService.publishOccurrence.mock.calls[0][0];
			const call2 = channelInputOccurrencesService.publishOccurrence.mock.calls[1][0];

			expect(call1.sourceOccurrenceId).not.toEqual(call2.sourceOccurrenceId);
		});

		it('should suppress occurrences on retained startup payloads', async () => {
			await service.updateDeviceState('sonoff-button', { action: 'single' }, { isRetained: true });

			expect(channelInputOccurrencesService.publishOccurrence).not.toHaveBeenCalled();
			expect(channelsPropertiesService.update).not.toHaveBeenCalled();
		});

		it('should suppress occurrences on cached state replays', async () => {
			await service.updateDeviceState('sonoff-button', { action: 'single' }, { isCached: true });

			expect(channelInputOccurrencesService.publishOccurrence).not.toHaveBeenCalled();
			expect(channelsPropertiesService.update).not.toHaveBeenCalled();
		});

		it('should suppress occurrences on empty action reset messages', async () => {
			await service.updateDeviceState('sonoff-button', { action: '' });
			await service.updateDeviceState('sonoff-button', { action: '   ' });

			expect(channelInputOccurrencesService.publishOccurrence).not.toHaveBeenCalled();
			expect(channelsPropertiesService.update).not.toHaveBeenCalled();
		});

		it('should not trigger occurrence on battery-only state updates without action', async () => {
			await service.updateDeviceState('sonoff-button', { battery: 85, linkquality: 120 });

			expect(channelInputOccurrencesService.publishOccurrence).not.toHaveBeenCalled();
		});

		it('should deduplicate identifiable MQTT redeliveries sharing packetId', async () => {
			await service.updateDeviceState('sonoff-button', { action: 'single' }, { packetId: 999 });
			expect(channelInputOccurrencesService.publishOccurrence).toHaveBeenLastCalledWith(
				expect.objectContaining({
					sourceOccurrenceId: `${buttonChannel.id}:single:pkt_999`,
				}),
			);

			await service.updateDeviceState('sonoff-button', { action: 'single' }, { isDup: true, packetId: 999 });
			expect(channelInputOccurrencesService.publishOccurrence).toHaveBeenLastCalledWith(
				expect.objectContaining({
					sourceOccurrenceId: `${buttonChannel.id}:single:pkt_999`,
				}),
			);
		});

		it('should log diagnostic warning and ignore unsupported action without mislabeling as single press', async () => {
			await service.updateDeviceState('sonoff-button', { action: 'unknown_spin_gesture' });

			expect(channelInputOccurrencesService.publishOccurrence).not.toHaveBeenCalled();
			expect(channelsPropertiesService.update).not.toHaveBeenCalled();
		});
	});

	describe('Input Occurrences - Multi-Button Remote (Hue Dimmer)', () => {
		let device: Zigbee2mqttDeviceEntity;
		let chanOn: Zigbee2mqttChannelEntity;
		let chanUp: Zigbee2mqttChannelEntity;
		let chanDown: Zigbee2mqttChannelEntity;
		let chanOff: Zigbee2mqttChannelEntity;
		let propOn: Zigbee2mqttChannelPropertyEntity;
		let propUp: Zigbee2mqttChannelPropertyEntity;
		let propDown: Zigbee2mqttChannelPropertyEntity;
		let propOff: Zigbee2mqttChannelPropertyEntity;

		beforeEach(() => {
			device = createMockDevice('hue-dimmer');
			chanOn = createMockChannel('chan-on', 'button_on', ChannelCategory.BUTTON);
			chanUp = createMockChannel('chan-up', 'button_up', ChannelCategory.BUTTON);
			chanDown = createMockChannel('chan-down', 'button_down', ChannelCategory.BUTTON);
			chanOff = createMockChannel('chan-off', 'button_off', ChannelCategory.BUTTON);

			propOn = createMockProperty('prop-on', 'event', PropertyCategory.EVENT, 'action');
			propUp = createMockProperty('prop-up', 'event', PropertyCategory.EVENT, 'action');
			propDown = createMockProperty('prop-down', 'event', PropertyCategory.EVENT, 'action');
			propOff = createMockProperty('prop-off', 'event', PropertyCategory.EVENT, 'action');

			devicesService.findOneBy.mockResolvedValue(device);
			channelsService.findAll.mockResolvedValue([chanOn, chanUp, chanDown, chanOff]);

			channelsPropertiesService.findAll.mockImplementation(async (channelId: string) => {
				if (channelId === chanOn.id) return [propOn];
				if (channelId === chanUp.id) return [propUp];
				if (channelId === chanDown.id) return [propDown];
				if (channelId === chanOff.id) return [propOff];
				return [];
			});
		});

		it('should route on_press to button_on as press', async () => {
			await service.updateDeviceState('hue-dimmer', { action: 'on_press' });

			expect(channelInputOccurrencesService.publishOccurrence).toHaveBeenCalledWith(
				expect.objectContaining({
					channelId: chanOn.id,
					propertyId: propOn.id,
					event: 'press',
					nativeEventType: 'on_press',
				}),
			);
		});

		it('should route up_hold to button_up as long_press', async () => {
			await service.updateDeviceState('hue-dimmer', { action: 'up_hold' });

			expect(channelInputOccurrencesService.publishOccurrence).toHaveBeenCalledWith(
				expect.objectContaining({
					channelId: chanUp.id,
					propertyId: propUp.id,
					event: 'long_press',
					nativeEventType: 'up_hold',
				}),
			);
		});

		it('should route down_press_release to button_down as release', async () => {
			await service.updateDeviceState('hue-dimmer', { action: 'down_press_release' });

			expect(channelInputOccurrencesService.publishOccurrence).toHaveBeenCalledWith(
				expect.objectContaining({
					channelId: chanDown.id,
					propertyId: propDown.id,
					event: 'release',
					nativeEventType: 'down_press_release',
				}),
			);
		});

		it('should route off_press to button_off as press', async () => {
			await service.updateDeviceState('hue-dimmer', { action: 'off_press' });

			expect(channelInputOccurrencesService.publishOccurrence).toHaveBeenCalledWith(
				expect.objectContaining({
					channelId: chanOff.id,
					propertyId: propOff.id,
					event: 'press',
					nativeEventType: 'off_press',
				}),
			);
		});
	});

	describe('Input Occurrences - IKEA Somrig Remote', () => {
		let device: Zigbee2mqttDeviceEntity;
		let chan1: Zigbee2mqttChannelEntity;
		let chan2: Zigbee2mqttChannelEntity;
		let prop1: Zigbee2mqttChannelPropertyEntity;
		let prop2: Zigbee2mqttChannelPropertyEntity;

		beforeEach(() => {
			device = createMockDevice('ikea-somrig');
			chan1 = createMockChannel('chan-1', 'button_1', ChannelCategory.BUTTON);
			chan2 = createMockChannel('chan-2', 'button_2', ChannelCategory.BUTTON);

			prop1 = createMockProperty('prop-1', 'event', PropertyCategory.EVENT, 'action');
			prop2 = createMockProperty('prop-2', 'event', PropertyCategory.EVENT, 'action');

			devicesService.findOneBy.mockResolvedValue(device);
			channelsService.findAll.mockResolvedValue([chan1, chan2]);

			channelsPropertiesService.findAll.mockImplementation(async (channelId: string) => {
				if (channelId === chan1.id) return [prop1];
				if (channelId === chan2.id) return [prop2];
				return [];
			});
		});

		it('should route button_1_single to button_1 as press', async () => {
			await service.updateDeviceState('ikea-somrig', { action: 'button_1_single' });

			expect(channelInputOccurrencesService.publishOccurrence).toHaveBeenCalledWith(
				expect.objectContaining({
					channelId: chan1.id,
					propertyId: prop1.id,
					event: 'press',
					nativeEventType: 'button_1_single',
				}),
			);
		});

		it('should route button_2_double to button_2 as double_press', async () => {
			await service.updateDeviceState('ikea-somrig', { action: 'button_2_double' });

			expect(channelInputOccurrencesService.publishOccurrence).toHaveBeenCalledWith(
				expect.objectContaining({
					channelId: chan2.id,
					propertyId: prop2.id,
					event: 'double_press',
					nativeEventType: 'button_2_double',
				}),
			);
		});

		it('should route button_1_hold to button_1 as long_press', async () => {
			await service.updateDeviceState('ikea-somrig', { action: 'button_1_hold' });

			expect(channelInputOccurrencesService.publishOccurrence).toHaveBeenCalledWith(
				expect.objectContaining({
					channelId: chan1.id,
					propertyId: prop1.id,
					event: 'long_press',
					nativeEventType: 'button_1_hold',
				}),
			);
		});
	});

	describe('Input Occurrences - Rotary Dial Controller', () => {
		let device: Zigbee2mqttDeviceEntity;
		let chanButton: Zigbee2mqttChannelEntity;
		let chanRotary: Zigbee2mqttChannelEntity;
		let propButton: Zigbee2mqttChannelPropertyEntity;
		let propRotary: Zigbee2mqttChannelPropertyEntity;

		beforeEach(() => {
			device = createMockDevice('rotary-dial');
			chanButton = createMockChannel('chan-btn', 'button', ChannelCategory.BUTTON);
			chanRotary = createMockChannel('chan-rot', 'rotary', ChannelCategory.BUTTON);

			propButton = createMockProperty('prop-btn', 'event', PropertyCategory.EVENT, 'action');
			propRotary = createMockProperty('prop-rot', 'event', PropertyCategory.EVENT, 'action');

			devicesService.findOneBy.mockResolvedValue(device);
			channelsService.findAll.mockResolvedValue([chanButton, chanRotary]);

			channelsPropertiesService.findAll.mockImplementation(async (channelId: string) => {
				if (channelId === chanButton.id) return [propButton];
				if (channelId === chanRotary.id) return [propRotary];
				return [];
			});
		});

		it('should route single to button as press', async () => {
			await service.updateDeviceState('rotary-dial', { action: 'single' });

			expect(channelInputOccurrencesService.publishOccurrence).toHaveBeenCalledWith(
				expect.objectContaining({
					channelId: chanButton.id,
					propertyId: propButton.id,
					event: 'press',
					nativeEventType: 'single',
				}),
			);
		});

		it('should route rotate_left to rotary as rotate_left', async () => {
			await service.updateDeviceState('rotary-dial', { action: 'rotate_left' });

			expect(channelInputOccurrencesService.publishOccurrence).toHaveBeenCalledWith(
				expect.objectContaining({
					channelId: chanRotary.id,
					propertyId: propRotary.id,
					event: 'rotate_left',
					nativeEventType: 'rotate_left',
				}),
			);
		});

		it('should route rotate_right to rotary as rotate_right', async () => {
			await service.updateDeviceState('rotary-dial', { action: 'rotate_right' });

			expect(channelInputOccurrencesService.publishOccurrence).toHaveBeenCalledWith(
				expect.objectContaining({
					channelId: chanRotary.id,
					propertyId: propRotary.id,
					event: 'rotate_right',
					nativeEventType: 'rotate_right',
				}),
			);
		});
	});
});
