/*
eslint-disable @typescript-eslint/unbound-method
*/
/*
Reason: The mocking and test setup requires dynamic assignment and
handling of Jest mocks, which ESLint rules flag unnecessarily.
*/
import { Test, TestingModule } from '@nestjs/testing';

import { ChannelCategory, ConnectionState, PropertyCategory } from '../../../modules/devices/devices.constants';
import { ChannelsService } from '../../../modules/devices/services/channels.service';
import { DevicesService } from '../../../modules/devices/services/devices.service';
import { DEVICES_HOME_ASSISTANT_TYPE } from '../devices-home-assistant.constants';
import { HomeAssistantChannelEntity, HomeAssistantDeviceEntity } from '../entities/devices-home-assistant.entity';
import { HomeAssistantDeviceRegistryResponseResultModel } from '../models/home-assistant.model';
import { HomeAssistantWsService } from '../services/home-assistant.ws.service';

import { DevicesServiceSubscriber } from './devices-service.subscriber';

describe('DevicesServiceSubscriber', () => {
	let service: DevicesServiceSubscriber;
	let haWsService: jest.Mocked<HomeAssistantWsService>;
	let devicesService: jest.Mocked<DevicesService>;
	let channelsService: jest.Mocked<ChannelsService>;

	beforeEach(async () => {
		const module: TestingModule = await Test.createTestingModule({
			providers: [
				DevicesServiceSubscriber,
				{
					provide: HomeAssistantWsService,
					useValue: {
						getDevicesRegistry: jest.fn(),
					},
				},
				{
					provide: DevicesService,
					useValue: {
						findOne: jest.fn(),
					},
				},
				{
					provide: ChannelsService,
					useValue: {
						create: jest.fn(),
					},
				},
			],
		}).compile();

		service = module.get<DevicesServiceSubscriber>(DevicesServiceSubscriber);
		haWsService = module.get(HomeAssistantWsService);
		devicesService = module.get(DevicesService);
		channelsService = module.get(ChannelsService);
	});

	afterEach(() => {
		jest.clearAllMocks();
	});

	it('should return device if no haDeviceId is provided', async () => {
		const device = { id: 'device-1' } as HomeAssistantDeviceEntity;

		const result = await service.onDeviceCreated(device);

		expect(result).toBe(device);
		expect(haWsService.getDevicesRegistry).not.toHaveBeenCalled();
	});

	it('should return device if haDevice is not found in registry', async () => {
		const device = { id: 'device-1', haDeviceId: 'ha-123' } as HomeAssistantDeviceEntity;

		haWsService.getDevicesRegistry.mockResolvedValue([]);

		const result = await service.onDeviceCreated(device);

		expect(result).toBe(device);
		expect(haWsService.getDevicesRegistry).toHaveBeenCalled();
	});

	it('should create device info channel and return updated device', async () => {
		const device = { id: 'device-1', haDeviceId: 'ha-123' } as HomeAssistantDeviceEntity;
		const channel = { id: 'channel-1' } as HomeAssistantChannelEntity;

		const haDevice = {
			id: 'ha-123',
			manufacturer: 'Acme',
			model: 'X1000',
			serialNumber: '123456',
			swVersion: '1.2.3',
			hwVersion: 'A1',
			connections: [['mac', 'c0:ff:ee:00:00:01']],
		} as HomeAssistantDeviceRegistryResponseResultModel;

		haWsService.getDevicesRegistry.mockResolvedValue([haDevice]);

		channelsService.create.mockResolvedValue(channel);
		devicesService.findOne.mockResolvedValue(device);

		const result = await service.onDeviceCreated(device);

		expect(result).toBe(device);
		expect(channelsService.create).toHaveBeenCalledWith(
			expect.objectContaining({
				device: device.id,
				category: ChannelCategory.DEVICE_INFORMATION,
				properties: expect.arrayContaining<object>([
					expect.objectContaining({
						category: PropertyCategory.MANUFACTURER,
						value: 'Acme',
					}),
					expect.objectContaining({
						category: PropertyCategory.CONNECTION_TYPE,
						value: 'wifi',
					}),
					expect.objectContaining({
						category: PropertyCategory.STATUS,
						value: ConnectionState.UNKNOWN,
					}),
				]) as object[],
			}),
		);
		expect(devicesService.findOne).toHaveBeenCalledWith(device.id, DEVICES_HOME_ASSISTANT_TYPE);
	});
});
