import { Test, TestingModule } from '@nestjs/testing';

import { ConfigService } from '../../../modules/config/services/config.service';
import { ChannelsPropertiesService } from '../../../modules/devices/services/channels.properties.service';
import { DeviceConnectivityService } from '../../../modules/devices/services/device-connectivity.service';
import { DevicesService } from '../../../modules/devices/services/devices.service';
import {
	DevicesHomeAssistantNotFoundException,
	DevicesHomeAssistantValidationException,
} from '../devices-home-assistant.exceptions';
import { HomeAssistantDiscoveredDeviceDto } from '../dto/home-assistant-discovered-device.dto';
import { HomeAssistantDiscoveredHelperDto } from '../dto/home-assistant-discovered-helper.dto';
import { HomeAssistantStateDto } from '../dto/home-assistant-state.dto';
import {
	HomeAssistantChannelEntity,
	HomeAssistantChannelPropertyEntity,
	HomeAssistantDeviceEntity,
} from '../entities/devices-home-assistant.entity';
import { MapperService } from '../mappers/mapper.service';

import { HaSupervisorService } from './ha-supervisor.service';
import { HomeAssistantHttpService } from './home-assistant.http.service';
import { VirtualPropertyService } from './virtual-property.service';

const mockConfigService = {
	getPluginConfig: jest.fn(),
};

const mockDevicesService = {
	findAll: jest.fn(),
};

const mockChannelsPropertiesService = {
	findAll: jest.fn(),
	update: jest.fn(),
};

const mockHomeAssistantMapperService = {
	mapFromHA: jest.fn(),
};

const mockDeviceConnectivityService = {
	setConnectionState: jest.fn(),
};

const mockVirtualPropertyService = {
	resolveVirtualPropertyValue: jest.fn(),
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
				{ provide: ChannelsPropertiesService, useValue: mockChannelsPropertiesService },
				{ provide: MapperService, useValue: mockHomeAssistantMapperService },
				{ provide: DeviceConnectivityService, useValue: mockDeviceConnectivityService },
				{ provide: VirtualPropertyService, useValue: mockVirtualPropertyService },
				{
					provide: HaSupervisorService,
					useValue: {
						isInSupervisorMode: () => false,
						getSupervisorToken: () => null,
						getSupervisorApiUrl: () => '',
						getSupervisorWsUrl: () => '',
					},
				},
			],
		}).compile();

		service = module.get(HomeAssistantHttpService);
		configService = module.get(ConfigService);
		devicesService = module.get(DevicesService);

		mockConfigService.getPluginConfig.mockReturnValue({
			apiKey: 'test-api-key',
			hostname: 'localhost',
		});
		mockDevicesService.findAll.mockResolvedValue([]);
		mockChannelsPropertiesService.findAll.mockResolvedValue([]);
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

	describe('getDiscoveredInventory', () => {
		it('shares one states response across physical devices and helpers', async () => {
			const mockDevice: HomeAssistantDiscoveredDeviceDto = {
				id: 'device_1',
				name: 'Test Device',
				entities: ['sensor.temp'],
			};
			const mockHelper: HomeAssistantDiscoveredHelperDto = {
				entity_id: 'input_boolean.guest_mode',
				name: 'Guest mode',
				domain: 'input_boolean',
			};
			const states: HomeAssistantStateDto[] = [
				{
					entity_id: 'sensor.temp',
					state: '22',
					attributes: {},
					last_changed: new Date(),
					last_updated: new Date(),
					last_reported: new Date(),
					context: { id: 'device-state', parent_id: null, user_id: null },
				},
				{
					entity_id: 'input_boolean.guest_mode',
					state: 'off',
					attributes: {},
					last_changed: new Date(),
					last_updated: new Date(),
					last_reported: new Date(),
					context: { id: 'helper-state', parent_id: null, user_id: null },
				},
			];
			const fetchDevices = jest
				.spyOn<HomeAssistantHttpService, any>(service, 'fetchListHaDevices')
				.mockResolvedValue([mockDevice]);
			const fetchHelpers = jest
				.spyOn<HomeAssistantHttpService, any>(service, 'fetchListHaHelpers')
				.mockResolvedValue([mockHelper]);
			const fetchStates = jest
				.spyOn<HomeAssistantHttpService, any>(service, 'fetchListHaStates')
				.mockResolvedValue(states);
			const result = await service.getDiscoveredInventory();

			expect(result.devices[0].states[0].entityId).toBe('sensor.temp');
			expect(result.helpers[0].state?.entityId).toBe('input_boolean.guest_mode');
			expect(fetchDevices.mock.calls).toHaveLength(1);
			expect(fetchHelpers.mock.calls).toHaveLength(1);
			expect(fetchStates.mock.calls).toHaveLength(1);
			expect(mockDevicesService.findAll.mock.calls).toHaveLength(1);
			expect(mockChannelsPropertiesService.findAll.mock.calls).toHaveLength(1);
		});

		it('marks a helper adopted when it is mapped to a property of a physical device', async () => {
			const helper: HomeAssistantDiscoveredHelperDto = {
				entity_id: 'climate.living_room',
				name: 'Living room thermostat',
				domain: 'climate',
			};
			const panelDevice = Object.assign(new HomeAssistantDeviceEntity(), {
				id: 'panel-device-1',
				haDeviceId: 'ha-physical-device-1',
			});
			const channel = Object.assign(new HomeAssistantChannelEntity(), { device: panelDevice });
			const property = Object.assign(new HomeAssistantChannelPropertyEntity(), {
				haEntityId: helper.entity_id,
				channel,
			});

			jest.spyOn<HomeAssistantHttpService, any>(service, 'fetchListHaDevices').mockResolvedValue([]);
			jest.spyOn<HomeAssistantHttpService, any>(service, 'fetchListHaHelpers').mockResolvedValue([helper]);
			jest.spyOn<HomeAssistantHttpService, any>(service, 'fetchListHaStates').mockResolvedValue([]);
			mockDevicesService.findAll.mockResolvedValue([panelDevice]);
			mockChannelsPropertiesService.findAll.mockResolvedValue([property]);

			const result = await service.getDiscoveredInventory();

			expect(result.helpers[0].adoptedDeviceId).toBe(panelDevice.id);
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
