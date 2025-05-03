import { Test, TestingModule } from '@nestjs/testing';

import { ConfigService } from '../../../modules/config/services/config.service';
import { DevicesService } from '../../../modules/devices/services/devices.service';
import {
	DevicesHomeAssistantNotFoundException,
	DevicesHomeAssistantValidationException,
} from '../devices-home-assistant.exceptions';
import { HomeAssistantDiscoveredDeviceDto } from '../dto/home-assistant-discovered-device.dto';
import { HomeAssistantStateDto } from '../dto/home-assistant-state.dto';
import { HomeAssistantDeviceEntity } from '../entities/devices-home-assistant.entity';

import { HomeAssistantHttpService } from './home-assistant.http.service';

const mockConfigService = {
	getPluginConfig: jest.fn(),
};

const mockDevicesService = {
	findAll: jest.fn(),
};

describe('HomeAssistantHttpService', () => {
	let service: HomeAssistantHttpService;
	let configService: ConfigService;
	let devicesService: DevicesService;

	beforeEach(async () => {
		const module: TestingModule = await Test.createTestingModule({
			providers: [
				HomeAssistantHttpService,
				{ provide: ConfigService, useValue: mockConfigService },
				{ provide: DevicesService, useValue: mockDevicesService },
			],
		}).compile();

		service = module.get(HomeAssistantHttpService);
		configService = module.get(ConfigService);
		devicesService = module.get(DevicesService);

		mockConfigService.getPluginConfig.mockReturnValue({
			apiKey: 'test-api-key',
			hostname: 'localhost',
		});
	});

	afterEach(() => {
		jest.clearAllMocks();
	});

	it('should be defined', () => {
		expect(service).toBeDefined();
		expect(configService).toBeDefined();
		expect(devicesService).toBeDefined();
	});

	it('should throw validation error if API key is missing', () => {
		mockConfigService.getPluginConfig.mockReturnValue({ apiKey: null });

		expect(() => service['ensureApiKey']()).toThrow();
	});

	describe('getDiscoveredDevice', () => {
		it('should return device model with states', async () => {
			const mockDevice: HomeAssistantDiscoveredDeviceDto = {
				id: 'device_1',
				name: 'Test Device',
				entities: ['sensor.temp'],
			};

			const mockState: HomeAssistantStateDto = {
				entity_id: 'sensor.temp',
				state: '22',
				attributes: { unit_of_measurement: '°C' },
				last_changed: new Date(),
				last_updated: new Date(),
				last_reported: new Date(),
				context: {
					id: 'context-id',
					parent_id: null,
					user_id: null,
				},
			};

			jest.spyOn<HomeAssistantHttpService, any>(service, 'fetchSingleHaDevice').mockResolvedValue(mockDevice);
			jest.spyOn<HomeAssistantHttpService, any>(service, 'fetchListHaStates').mockResolvedValue([mockState]);

			mockDevicesService.findAll.mockResolvedValue([
				Object.assign(new HomeAssistantDeviceEntity(), {
					id: '1234',
					haDeviceId: 'device_1',
				}),
			]);

			const result = await service.getDiscoveredDevice('device_1');

			expect(result).toBeDefined();
			expect(result.id).toBe('device_1');
			expect(result.states[0].entityId).toBe('sensor.temp');
			expect(result.adoptedDeviceId).toBe('1234');
		});

		it('should throw validation error if apiKey is missing', async () => {
			jest.spyOn<ConfigService, any>(configService, 'getPluginConfig').mockReturnValueOnce({
				apiKey: null,
				hostname: 'localhost',
			});

			await expect(service.getDiscoveredDevice('device_1')).rejects.toThrow(DevicesHomeAssistantValidationException);
		});

		it('should throw not found error if discovered device is null', async () => {
			jest.spyOn<HomeAssistantHttpService, any>(service, 'fetchSingleHaDevice').mockResolvedValue(null);

			await expect(service.getDiscoveredDevice('device_1')).rejects.toThrow(DevicesHomeAssistantNotFoundException);
		});
	});

	describe('getDiscoveredDevices', () => {
		it('should return list of discovered devices', async () => {
			const mockDevice: HomeAssistantDiscoveredDeviceDto = {
				id: 'device_1',
				name: 'Test Device',
				entities: ['sensor.temp'],
			};

			const mockState: HomeAssistantStateDto = {
				entity_id: 'sensor.temp',
				state: '22',
				attributes: { unit_of_measurement: '°C' },
				last_changed: new Date(),
				last_updated: new Date(),
				last_reported: new Date(),
				context: {
					id: 'context-id',
					parent_id: null,
					user_id: null,
				},
			};

			jest.spyOn<HomeAssistantHttpService, any>(service, 'fetchListHaDevices').mockResolvedValue([mockDevice]);
			jest.spyOn<HomeAssistantHttpService, any>(service, 'fetchListHaStates').mockResolvedValue([mockState]);

			mockDevicesService.findAll.mockResolvedValue([]);

			const result = await service.getDiscoveredDevices();

			expect(result).toHaveLength(1);
			expect(result[0].id).toBe('device_1');
			expect(result[0].states[0].entityId).toBe('sensor.temp');
		});

		it('should throw validation error if apiKey is missing', async () => {
			jest.spyOn<ConfigService, any>(configService, 'getPluginConfig').mockReturnValueOnce({
				apiKey: null,
				hostname: 'localhost',
			});

			await expect(service.getDiscoveredDevices()).rejects.toThrow(DevicesHomeAssistantValidationException);
		});

		it('should throw not found error if devices or states are null', async () => {
			jest.spyOn<HomeAssistantHttpService, any>(service, 'fetchListHaDevices').mockResolvedValue(null);
			jest.spyOn<HomeAssistantHttpService, any>(service, 'fetchListHaStates').mockResolvedValue(null);

			await expect(service.getDiscoveredDevices()).rejects.toThrow(DevicesHomeAssistantNotFoundException);
		});
	});

	describe('getState', () => {
		it('should return parsed state model if successful', async () => {
			const mockDto = {
				entity_id: 'sensor.temp',
				state: '22',
				attributes: { unit_of_measurement: '°C' },
				last_changed: new Date().toISOString(),
				last_reported: new Date().toISOString(),
				last_updated: new Date().toISOString(),
			};

			jest.spyOn<HomeAssistantHttpService, any>(service, 'fetchSingleHaState').mockResolvedValue(mockDto);

			const result = await service.getState('sensor.temp');

			expect(result.entityId).toBe('sensor.temp');
			expect(result.attributes.unit_of_measurement).toBe('°C');
		});

		it('should throw validation error if apiKey is missing', async () => {
			jest.spyOn<ConfigService, any>(configService, 'getPluginConfig').mockReturnValueOnce({
				apiKey: null,
				hostname: 'localhost',
			});

			await expect(service.getState('sensor.temp')).rejects.toThrow(DevicesHomeAssistantValidationException);
		});

		it('should throw not found error if state is null', async () => {
			jest.spyOn<HomeAssistantHttpService, any>(service, 'fetchSingleHaState').mockResolvedValue(null);

			await expect(service.getState('sensor.temp')).rejects.toThrow(DevicesHomeAssistantNotFoundException);
		});
	});

	describe('getStates', () => {
		it('should return list of entities states', async () => {
			const mockDto = {
				entity_id: 'sensor.temp',
				state: '22',
				attributes: { unit_of_measurement: '°C' },
				last_changed: new Date().toISOString(),
				last_reported: new Date().toISOString(),
				last_updated: new Date().toISOString(),
			};

			jest.spyOn<HomeAssistantHttpService, any>(service, 'fetchListHaStates').mockResolvedValue([mockDto]);

			const result = await service.getStates();

			expect(result).toHaveLength(1);
			expect(result[0].entityId).toBe('sensor.temp');
			expect(result[0].attributes.unit_of_measurement).toBe('°C');
		});

		it('should throw validation error if apiKey is missing', async () => {
			jest.spyOn<ConfigService, any>(configService, 'getPluginConfig').mockReturnValueOnce({
				apiKey: null,
				hostname: 'localhost',
			});

			await expect(service.getStates()).rejects.toThrow(DevicesHomeAssistantValidationException);
		});

		it('should throw not found error if states are null', async () => {
			jest.spyOn<HomeAssistantHttpService, any>(service, 'fetchListHaStates').mockResolvedValue(null);

			await expect(service.getStates()).rejects.toThrow(DevicesHomeAssistantNotFoundException);
		});
	});
});
