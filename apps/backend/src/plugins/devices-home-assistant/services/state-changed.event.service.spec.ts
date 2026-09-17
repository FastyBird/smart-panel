/*
eslint-disable @typescript-eslint/unbound-method
*/
/*
Reason: The mocking and test setup requires dynamic assignment and
handling of Jest mocks, which ESLint rules flag unnecessarily.
*/
import { Test, TestingModule } from '@nestjs/testing';

import { toInstance } from '../../../common/utils/transform.utils';
import { PropertyCategory } from '../../../modules/devices/devices.constants';
import { ChannelInputOccurrencesService } from '../../../modules/devices/services/channel-input-occurrences.service';
import { ChannelsPropertiesService } from '../../../modules/devices/services/channels.properties.service';
import { ChannelsService } from '../../../modules/devices/services/channels.service';
import { DevicesService } from '../../../modules/devices/services/devices.service';
import { HomeAssistantStateChangedEventDto } from '../dto/home-assistant-state.dto';
import { UpdateHomeAssistantChannelPropertyDto } from '../dto/update-channel-property.dto';
import {
	HomeAssistantChannelEntity,
	HomeAssistantChannelPropertyEntity,
	HomeAssistantDeviceEntity,
} from '../entities/devices-home-assistant.entity';
import { MapperService } from '../mappers/mapper.service';
import { TransformerRegistry } from '../mappings/transformers/transformer.registry';
import { HomeAssistantDiscoveredDeviceModel } from '../models/home-assistant.model';

import { HomeAssistantHttpService } from './home-assistant.http.service';
import { StateChangedEventService } from './state-changed.event.service';
import { VirtualPropertyService } from './virtual-property.service';

describe('StateChangedEventService', () => {
	let service: StateChangedEventService;
	let devicesService: jest.Mocked<DevicesService>;
	let channelsService: jest.Mocked<ChannelsService>;
	let channelsPropertiesService: jest.Mocked<ChannelsPropertiesService>;
	let mapperService: jest.Mocked<MapperService>;
	let httpService: jest.Mocked<HomeAssistantHttpService>;
	let inputOccurrencesService: jest.Mocked<ChannelInputOccurrencesService>;

	beforeEach(async () => {
		const module: TestingModule = await Test.createTestingModule({
			providers: [
				StateChangedEventService,
				{ provide: DevicesService, useValue: { findAll: jest.fn() } },
				{ provide: ChannelsService, useValue: { findOne: jest.fn(), findAll: jest.fn().mockResolvedValue([]) } },
				{ provide: ChannelsPropertiesService, useValue: { findAll: jest.fn(), update: jest.fn() } },
				{ provide: MapperService, useValue: { mapFromHA: jest.fn() } },
				{ provide: HomeAssistantHttpService, useValue: { getDiscoveredDevices: jest.fn() } },
				{ provide: VirtualPropertyService, useValue: { resolveVirtualPropertyValue: jest.fn() } },
				{
					provide: ChannelInputOccurrencesService,
					useValue: { publishOccurrence: jest.fn().mockResolvedValue({}) },
				},
				{
					provide: TransformerRegistry,
					useValue: {
						getOrCreate: jest.fn().mockReturnValue({
							canRead: () => true,
							canWrite: () => true,
							read: (value: unknown) => value,
							write: (value: unknown) => value,
						}),
					},
				},
			],
		}).compile();

		service = module.get(StateChangedEventService);
		devicesService = module.get(DevicesService);
		channelsService = module.get(ChannelsService);
		channelsPropertiesService = module.get(ChannelsPropertiesService);
		mapperService = module.get(MapperService);
		httpService = module.get(HomeAssistantHttpService);
		inputOccurrencesService = module.get(ChannelInputOccurrencesService);

		jest.useFakeTimers();
	});

	afterEach(() => {
		jest.useRealTimers();
		jest.clearAllMocks();
	});

	test('should skip if no mappings are initialized and fetch fails', async () => {
		httpService.getDiscoveredDevices.mockResolvedValue([]);
		devicesService.findAll.mockResolvedValue([]);
		channelsPropertiesService.findAll.mockResolvedValue([]);

		const event = {
			data: {
				new_state: {
					entity_id: 'sensor.temp',
				},
			},
		} as unknown as HomeAssistantStateChangedEventDto;

		await service.handle(event);
		// Expect nothing crashes, no calls made due to early return
		expect(mapperService.mapFromHA).not.toHaveBeenCalled();
	});

	test('should debounce and process state changes', async () => {
		const device: HomeAssistantDeviceEntity = { id: 'd1', haDeviceId: 'ha1' } as unknown as HomeAssistantDeviceEntity;
		const property: HomeAssistantChannelPropertyEntity = { id: 'p1' } as unknown as HomeAssistantChannelPropertyEntity;
		const haDevice: HomeAssistantDiscoveredDeviceModel = {
			id: 'ha1',
			name: 'Device name',
			entities: ['sensor.temp'],
			adoptedDeviceId: device.id,
			states: [],
		};

		httpService.getDiscoveredDevices.mockResolvedValue([haDevice]);
		devicesService.findAll.mockResolvedValue([device]);
		channelsPropertiesService.findAll.mockResolvedValue([property]);
		mapperService.mapFromHA.mockResolvedValue([[{ property, value: 25 }]]);

		const event = {
			data: {
				new_state: {
					entity_id: 'sensor.temp',
				},
			},
		} as HomeAssistantStateChangedEventDto;

		await service.handle(event);

		await jest.runAllTimersAsync(); // fast-forward debounce

		expect(channelsPropertiesService.update).toHaveBeenCalledWith(
			property.id,
			toInstance(UpdateHomeAssistantChannelPropertyDto, {
				type: 'devices-home-assistant',
				value: 25,
			}),
		);
		expect(Object.keys(channelsPropertiesService.update.mock.calls[0][1]).sort()).toEqual(['type', 'value']);
	});

	describe('event.* entities handling', () => {
		const device: HomeAssistantDeviceEntity = { id: 'd1', haDeviceId: 'ha_remote_1' } as HomeAssistantDeviceEntity;
		const channel: HomeAssistantChannelEntity = { id: 'c1', device: 'd1' } as HomeAssistantChannelEntity;
		const property: HomeAssistantChannelPropertyEntity = {
			id: 'p1',
			channel: 'c1',
			haEntityId: 'event.button_1',
			category: PropertyCategory.EVENT,
		} as HomeAssistantChannelPropertyEntity;

		const haDevice: HomeAssistantDiscoveredDeviceModel = {
			id: 'ha_remote_1',
			name: 'Remote Controller',
			entities: ['event.button_1'],
			adoptedDeviceId: device.id,
			states: [],
		};

		beforeEach(() => {
			httpService.getDiscoveredDevices.mockResolvedValue([haDevice]);
			devicesService.findAll.mockResolvedValue([device]);
			channelsService.findAll.mockResolvedValue([channel]);
			channelsPropertiesService.findAll.mockResolvedValue([property]);
		});

		it('skips event occurrence on startup snapshot when old_state is null', async () => {
			const event = {
				data: {
					old_state: null,
					new_state: {
						entity_id: 'event.button_1',
						state: '2026-09-17T00:00:00.000Z',
						attributes: { event_type: 'press' },
					},
				},
			} as unknown as HomeAssistantStateChangedEventDto;

			await service.handle(event);

			expect(inputOccurrencesService.publishOccurrence).not.toHaveBeenCalled();
		});

		it('skips event when timestamp state did not change', async () => {
			const event = {
				data: {
					old_state: {
						entity_id: 'event.button_1',
						state: '2026-09-17T00:00:00.000Z',
						attributes: { event_type: 'press' },
					},
					new_state: {
						entity_id: 'event.button_1',
						state: '2026-09-17T00:00:00.000Z',
						attributes: { event_type: 'press' },
					},
				},
			} as unknown as HomeAssistantStateChangedEventDto;

			await service.handle(event);

			expect(inputOccurrencesService.publishOccurrence).not.toHaveBeenCalled();
		});

		it('skips event when new state is unavailable or unknown', async () => {
			const event = {
				data: {
					old_state: {
						entity_id: 'event.button_1',
						state: '2026-09-17T00:00:00.000Z',
					},
					new_state: {
						entity_id: 'event.button_1',
						state: 'unavailable',
					},
				},
			} as unknown as HomeAssistantStateChangedEventDto;

			await service.handle(event);

			expect(inputOccurrencesService.publishOccurrence).not.toHaveBeenCalled();
		});

		it('publishes occurrence immediately without debounce when event arrives', async () => {
			const event = {
				data: {
					old_state: {
						entity_id: 'event.button_1',
						state: '2026-09-17T00:00:00.000Z',
					},
					new_state: {
						entity_id: 'event.button_1',
						state: '2026-09-17T00:00:05.000Z',
						attributes: { event_type: 'single' },
						context: { id: 'ctx-1' },
					},
				},
			} as unknown as HomeAssistantStateChangedEventDto;

			// Do not run fake timers; event should be published immediately
			await service.handle(event);

			expect(inputOccurrencesService.publishOccurrence).toHaveBeenCalledWith({
				deviceId: 'd1',
				channelId: 'c1',
				propertyId: 'p1',
				event: 'press',
				nativeEventType: 'single',
				sourceTimestamp: '2026-09-17T00:00:05.000Z',
				sourceOccurrenceId: 'event.button_1:2026-09-17T00:00:05.000Z:ctx-1',
				data: {
					entity_id: 'event.button_1',
					event_type: 'single',
					state: '2026-09-17T00:00:05.000Z',
					context: { id: 'ctx-1' },
				},
			});
		});

		it('publishes rapid successive events with fresh context IDs independently', async () => {
			const event1 = {
				data: {
					old_state: {
						entity_id: 'event.button_1',
						state: '2026-09-17T00:00:00.000Z',
					},
					new_state: {
						entity_id: 'event.button_1',
						state: '2026-09-17T00:00:01.000Z',
						attributes: { event_type: 'press' },
						context: { id: 'ctx-1' },
					},
				},
			} as unknown as HomeAssistantStateChangedEventDto;

			const event2 = {
				data: {
					old_state: {
						entity_id: 'event.button_1',
						state: '2026-09-17T00:00:01.000Z',
					},
					new_state: {
						entity_id: 'event.button_1',
						state: '2026-09-17T00:00:02.000Z',
						attributes: { event_type: 'press' },
						context: { id: 'ctx-2' },
					},
				},
			} as unknown as HomeAssistantStateChangedEventDto;

			await service.handle(event1);
			await service.handle(event2);

			expect(inputOccurrencesService.publishOccurrence).toHaveBeenCalledTimes(2);
		});
	});
});
