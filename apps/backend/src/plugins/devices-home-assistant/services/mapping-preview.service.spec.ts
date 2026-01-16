import { Test, TestingModule } from '@nestjs/testing';

import { ChannelCategory, DeviceCategory, PropertyCategory } from '../../../modules/devices/devices.constants';
import {
	DeviceValidationService,
	ValidationIssueSeverity,
	ValidationIssueType,
} from '../../../modules/devices/services/device-validation.service';
import { HomeAssistantDomain } from '../devices-home-assistant.constants';
import { DevicesHomeAssistantNotFoundException } from '../devices-home-assistant.exceptions';
import { MappingPreviewRequestDto } from '../dto/mapping-preview.dto';
import { EntityRole, MappingLoaderService } from '../mappings';

import { HomeAssistantHttpService } from './home-assistant.http.service';
import { HomeAssistantWsService } from './home-assistant.ws.service';
import { LightCapabilityAnalyzer } from './light-capability.analyzer';
import { MappingPreviewService } from './mapping-preview.service';
import { VirtualPropertyService } from './virtual-property.service';

describe('MappingPreviewService', () => {
	let service: MappingPreviewService;
	let homeAssistantHttpService: jest.Mocked<HomeAssistantHttpService>;
	let homeAssistantWsService: jest.Mocked<HomeAssistantWsService>;
	let deviceValidationService: jest.Mocked<DeviceValidationService>;

	const mockDeviceRegistry = [
		{
			id: 'device123',
			name: 'Test Light',
			nameByUser: null,
			manufacturer: 'Test Manufacturer',
			model: 'Test Model',
			serialNumber: 'SN123',
			swVersion: '1.0.0',
			hwVersion: '1.0',
			modelId: null,
			areaId: null,
			connections: [['mac', 'aa:bb:cc:dd:ee:ff']] as [string, string][],
			createdAt: new Date(),
			modifiedAt: new Date(),
		},
	];

	const mockEntityRegistry = [
		{
			id: 'entity1',
			entityId: 'light.test_light',
			deviceId: 'device123',
			areaId: null,
			entityCategory: null,
			hasEntityName: true,
			icon: null,
			name: 'Test Light',
			originalName: 'Test Light',
			uniqueId: 'unique123',
			createdAt: new Date(),
			modifiedAt: new Date(),
		},
	];

	const mockDiscoveredDevice = {
		id: 'device123',
		name: 'Test Light',
		entities: ['light.test_light'],
		states: [
			{
				entityId: 'light.test_light',
				state: 'on',
				attributes: {
					friendly_name: 'Test Light',
					brightness: 255,
					device_class: null,
				},
				lastChanged: new Date(),
				lastReported: new Date(),
				lastUpdated: new Date(),
			},
		],
		adoptedDeviceId: null,
	};

	beforeEach(async () => {
		const homeAssistantHttpServiceMock: Partial<jest.Mocked<HomeAssistantHttpService>> = {
			getDiscoveredDevice: jest.fn(),
		};

		const homeAssistantWsServiceMock: Partial<jest.Mocked<HomeAssistantWsService>> = {
			getDevicesRegistry: jest.fn(),
			getEntitiesRegistry: jest.fn(),
		};

		const virtualPropertyServiceMock: Partial<jest.Mocked<VirtualPropertyService>> = {
			getMissingVirtualProperties: jest.fn().mockReturnValue([]),
			resolveVirtualPropertyValue: jest.fn(),
			canFulfillWithVirtual: jest.fn().mockReturnValue(false),
		};

		const deviceValidationServiceMock: Partial<jest.Mocked<DeviceValidationService>> = {
			validateDeviceStructure: jest.fn().mockReturnValue({ isValid: true, issues: [] }),
		};

		const mockMapping = {
			name: 'light_default',
			domain: HomeAssistantDomain.LIGHT,
			deviceClass: null,
			priority: 50,
			channel: { category: ChannelCategory.LIGHT },
			deviceCategory: DeviceCategory.LIGHTING,
			propertyBindings: [
				{ haAttribute: 'fb.main_state', propertyCategory: PropertyCategory.ON },
				{ haAttribute: 'brightness', propertyCategory: PropertyCategory.BRIGHTNESS },
			],
		};

		const mappingLoaderServiceMock: Partial<jest.Mocked<MappingLoaderService>> = {
			findMatchingMapping: jest.fn().mockReturnValue(mockMapping),
			getDomainRole: jest.fn().mockReturnValue(EntityRole.PRIMARY),
			getVirtualProperties: jest.fn().mockReturnValue([]),
			getMappings: jest.fn().mockReturnValue([mockMapping]),
		};

		const module: TestingModule = await Test.createTestingModule({
			providers: [
				MappingPreviewService,
				LightCapabilityAnalyzer,
				{ provide: HomeAssistantHttpService, useValue: homeAssistantHttpServiceMock },
				{ provide: HomeAssistantWsService, useValue: homeAssistantWsServiceMock },
				{ provide: VirtualPropertyService, useValue: virtualPropertyServiceMock },
				{ provide: DeviceValidationService, useValue: deviceValidationServiceMock },
				{ provide: MappingLoaderService, useValue: mappingLoaderServiceMock },
			],
		}).compile();

		service = module.get(MappingPreviewService);
		homeAssistantHttpService = module.get(HomeAssistantHttpService);
		homeAssistantWsService = module.get(HomeAssistantWsService);
		deviceValidationService = module.get(DeviceValidationService);
	});

	afterEach(() => {
		jest.clearAllMocks();
	});

	it('should be defined', () => {
		expect(service).toBeDefined();
	});

	describe('generatePreview', () => {
		it('should generate a mapping preview for a light device', async () => {
			homeAssistantWsService.getDevicesRegistry.mockResolvedValue(mockDeviceRegistry);
			homeAssistantWsService.getEntitiesRegistry.mockResolvedValue(mockEntityRegistry);
			homeAssistantHttpService.getDiscoveredDevice.mockResolvedValue(mockDiscoveredDevice);

			const result = await service.generatePreview('device123');

			expect(result.haDevice.id).toBe('device123');
			expect(result.haDevice.name).toBe('Test Light');
			expect(result.suggestedDevice.category).toBe(DeviceCategory.LIGHTING);
			expect(result.entities).toHaveLength(1);
			expect(result.entities[0].entityId).toBe('light.test_light');
			expect(result.entities[0].status).toBe('mapped');
			expect(result.entities[0].suggestedChannel).not.toBeNull();
			expect(result.entities[0].suggestedChannel?.category).toBe(ChannelCategory.LIGHT);
		});

		it('should throw DevicesHomeAssistantNotFoundException if device not found', async () => {
			homeAssistantWsService.getDevicesRegistry.mockResolvedValue([]);
			homeAssistantWsService.getEntitiesRegistry.mockResolvedValue([]);
			homeAssistantHttpService.getDiscoveredDevice.mockResolvedValue(mockDiscoveredDevice);

			await expect(service.generatePreview('nonexistent')).rejects.toThrow(DevicesHomeAssistantNotFoundException);
		});

		it('should apply entity overrides from the request', async () => {
			homeAssistantWsService.getDevicesRegistry.mockResolvedValue(mockDeviceRegistry);
			homeAssistantWsService.getEntitiesRegistry.mockResolvedValue(mockEntityRegistry);
			homeAssistantHttpService.getDiscoveredDevice.mockResolvedValue(mockDiscoveredDevice);

			const request: MappingPreviewRequestDto = {
				entityOverrides: [
					{
						entityId: 'light.test_light',
						skip: true,
					},
				],
			};

			const result = await service.generatePreview('device123', request);

			expect(result.entities[0].status).toBe('skipped');
			expect(result.entities[0].suggestedChannel).toBeNull();
		});

		it('should override device category when provided', async () => {
			homeAssistantWsService.getDevicesRegistry.mockResolvedValue(mockDeviceRegistry);
			homeAssistantWsService.getEntitiesRegistry.mockResolvedValue(mockEntityRegistry);
			homeAssistantHttpService.getDiscoveredDevice.mockResolvedValue(mockDiscoveredDevice);

			const request: MappingPreviewRequestDto = {
				deviceCategory: DeviceCategory.GENERIC,
			};

			const result = await service.generatePreview('device123', request);

			expect(result.suggestedDevice.category).toBe(DeviceCategory.GENERIC);
		});

		it('should identify missing required channels', async () => {
			const mockSensorEntityRegistry = [
				{
					id: 'entity1',
					entityId: 'sensor.temperature',
					deviceId: 'device123',
					areaId: null,
					entityCategory: null,
					hasEntityName: true,
					icon: null,
					name: 'Temperature Sensor',
					originalName: 'Temperature',
					uniqueId: 'temp123',
					createdAt: new Date(),
					modifiedAt: new Date(),
				},
			];

			const mockSensorDiscoveredDevice = {
				id: 'device123',
				name: 'Test Thermostat',
				entities: ['sensor.temperature'],
				states: [
					{
						entityId: 'sensor.temperature',
						state: '22.5',
						attributes: {
							friendly_name: 'Temperature',
							device_class: 'temperature',
							unit_of_measurement: '°C',
						},
						lastChanged: new Date(),
						lastReported: new Date(),
						lastUpdated: new Date(),
					},
				],
				adoptedDeviceId: null,
			};

			homeAssistantWsService.getDevicesRegistry.mockResolvedValue(mockDeviceRegistry);
			homeAssistantWsService.getEntitiesRegistry.mockResolvedValue(mockSensorEntityRegistry);
			homeAssistantHttpService.getDiscoveredDevice.mockResolvedValue(mockSensorDiscoveredDevice);

			// Configure validation to return invalid when thermostat channel is missing
			deviceValidationService.validateDeviceStructure.mockReturnValue({
				isValid: false,
				issues: [
					{
						type: ValidationIssueType.MISSING_CHANNEL,
						severity: ValidationIssueSeverity.ERROR,
						channelCategory: ChannelCategory.THERMOSTAT,
						message: 'Missing required channel: thermostat',
					},
				],
			});

			const request: MappingPreviewRequestDto = {
				deviceCategory: DeviceCategory.THERMOSTAT,
			};

			const result = await service.generatePreview('device123', request);

			// Thermostat requires thermostat channel, so there should be warnings about missing channels
			expect(result.warnings.some((w) => w.type === 'missing_required_channel')).toBe(true);
			expect(result.readyToAdopt).toBe(false);
		});
	});
});
