import { Test, TestingModule } from '@nestjs/testing';

import { DeviceCategory, PropertyCategory } from '../../../modules/devices/devices.constants';
import { DevicesService } from '../../../modules/devices/services/devices.service';
import {
	Z2mExposeBinary,
	Z2mExposeNumeric,
	Z2mExposeSpecific,
	Z2mRegisteredDevice,
} from '../interfaces/zigbee2mqtt.interface';
import { ConfigDrivenConverter } from '../mappings/config-driven.converter';
import { MappingLoaderService } from '../mappings/mapping-loader.service';
import { TransformerRegistry } from '../mappings/transformers';

import { Z2mExposesMapperService } from './exposes-mapper.service';
import { Z2mMappingPreviewService } from './mapping-preview.service';
import { Z2mVirtualPropertyService } from './virtual-property.service';
import { Zigbee2mqttService } from './zigbee2mqtt.service';

describe('Z2mMappingPreviewService', () => {
	let service: Z2mMappingPreviewService;
	let zigbee2mqttService: jest.Mocked<Zigbee2mqttService>;
	let mappingLoader: MappingLoaderService;
	let exposesMapper: Z2mExposesMapperService;

	const createLightDevice = (): Z2mRegisteredDevice => ({
		ieeeAddress: '0x00158d00018255df',
		friendlyName: 'living-room-light',
		type: 'Router',
		supported: true,
		disabled: false,
		available: true,
		currentState: { state: 'ON', brightness: 200 },
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
						} as Z2mExposeBinary,
						{
							type: 'numeric',
							name: 'brightness',
							property: 'brightness',
							access: 7,
							value_min: 0,
							value_max: 254,
						} as Z2mExposeNumeric,
					],
				} as Z2mExposeSpecific,
				{
					type: 'numeric',
					name: 'linkquality',
					property: 'linkquality',
					access: 1,
					unit: 'lqi',
					value_min: 0,
					value_max: 255,
				} as Z2mExposeNumeric,
			],
		},
	});

	const createTemperatureSensorDevice = (): Z2mRegisteredDevice => ({
		ieeeAddress: '0x00158d0001a2b3c4',
		friendlyName: 'bedroom-sensor',
		type: 'EndDevice',
		supported: true,
		disabled: false,
		available: true,
		currentState: { temperature: 22.5, humidity: 55, battery: 85 },
		definition: {
			model: 'WSDCGQ11LM',
			vendor: 'Aqara',
			description: 'Temperature and humidity sensor',
			exposes: [
				{
					type: 'numeric',
					name: 'temperature',
					property: 'temperature',
					access: 1,
					unit: '°C',
					value_min: -20,
					value_max: 60,
				} as Z2mExposeNumeric,
				{
					type: 'numeric',
					name: 'humidity',
					property: 'humidity',
					access: 1,
					unit: '%',
					value_min: 0,
					value_max: 100,
				} as Z2mExposeNumeric,
				{
					type: 'numeric',
					name: 'battery',
					property: 'battery',
					access: 1,
					unit: '%',
					value_min: 0,
					value_max: 100,
				} as Z2mExposeNumeric,
				{
					type: 'numeric',
					name: 'linkquality',
					property: 'linkquality',
					access: 1,
					unit: 'lqi',
					value_min: 0,
					value_max: 255,
				} as Z2mExposeNumeric,
			],
		},
	});

	beforeEach(async () => {
		jest.clearAllMocks();

		const module: TestingModule = await Test.createTestingModule({
			providers: [
				Z2mMappingPreviewService,
				Z2mExposesMapperService,
				Z2mVirtualPropertyService,
				ConfigDrivenConverter,
				MappingLoaderService,
				TransformerRegistry,
				{
					provide: Zigbee2mqttService,
					useValue: {
						getRegisteredDevices: jest.fn().mockReturnValue([]),
						getCachedState: jest.fn().mockReturnValue({}),
						requestDeviceState: jest.fn().mockResolvedValue(false),
					},
				},
				{
					provide: DevicesService,
					useValue: {
						findAll: jest.fn().mockResolvedValue([]),
					},
				},
			],
		}).compile();

		service = module.get<Z2mMappingPreviewService>(Z2mMappingPreviewService);
		zigbee2mqttService = module.get(Zigbee2mqttService);
		mappingLoader = module.get<MappingLoaderService>(MappingLoaderService);
		exposesMapper = module.get<Z2mExposesMapperService>(Z2mExposesMapperService);

		// Initialize the mapping loader first (loads YAML files and registers transformers)
		mappingLoader.onModuleInit();

		// Then initialize the exposes mapper (registers the converter)
		exposesMapper.onModuleInit();
	});

	describe('generatePreview', () => {
		it('should throw when device is not found in Z2M registry', async () => {
			zigbee2mqttService.getRegisteredDevices.mockReturnValue([]);

			await expect(service.generatePreview('0x0000000000000000')).rejects.toThrow(
				'Device with IEEE address 0x0000000000000000 not found in Zigbee2MQTT registry',
			);
		});

		it('should throw when device has no definition', async () => {
			const device: Z2mRegisteredDevice = {
				ieeeAddress: '0x00158d00018255df',
				friendlyName: 'unsupported-device',
				type: 'EndDevice',
				supported: false,
				disabled: false,
				available: true,
				currentState: {},
				definition: undefined,
			};

			zigbee2mqttService.getRegisteredDevices.mockReturnValue([device]);

			await expect(service.generatePreview('0x00158d00018255df')).rejects.toThrow(
				'has no definition (unsupported device)',
			);
		});

		it('should generate preview for a light device with state and brightness', async () => {
			const device = createLightDevice();
			zigbee2mqttService.getRegisteredDevices.mockReturnValue([device]);

			const preview = await service.generatePreview('0x00158d00018255df');

			// Z2M device info
			expect(preview.z2mDevice.ieeeAddress).toBe('0x00158d00018255df');
			expect(preview.z2mDevice.friendlyName).toBe('living-room-light');
			expect(preview.z2mDevice.manufacturer).toBe('IKEA');
			expect(preview.z2mDevice.model).toBe('LED1545G12');

			// Suggested device category should be lighting
			expect(preview.suggestedDevice.category).toBe(DeviceCategory.LIGHTING);
			expect(preview.suggestedDevice.confidence).toBe('high');

			// Should have mapped exposes for state and brightness (linkquality is hidden)
			expect(preview.exposes.length).toBeGreaterThanOrEqual(2);

			const stateExpose = preview.exposes.find((e) => e.exposeName === 'state');
			expect(stateExpose).toBeDefined();
			expect(stateExpose?.status).toBe('mapped');
			expect(stateExpose?.suggestedChannel).toBeDefined();
			expect(stateExpose?.suggestedProperties.length).toBeGreaterThanOrEqual(1);

			const brightnessExpose = preview.exposes.find((e) => e.exposeName === 'brightness');
			expect(brightnessExpose).toBeDefined();
			expect(brightnessExpose?.status).toBe('mapped');
		});

		it('should generate preview for a temperature sensor device', async () => {
			const device = createTemperatureSensorDevice();
			zigbee2mqttService.getRegisteredDevices.mockReturnValue([device]);

			const preview = await service.generatePreview('0x00158d0001a2b3c4');

			// Z2M device info
			expect(preview.z2mDevice.ieeeAddress).toBe('0x00158d0001a2b3c4');
			expect(preview.z2mDevice.manufacturer).toBe('Aqara');

			// Suggested device category should be sensor
			expect(preview.suggestedDevice.category).toBe(DeviceCategory.SENSOR);

			// Temperature and humidity should be mapped
			const tempExpose = preview.exposes.find((e) => e.exposeName === 'temperature');
			expect(tempExpose).toBeDefined();
			expect(tempExpose?.status).toBe('mapped');

			const humidityExpose = preview.exposes.find((e) => e.exposeName === 'humidity');
			expect(humidityExpose).toBeDefined();
			expect(humidityExpose?.status).toBe('mapped');

			// Battery should be mapped
			const batteryExpose = preview.exposes.find((e) => e.exposeName === 'battery');
			expect(batteryExpose).toBeDefined();
			expect(batteryExpose?.status).toBe('mapped');
		});

		it('should correctly assign device category based on exposes', async () => {
			// Light device -> LIGHTING
			const lightDevice = createLightDevice();
			zigbee2mqttService.getRegisteredDevices.mockReturnValue([lightDevice]);

			const lightPreview = await service.generatePreview('0x00158d00018255df');
			expect(lightPreview.suggestedDevice.category).toBe(DeviceCategory.LIGHTING);

			// Sensor device -> SENSOR
			const sensorDevice = createTemperatureSensorDevice();
			zigbee2mqttService.getRegisteredDevices.mockReturnValue([sensorDevice]);

			const sensorPreview = await service.generatePreview('0x00158d0001a2b3c4');
			expect(sensorPreview.suggestedDevice.category).toBe(DeviceCategory.SENSOR);
		});

		it('should include derived STATUS property for battery channel', async () => {
			const device = createTemperatureSensorDevice();
			zigbee2mqttService.getRegisteredDevices.mockReturnValue([device]);

			const preview = await service.generatePreview('0x00158d0001a2b3c4');

			// Find battery expose
			const batteryExpose = preview.exposes.find((e) => e.exposeName === 'battery');
			expect(batteryExpose).toBeDefined();
			expect(batteryExpose?.status).toBe('mapped');

			// Battery channel requires both PERCENTAGE and STATUS properties
			// The YAML-defined derived_properties should provide STATUS derived from PERCENTAGE
			const allBatteryProps = batteryExpose?.suggestedProperties ?? [];
			const percentageProp = allBatteryProps.find((p) => p.category === PropertyCategory.PERCENTAGE);
			expect(percentageProp).toBeDefined();

			// STATUS is provided either as a YAML-derived property or as a virtual property
			// In either case, the battery expose should have no missing required properties
			expect(batteryExpose?.missingRequiredProperties).toEqual([]);
		});

		it('should generate warnings for unmapped exposes', async () => {
			const device: Z2mRegisteredDevice = {
				ieeeAddress: '0x00158d0001f2e3d4',
				friendlyName: 'unknown-device',
				type: 'EndDevice',
				supported: true,
				disabled: false,
				available: true,
				currentState: {},
				definition: {
					model: 'UNKNOWN_MODEL',
					vendor: 'Unknown',
					description: 'Unknown device',
					exposes: [
						{
							type: 'numeric',
							name: 'temperature',
							property: 'temperature',
							access: 1,
							unit: '°C',
						} as Z2mExposeNumeric,
						{
							type: 'text',
							name: 'some_unknown_property',
							property: 'some_unknown_property',
							access: 1,
						} as unknown as Z2mExposeNumeric,
					],
				},
			};

			zigbee2mqttService.getRegisteredDevices.mockReturnValue([device]);

			const preview = await service.generatePreview('0x00158d0001f2e3d4');

			// The unknown expose should produce a warning
			const unmappedWarnings = preview.warnings.filter((w) => w.type === 'unsupported_expose');
			const unknownWarning = unmappedWarnings.find((w) => w.exposeName === 'some_unknown_property');
			expect(unknownWarning).toBeDefined();
			expect(unknownWarning?.message).toContain('some_unknown_property');
		});

		it('should set readyToAdopt to true when at least one expose is mapped', async () => {
			const device = createLightDevice();
			zigbee2mqttService.getRegisteredDevices.mockReturnValue([device]);

			const preview = await service.generatePreview('0x00158d00018255df');

			expect(preview.readyToAdopt).toBe(true);
		});

		it('should set readyToAdopt to false when no exposes are mapped', async () => {
			const device: Z2mRegisteredDevice = {
				ieeeAddress: '0x00158d0001aabbcc',
				friendlyName: 'unmappable-device',
				type: 'EndDevice',
				supported: true,
				disabled: false,
				available: true,
				currentState: {},
				definition: {
					model: 'UNMAPPABLE',
					vendor: 'Unknown',
					description: 'Device with no mappable exposes',
					exposes: [
						{
							type: 'text',
							name: 'unknown_text',
							property: 'unknown_text',
							access: 1,
						} as unknown as Z2mExposeNumeric,
					],
				},
			};

			zigbee2mqttService.getRegisteredDevices.mockReturnValue([device]);

			const preview = await service.generatePreview('0x00158d0001aabbcc');

			expect(preview.readyToAdopt).toBe(false);
		});

		it('should not generate warnings for config/diagnostic properties', async () => {
			const device: Z2mRegisteredDevice = {
				ieeeAddress: '0x00158d0001d4e5f6',
				friendlyName: 'sensor-with-config',
				type: 'EndDevice',
				supported: true,
				disabled: false,
				available: true,
				currentState: {},
				definition: {
					model: 'SENSOR_MODEL',
					vendor: 'TestVendor',
					description: 'Sensor with config exposes',
					exposes: [
						{
							type: 'numeric',
							name: 'temperature',
							property: 'temperature',
							access: 1,
							unit: '°C',
						} as Z2mExposeNumeric,
						{
							type: 'numeric',
							name: 'temperature_calibration',
							property: 'temperature_calibration',
							access: 7,
							category: 'config',
						} as Z2mExposeNumeric,
						{
							type: 'numeric',
							name: 'sensitivity',
							property: 'sensitivity',
							access: 7,
							category: 'config',
							value_min: 0,
							value_max: 100,
						} as Z2mExposeNumeric,
					],
				},
			};

			zigbee2mqttService.getRegisteredDevices.mockReturnValue([device]);

			const preview = await service.generatePreview('0x00158d0001d4e5f6');

			// Config/diagnostic properties should not produce unsupported_expose warnings
			const unsupportedWarnings = preview.warnings.filter((w) => w.type === 'unsupported_expose');
			const calibrationWarning = unsupportedWarnings.find((w) => w.exposeName === 'temperature_calibration');
			const sensitivityWarning = unsupportedWarnings.find((w) => w.exposeName === 'sensitivity');

			expect(calibrationWarning).toBeUndefined();
			expect(sensitivityWarning).toBeUndefined();
		});

		it('should format friendlyName as device name when no description is provided', async () => {
			const device = createLightDevice();
			zigbee2mqttService.getRegisteredDevices.mockReturnValue([device]);

			const preview = await service.generatePreview('0x00158d00018255df');

			// 'living-room-light' should be formatted to 'Living Room Light'
			expect(preview.suggestedDevice.name).toBe('Living Room Light');
		});

		it('should use device description as name when available', async () => {
			const device = createLightDevice();
			device.description = 'My Custom Light Name';
			zigbee2mqttService.getRegisteredDevices.mockReturnValue([device]);

			const preview = await service.generatePreview('0x00158d00018255df');

			expect(preview.suggestedDevice.name).toBe('My Custom Light Name');
		});

		it('should hide linkquality from expose previews', async () => {
			const device = createLightDevice();
			zigbee2mqttService.getRegisteredDevices.mockReturnValue([device]);

			const preview = await service.generatePreview('0x00158d00018255df');

			const linkqualityExpose = preview.exposes.find((e) => e.exposeName === 'linkquality');
			expect(linkqualityExpose).toBeUndefined();
		});

		it('should merge currentState from device and cached state', async () => {
			const device = createLightDevice();
			device.currentState = { state: 'ON' };
			zigbee2mqttService.getRegisteredDevices.mockReturnValue([device]);
			zigbee2mqttService.getCachedState.mockReturnValue({ brightness: 150 });

			const preview = await service.generatePreview('0x00158d00018255df');

			// Both state and brightness should have current values
			const stateExpose = preview.exposes.find((e) => e.exposeName === 'state');
			const brightnessExpose = preview.exposes.find((e) => e.exposeName === 'brightness');

			// State comes from device currentState
			const stateProp = stateExpose?.suggestedProperties.find((p) => p.z2mProperty === 'state');
			expect(stateProp?.currentValue).toBe('ON');

			// Brightness comes from cached state
			const brightnessProp = brightnessExpose?.suggestedProperties.find((p) => p.z2mProperty === 'brightness');
			expect(brightnessProp?.currentValue).toBeDefined();
		});

		it('should generate warning when device is offline', async () => {
			const device = createLightDevice();
			device.available = false;
			zigbee2mqttService.getRegisteredDevices.mockReturnValue([device]);

			const preview = await service.generatePreview('0x00158d00018255df');

			const offlineWarning = preview.warnings.find((w) => w.type === 'device_not_available');
			expect(offlineWarning).toBeDefined();
			expect(offlineWarning?.message).toContain('offline');
		});
	});
});
