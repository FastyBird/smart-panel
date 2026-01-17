/*
eslint-disable @typescript-eslint/unbound-method
*/
/*
Reason: The mocking and test setup requires dynamic assignment and
handling of Jest mocks, which ESLint rules flag unnecessarily.
*/
import { instanceToPlain } from 'class-transformer';

import { Test, TestingModule } from '@nestjs/testing';

import { toInstance } from '../../../common/utils/transform.utils';
import { ChannelsPropertiesService } from '../../../modules/devices/services/channels.properties.service';
import { ChannelsService } from '../../../modules/devices/services/channels.service';
import { DevicesService } from '../../../modules/devices/services/devices.service';
import { HomeAssistantStateChangedEventDto } from '../dto/home-assistant-state.dto';
import { UpdateHomeAssistantChannelPropertyDto } from '../dto/update-channel-property.dto';
import {
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
	let channelsPropertiesService: jest.Mocked<ChannelsPropertiesService>;
	let mapperService: jest.Mocked<MapperService>;
	let httpService: jest.Mocked<HomeAssistantHttpService>;

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
		channelsPropertiesService = module.get(ChannelsPropertiesService);
		mapperService = module.get(MapperService);
		httpService = module.get(HomeAssistantHttpService);

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
				...instanceToPlain(property),
				value: 25,
			}),
		);
	});
});
