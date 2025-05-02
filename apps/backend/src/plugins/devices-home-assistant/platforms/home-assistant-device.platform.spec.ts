import { v4 as uuid } from 'uuid';

import { Test, TestingModule } from '@nestjs/testing';

import { ConfigService } from '../../../modules/config/services/config.service';
import { PropertyCategory } from '../../../modules/devices/devices.constants';
import { HomeAssistantConfigEntity } from '../entities/config-home-assistant.entity';
import {
	HomeAssistantChannelEntity,
	HomeAssistantChannelPropertyEntity,
	HomeAssistantDeviceEntity,
} from '../entities/devices-home-assistant.entity';

import { HomeAssistantDevicePlatform } from './home-assistant-device.platform';

jest.mock('../utils/value-transformer.utils', () => ({
	HomeAssistantValueTransformer: {
		toHa: jest.fn((_, val: string | number | boolean) => val),
	},
}));

jest.mock('../utils/service-resolver.utils', () => ({
	HomeAssistantServiceResolver: {
		resolveBatch: jest.fn(() => 'turn_on'),
	},
}));

describe('HomeAssistantDevicePlatform', () => {
	let platform: HomeAssistantDevicePlatform;
	let sendCommandMock: jest.SpyInstance;

	beforeEach(async () => {
		const module: TestingModule = await Test.createTestingModule({
			providers: [
				HomeAssistantDevicePlatform,
				{
					provide: ConfigService,
					useValue: {
						getPluginConfig: jest.fn(() => {
							return { hostname: 'localhost' } as HomeAssistantConfigEntity;
						}),
					},
				},
			],
		}).compile();

		platform = module.get(HomeAssistantDevicePlatform);

		// Mock the sendCommand method
		sendCommandMock = jest.spyOn(platform as any, 'sendCommand').mockResolvedValue({});
	});

	it('should return true on successful update', async () => {
		const device = new HomeAssistantDeviceEntity();
		device.id = uuid().toString();

		const channel = new HomeAssistantChannelEntity();
		channel.id = uuid().toString();
		channel.haEntityId = 'light.kitchen_led';
		channel.properties = [];

		const property = new HomeAssistantChannelPropertyEntity();
		property.id = uuid().toString();
		property.category = PropertyCategory.BRIGHTNESS;
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
		channel.haEntityId = 'light.kitchen_led';
		channel.properties = [];

		const property = new HomeAssistantChannelPropertyEntity();
		property.id = uuid().toString();
		property.category = PropertyCategory.ON;
		property.haAttribute = 'on';
		property.value = true;

		channel.properties.push(property);

		const result = await platform.process({ device, channel, property, value: false });

		expect(result).toBe(false);
	});
});
