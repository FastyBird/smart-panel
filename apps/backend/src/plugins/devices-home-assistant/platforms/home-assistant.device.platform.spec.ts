import { v4 as uuid } from 'uuid';

import { Test, TestingModule } from '@nestjs/testing';

import { ConfigService } from '../../../modules/config/services/config.service';
import { PropertyCategory } from '../../../modules/devices/devices.constants';
import {
	HomeAssistantChannelEntity,
	HomeAssistantChannelPropertyEntity,
	HomeAssistantDeviceEntity,
} from '../entities/devices-home-assistant.entity';
import { MapperService } from '../mappers/mapper.service';
import { HomeAssistantConfigModel } from '../models/config.model';

import { HomeAssistantDevicePlatform } from './home-assistant.device.platform';

describe('HomeAssistantDevicePlatform', () => {
	let platform: HomeAssistantDevicePlatform;
	let mapperService: MapperService;
	let sendCommandMock: jest.SpyInstance;

	beforeEach(async () => {
		const module: TestingModule = await Test.createTestingModule({
			providers: [
				HomeAssistantDevicePlatform,
				{
					provide: MapperService,
					useValue: {
						mapToHA: jest.fn(() => {
							return [
								{
									domain: 'light',
									state: 'on',
									service: 'turn_on',
									entityId: 'light.kitchen_led',
									properties: [],
								},
							];
						}),
					},
				},
				{
					provide: ConfigService,
					useValue: {
						getPluginConfig: jest.fn(() => {
							return { hostname: 'localhost' } as HomeAssistantConfigModel;
						}),
					},
				},
			],
		}).compile();

		platform = module.get(HomeAssistantDevicePlatform);
		mapperService = module.get<MapperService>(MapperService);

		// Mock the sendCommand method
		sendCommandMock = jest.spyOn(platform as any, 'sendCommand').mockResolvedValue({});
	});

	afterEach(() => {
		jest.clearAllMocks();
	});

	it('should be defined', () => {
		expect(platform).toBeDefined();
		expect(mapperService).toBeDefined();
	});

	it('should return true on successful update', async () => {
		const device = new HomeAssistantDeviceEntity();
		device.id = uuid().toString();

		const channel = new HomeAssistantChannelEntity();
		channel.id = uuid().toString();
		channel.properties = [];

		const property = new HomeAssistantChannelPropertyEntity();
		property.id = uuid().toString();
		property.category = PropertyCategory.BRIGHTNESS;
		property.haEntityId = 'light.kitchen_led';
		property.haAttribute = 'brightness';
		property.value = 100;

		channel.properties.push(property);

		const result = await platform.process({ device, channel, property, value: 75 });

		expect(result).toBe(true);
		expect(sendCommandMock).toHaveBeenCalled();
	});

	it('should return false for invalid device', async () => {
		const result = await platform.process({
			device: {} as HomeAssistantDeviceEntity,
			channel: {} as HomeAssistantChannelEntity,
			property: {} as HomeAssistantChannelPropertyEntity,
			value: true,
		});

		expect(result).toBe(false);
	});

	it('should handle failure in sendCommand', async () => {
		sendCommandMock.mockResolvedValueOnce(false);

		const device = new HomeAssistantDeviceEntity();
		device.id = uuid().toString();

		const channel = new HomeAssistantChannelEntity();
		channel.id = uuid().toString();
		channel.properties = [];

		const property = new HomeAssistantChannelPropertyEntity();
		property.id = uuid().toString();
		property.category = PropertyCategory.ON;
		property.haEntityId = 'light.kitchen_led';
		property.haAttribute = 'on';
		property.value = true;

		channel.properties.push(property);

		jest.spyOn(mapperService, 'mapToHA').mockResolvedValue([]);

		const result = await platform.process({ device, channel, property, value: false });

		expect(result).toBe(false);
	});
});
