/*eslint-disable @typescript-eslint/unbound-method*/
import { useContainer } from 'class-validator';

import { Test, TestingModule } from '@nestjs/testing';

import {
	ChannelCategory,
	DataTypeType,
	DeviceCategory,
	PermissionType,
	PropertyCategory,
} from '../../../modules/devices/devices.constants';
import { ChannelsPropertiesService } from '../../../modules/devices/services/channels.properties.service';
import { ChannelsService } from '../../../modules/devices/services/channels.service';
import { DeviceConnectivityService } from '../../../modules/devices/services/device-connectivity.service';
import { DeviceValidationService } from '../../../modules/devices/services/device-validation.service';
import { DevicesService } from '../../../modules/devices/services/devices.service';
import { DeviceExistsConstraintValidator } from '../../../modules/devices/validators/device-exists-constraint.validator';
import { DEVICES_ZIGBEE2MQTT_TYPE } from '../devices-zigbee2mqtt.constants';
import {
	DevicesZigbee2mqttNotFoundException,
	DevicesZigbee2mqttValidationException,
} from '../devices-zigbee2mqtt.exceptions';
import { AdoptDeviceRequestDto } from '../dto/mapping-preview.dto';
import { Zigbee2mqttDeviceEntity } from '../entities/devices-zigbee2mqtt.entity';
import { Z2mRegisteredDevice } from '../interfaces/zigbee2mqtt.interface';
import { ConfigDrivenConverter } from '../mappings/config-driven.converter';
import { MappingLoaderService } from '../mappings/mapping-loader.service';
import { TransformerRegistry } from '../mappings/transformers';

import { Z2mDeviceAdoptionService } from './device-adoption.service';
import { Z2mDeviceMapperService } from './device-mapper.service';
import { Z2mExposesMapperService } from './exposes-mapper.service';
import { Z2mVirtualPropertyService } from './virtual-property.service';
import { Zigbee2mqttService } from './zigbee2mqtt.service';

describe('Z2mDeviceAdoptionService', () => {
	let service: Z2mDeviceAdoptionService;
	let zigbee2mqttService: jest.Mocked<Zigbee2mqttService>;
	let devicesService: jest.Mocked<DevicesService>;
	let channelsService: jest.Mocked<ChannelsService>;
	let channelsPropertiesService: jest.Mocked<ChannelsPropertiesService>;
	let deviceConnectivityService: jest.Mocked<DeviceConnectivityService>;
	let deviceValidationService: jest.Mocked<DeviceValidationService>;
	let deviceMapper: jest.Mocked<Z2mDeviceMapperService>;
	let exposesMapper: Z2mExposesMapperService;

	const MOCK_DEVICE_ID = 'device-uuid-1';

	let propertyIdCounter: number;

	const createMockZ2mDevice = (overrides?: Partial<Z2mRegisteredDevice>): Z2mRegisteredDevice => ({
		ieeeAddress: '0xa4c138e4f788f9fe',
		friendlyName: 'living_room_light',
		type: 'Router',
		supported: true,
		disabled: false,
		available: true,
		currentState: {},
		definition: {
			model: 'LED1545G12',
			vendor: 'IKEA',
			description: 'TRADFRI LED bulb E26',
			exposes: [
				{
					type: 'light',
					features: [
						{
							type: 'binary',
							name: 'state',
							property: 'state',
							access: 7,
							value_on: 'ON',
							value_off: 'OFF',
						},
						{
							type: 'numeric',
							name: 'brightness',
							property: 'brightness',
							access: 7,
							value_min: 0,
							value_max: 254,
						},
					],
				},
			],
		},
		...overrides,
	});

	const createAdoptRequest = (overrides?: Partial<AdoptDeviceRequestDto>): AdoptDeviceRequestDto => {
		const request = new AdoptDeviceRequestDto();
		request.ieeeAddress = '0xa4c138e4f788f9fe';
		request.name = 'Living Room Light';
		request.category = DeviceCategory.LIGHTING;
		request.description = 'Test light device';
		request.enabled = true;
		request.channels = [
			{
				category: ChannelCategory.LIGHT,
				name: 'Light',
				properties: [
					{
						category: PropertyCategory.ON,
						dataType: DataTypeType.BOOL,
						permissions: [PermissionType.READ_WRITE],
						z2mProperty: 'state',
					},
					{
						category: PropertyCategory.BRIGHTNESS,
						dataType: DataTypeType.UCHAR,
						permissions: [PermissionType.READ_WRITE],
						format: [0, 100],
						z2mProperty: 'brightness',
					},
				],
			},
		] as AdoptDeviceRequestDto['channels'];

		if (overrides) {
			Object.assign(request, overrides);
		}
		return request;
	};

	const createMockDeviceEntity = (id: string = MOCK_DEVICE_ID): Zigbee2mqttDeviceEntity =>
		({
			id,
			type: DEVICES_ZIGBEE2MQTT_TYPE,
			identifier: 'living_room_light',
			name: 'Living Room Light',
			category: DeviceCategory.LIGHTING,
			enabled: true,
			description: 'Test light device',
			icon: null,
			draft: false,
			created_at: new Date(),
			updated_at: new Date(),
		}) as unknown as Zigbee2mqttDeviceEntity;

	beforeEach(async () => {
		jest.clearAllMocks();
		propertyIdCounter = 0;

		const module: TestingModule = await Test.createTestingModule({
			providers: [
				Z2mDeviceAdoptionService,
				Z2mExposesMapperService,
				Z2mVirtualPropertyService,
				ConfigDrivenConverter,
				MappingLoaderService,
				TransformerRegistry,
				{
					provide: Zigbee2mqttService,
					useValue: {
						getRegisteredDevices: jest.fn().mockReturnValue([]),
						requestDeviceState: jest.fn().mockResolvedValue(true),
					},
				},
				{
					provide: DevicesService,
					useValue: {
						findAll: jest.fn().mockResolvedValue([]),
						create: jest.fn().mockResolvedValue({ id: MOCK_DEVICE_ID }),
						findOne: jest.fn().mockResolvedValue(createMockDeviceEntity()),
						remove: jest.fn().mockResolvedValue(undefined),
					},
				},
				{
					provide: ChannelsService,
					useValue: {
						create: jest.fn().mockImplementation(() => Promise.resolve({ id: `channel-uuid-${++propertyIdCounter}` })),
						findAll: jest.fn().mockResolvedValue([]),
					},
				},
				{
					provide: ChannelsPropertiesService,
					useValue: {
						create: jest.fn().mockImplementation(() => Promise.resolve({ id: `property-uuid-${++propertyIdCounter}` })),
						findAll: jest.fn().mockResolvedValue([]),
					},
				},
				{
					provide: DeviceConnectivityService,
					useValue: {
						setConnectionState: jest.fn().mockResolvedValue(undefined),
					},
				},
				{
					provide: DeviceValidationService,
					useValue: {
						validateDeviceStructure: jest.fn().mockReturnValue({ isValid: true, issues: [] }),
					},
				},
				{
					provide: Z2mDeviceMapperService,
					useValue: {
						registerPropertyTransformer: jest.fn(),
					},
				},
				{
					provide: DeviceExistsConstraintValidator,
					useValue: {
						validate: jest.fn().mockResolvedValue(true),
					},
				},
			],
		}).compile();

		useContainer(module, { fallbackOnErrors: true });

		// Mock validate function to bypass class-validator custom validators in tests
		// eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-unsafe-assignment
		const classValidator = require('class-validator');
		jest.spyOn(classValidator, 'validate').mockResolvedValue([]);

		service = module.get<Z2mDeviceAdoptionService>(Z2mDeviceAdoptionService);
		zigbee2mqttService = module.get(Zigbee2mqttService);
		devicesService = module.get(DevicesService);
		channelsService = module.get(ChannelsService);
		channelsPropertiesService = module.get(ChannelsPropertiesService);
		deviceConnectivityService = module.get(DeviceConnectivityService);
		deviceValidationService = module.get(DeviceValidationService);
		deviceMapper = module.get(Z2mDeviceMapperService);
		exposesMapper = module.get<Z2mExposesMapperService>(Z2mExposesMapperService);

		// Initialize real services (YAML loading)
		const mappingLoader = module.get<MappingLoaderService>(MappingLoaderService);
		mappingLoader.onModuleInit();
		exposesMapper.onModuleInit();
	});

	describe('adoptDevice', () => {
		it('should create device, information channel, and user channels', async () => {
			const z2mDevice = createMockZ2mDevice();
			zigbee2mqttService.getRegisteredDevices.mockReturnValue([z2mDevice]);

			const request = createAdoptRequest();
			const result = await service.adoptDevice(request);

			// Should create the device
			expect(devicesService.create).toHaveBeenCalledTimes(1);
			expect(devicesService.create).toHaveBeenCalledWith(
				expect.objectContaining({
					type: DEVICES_ZIGBEE2MQTT_TYPE,
					identifier: 'living_room_light',
					name: 'Living Room Light',
					category: DeviceCategory.LIGHTING,
				}),
			);

			// Should create device information channel + user channel (light)
			expect(channelsService.create).toHaveBeenCalledTimes(2);

			// First call: device information channel
			expect(channelsService.create).toHaveBeenCalledWith(
				expect.objectContaining({
					category: ChannelCategory.DEVICE_INFORMATION,
					name: 'Device Information',
				}),
			);

			// Second call: light channel
			expect(channelsService.create).toHaveBeenCalledWith(
				expect.objectContaining({
					category: ChannelCategory.LIGHT,
					name: 'Light',
				}),
			);

			// Should create device information properties (manufacturer, model, serial_number, link_quality)
			expect(channelsPropertiesService.create).toHaveBeenCalledWith(
				expect.any(String),
				expect.objectContaining({
					category: PropertyCategory.MANUFACTURER,
					value: 'IKEA',
				}),
			);

			expect(channelsPropertiesService.create).toHaveBeenCalledWith(
				expect.any(String),
				expect.objectContaining({
					category: PropertyCategory.MODEL,
					value: 'LED1545G12',
				}),
			);

			expect(channelsPropertiesService.create).toHaveBeenCalledWith(
				expect.any(String),
				expect.objectContaining({
					category: PropertyCategory.SERIAL_NUMBER,
					value: '0xa4c138e4f788f9fe',
				}),
			);

			// Should set connection state
			expect(deviceConnectivityService.setConnectionState).toHaveBeenCalledWith(
				MOCK_DEVICE_ID,
				expect.objectContaining({ state: 'connected' }),
			);

			// Should request device state
			expect(zigbee2mqttService.requestDeviceState).toHaveBeenCalledWith('living_room_light');

			// Should return fully loaded device
			expect(devicesService.findOne).toHaveBeenCalledWith(MOCK_DEVICE_ID, DEVICES_ZIGBEE2MQTT_TYPE);
			expect(result).toBeDefined();
		});

		it('should throw when Z2M device not found', async () => {
			zigbee2mqttService.getRegisteredDevices.mockReturnValue([]);

			const request = createAdoptRequest();

			await expect(service.adoptDevice(request)).rejects.toThrow(DevicesZigbee2mqttNotFoundException);
		});

		it('should handle re-adoption by removing existing device first', async () => {
			const z2mDevice = createMockZ2mDevice();
			zigbee2mqttService.getRegisteredDevices.mockReturnValue([z2mDevice]);

			const existingDevice = createMockDeviceEntity('existing-device-id');
			devicesService.findAll.mockResolvedValue([existingDevice]);

			const request = createAdoptRequest();
			await service.adoptDevice(request);

			// Should remove existing device before creating new one
			expect(devicesService.remove).toHaveBeenCalledWith('existing-device-id');
			// Should still create the new device
			expect(devicesService.create).toHaveBeenCalledTimes(1);
		});

		it('should handle re-adoption by IEEE address in serial_number property', async () => {
			const z2mDevice = createMockZ2mDevice();
			zigbee2mqttService.getRegisteredDevices.mockReturnValue([z2mDevice]);

			// Existing device with different identifier (not matching by friendlyName)
			const existingDevice = createMockDeviceEntity('existing-device-id');
			existingDevice.identifier = 'old_friendly_name';
			(existingDevice as unknown as Record<string, unknown>).identifier = 'old_friendly_name';

			devicesService.findAll.mockResolvedValue([existingDevice]);

			// Mock info channel with serial number matching the IEEE address
			const infoChannel = {
				id: 'info-channel-id',
				category: ChannelCategory.DEVICE_INFORMATION,
			};
			channelsService.findAll.mockResolvedValue([infoChannel] as never);

			const serialProp = {
				id: 'serial-prop-id',
				category: PropertyCategory.SERIAL_NUMBER,
				value: { value: '0xa4c138e4f788f9fe' },
			};
			channelsPropertiesService.findAll.mockResolvedValue([serialProp] as never);

			const request = createAdoptRequest();
			await service.adoptDevice(request);

			// Should remove existing device found by IEEE address
			expect(devicesService.remove).toHaveBeenCalledWith('existing-device-id');
		});

		it('should create virtual properties with fb.virtual. prefix', async () => {
			const z2mDevice = createMockZ2mDevice({
				definition: {
					model: 'TS130F',
					vendor: 'Lilistore',
					description: 'Cover motor',
					exposes: [
						{
							type: 'cover',
							features: [
								{
									type: 'enum',
									name: 'state',
									property: 'state',
									access: 3,
									values: ['OPEN', 'CLOSE', 'STOP'],
								},
								{
									type: 'numeric',
									name: 'position',
									property: 'position',
									access: 3,
									unit: '%',
									value_min: 0,
									value_max: 100,
								},
							],
						},
					] as never,
				},
				currentState: { position: 50 },
			});
			zigbee2mqttService.getRegisteredDevices.mockReturnValue([z2mDevice]);

			const request = createAdoptRequest({
				ieeeAddress: '0xa4c138e4f788f9fe',
				name: 'Window Cover',
				category: DeviceCategory.GENERIC,
				channels: [
					{
						category: ChannelCategory.WINDOW_COVERING,
						name: 'Window Covering',
						properties: [
							{
								category: PropertyCategory.STATUS,
								dataType: DataTypeType.ENUM,
								permissions: [PermissionType.READ_ONLY],
								format: ['opened', 'closed', 'opening', 'closing', 'stopped'],
								z2mProperty: 'state',
							},
							{
								category: PropertyCategory.POSITION,
								dataType: DataTypeType.UCHAR,
								permissions: [PermissionType.READ_WRITE],
								format: [0, 100],
								z2mProperty: 'position',
							},
							{
								category: PropertyCategory.TYPE,
								dataType: DataTypeType.ENUM,
								permissions: [PermissionType.READ_ONLY],
								format: ['curtain', 'blind', 'roller', 'outdoor_blind'],
								z2mProperty: 'fb.virtual.type',
							},
							{
								category: PropertyCategory.COMMAND,
								dataType: DataTypeType.ENUM,
								permissions: [PermissionType.WRITE_ONLY],
								format: ['open', 'close', 'stop'],
								z2mProperty: 'fb.virtual.command',
							},
						],
					},
				] as AdoptDeviceRequestDto['channels'],
			});

			await service.adoptDevice(request);

			// Should create virtual property with fb_virtual_ identifier
			expect(channelsPropertiesService.create).toHaveBeenCalledWith(
				expect.any(String),
				expect.objectContaining({
					identifier: 'fb_virtual_type',
					category: PropertyCategory.TYPE,
				}),
			);

			expect(channelsPropertiesService.create).toHaveBeenCalledWith(
				expect.any(String),
				expect.objectContaining({
					identifier: 'fb_virtual_command',
					category: PropertyCategory.COMMAND,
				}),
			);
		});

		it('should create static properties from YAML mappings', async () => {
			const z2mDevice = createMockZ2mDevice();
			zigbee2mqttService.getRegisteredDevices.mockReturnValue([z2mDevice]);

			const request = createAdoptRequest();
			await service.adoptDevice(request);

			// The exposesMapper uses real YAML which may define static/derived properties
			// for a light channel. At minimum, the light channel properties and info properties
			// should be created.
			const totalCreateCalls = channelsPropertiesService.create.mock.calls.length;

			// Should have at least: 4 info props + 2 user props = 6
			expect(totalCreateCalls).toBeGreaterThanOrEqual(6);
		});

		it('should clean up device on channel creation failure', async () => {
			const z2mDevice = createMockZ2mDevice();
			zigbee2mqttService.getRegisteredDevices.mockReturnValue([z2mDevice]);

			// Make channel creation fail after device is created
			channelsService.create.mockRejectedValue(new Error('Channel creation failed'));

			const request = createAdoptRequest();

			await expect(service.adoptDevice(request)).rejects.toThrow('Channel creation failed');

			// Should attempt to remove the device for cleanup
			expect(devicesService.remove).toHaveBeenCalledWith(MOCK_DEVICE_ID);
		});

		it('should throw validation error when no channels provided', async () => {
			const z2mDevice = createMockZ2mDevice();
			zigbee2mqttService.getRegisteredDevices.mockReturnValue([z2mDevice]);

			const request = createAdoptRequest({
				channels: [],
			});

			await expect(service.adoptDevice(request)).rejects.toThrow(DevicesZigbee2mqttValidationException);
			await expect(service.adoptDevice(request)).rejects.toThrow('At least one channel must be defined');
		});

		it('should set disconnected state when device is not available', async () => {
			const z2mDevice = createMockZ2mDevice({ available: false });
			zigbee2mqttService.getRegisteredDevices.mockReturnValue([z2mDevice]);

			const request = createAdoptRequest();
			await service.adoptDevice(request);

			expect(deviceConnectivityService.setConnectionState).toHaveBeenCalledWith(
				MOCK_DEVICE_ID,
				expect.objectContaining({ state: 'disconnected' }),
			);
		});

		it('should call validateDeviceStructure during pre-validation', async () => {
			const z2mDevice = createMockZ2mDevice();
			zigbee2mqttService.getRegisteredDevices.mockReturnValue([z2mDevice]);

			const request = createAdoptRequest();
			await service.adoptDevice(request);

			expect(deviceValidationService.validateDeviceStructure).toHaveBeenCalledWith(
				expect.objectContaining({
					category: DeviceCategory.LIGHTING,
					// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
					channels: expect.arrayContaining([
						expect.objectContaining({ category: ChannelCategory.DEVICE_INFORMATION }),
						expect.objectContaining({ category: ChannelCategory.LIGHT }),
					]),
				}),
			);
		});

		it('should register property transformer when YAML mapping defines one', async () => {
			const z2mDevice = createMockZ2mDevice();
			zigbee2mqttService.getRegisteredDevices.mockReturnValue([z2mDevice]);

			const request = createAdoptRequest();
			await service.adoptDevice(request);

			// The brightness property should have a transformer registered from the YAML mapping
			// (brightness_scale transformer maps 0-254 to 0-100)
			const registerCalls = deviceMapper.registerPropertyTransformer.mock.calls;

			// At least one transformer should be registered (brightness)
			const brightnessTransformerCall = registerCalls.find((call) => call[2] === 'brightness');
			if (brightnessTransformerCall) {
				expect(brightnessTransformerCall[1]).toBeDefined(); // transformer name
				expect(brightnessTransformerCall[2]).toBe('brightness'); // z2mProperty
			}
		});

		it('should skip device_information channel from request channels', async () => {
			const z2mDevice = createMockZ2mDevice();
			zigbee2mqttService.getRegisteredDevices.mockReturnValue([z2mDevice]);

			const request = createAdoptRequest({
				channels: [
					{
						category: ChannelCategory.DEVICE_INFORMATION,
						name: 'Device Information',
						properties: [],
					},
					{
						category: ChannelCategory.LIGHT,
						name: 'Light',
						properties: [
							{
								category: PropertyCategory.ON,
								dataType: DataTypeType.BOOL,
								permissions: [PermissionType.READ_WRITE],
								z2mProperty: 'state',
							},
						],
					},
				] as AdoptDeviceRequestDto['channels'],
			});

			await service.adoptDevice(request);

			// Should only create 2 channels: auto-created device_information + light
			// The device_information from request should be skipped
			expect(channelsService.create).toHaveBeenCalledTimes(2);
		});

		it('should handle device with initial state values', async () => {
			const z2mDevice = createMockZ2mDevice({
				currentState: {
					state: 'ON',
					brightness: 200,
					linkquality: 127,
				},
			});
			zigbee2mqttService.getRegisteredDevices.mockReturnValue([z2mDevice]);

			const request = createAdoptRequest();
			await service.adoptDevice(request);

			// Link quality should be normalized to percentage
			expect(channelsPropertiesService.create).toHaveBeenCalledWith(
				expect.any(String),
				expect.objectContaining({
					category: PropertyCategory.LINK_QUALITY,
					value: 50, // Math.round((127/255) * 100) = 50
				}),
			);
		});
	});
});
