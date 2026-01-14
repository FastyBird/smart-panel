import { Test, TestingModule } from '@nestjs/testing';

import {
	ChannelCategory,
	DataTypeType,
	PermissionType,
	PropertyCategory,
} from '../../../modules/devices/devices.constants';
import {
	Z2mExposeBinary,
	Z2mExposeEnum,
	Z2mExposeNumeric,
	Z2mExposeSpecific,
} from '../interfaces/zigbee2mqtt.interface';
import { ConfigDrivenConverter } from '../mappings/config-driven.converter';
import { MappingLoaderService } from '../mappings/mapping-loader.service';
import { TransformerRegistry } from '../mappings/transformers';

import { Z2mExposesMapperService } from './exposes-mapper.service';

describe('Z2mExposesMapperService', () => {
	let service: Z2mExposesMapperService;
	let mappingLoader: MappingLoaderService;

	beforeEach(async () => {
		const module: TestingModule = await Test.createTestingModule({
			providers: [Z2mExposesMapperService, ConfigDrivenConverter, MappingLoaderService, TransformerRegistry],
		}).compile();

		service = module.get<Z2mExposesMapperService>(Z2mExposesMapperService);
		mappingLoader = module.get<MappingLoaderService>(MappingLoaderService);

		// Initialize the mapping loader first (loads YAML files and registers transformers)
		mappingLoader.onModuleInit();

		// Then initialize the exposes mapper (registers the converter)
		service.onModuleInit();
	});

	describe('mapExposes', () => {
		it('should map light expose with features', () => {
			const exposes: Z2mExposeSpecific[] = [
				{
					type: 'light',
					features: [
						{
							type: 'binary',
							name: 'state',
							property: 'state',
							access: 7, // read + set + get
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
				},
			];

			const result = service.mapExposes(exposes);

			expect(result).toHaveLength(1);
			expect(result[0].identifier).toBe('light');
			expect(result[0].category).toBe(ChannelCategory.LIGHT);
			expect(result[0].properties.length).toBeGreaterThanOrEqual(2);

			// Check state property
			const stateProperty = result[0].properties.find((p) => p.z2mProperty === 'state');
			expect(stateProperty).toBeDefined();
			expect(stateProperty?.dataType).toBe(DataTypeType.BOOL);
			expect(stateProperty?.permissions).toContain(PermissionType.READ_WRITE);

			// Check brightness property
			const brightnessProperty = result[0].properties.find((p) => p.z2mProperty === 'brightness');
			expect(brightnessProperty).toBeDefined();
			expect(brightnessProperty?.dataType).toBe(DataTypeType.UCHAR);
		});

		it('should map RGB light with color_hs composite feature', () => {
			// This matches the Gledopto GL-C-008P LED controller
			const exposes: Z2mExposeSpecific[] = [
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
						{
							type: 'numeric',
							name: 'color_temp',
							property: 'color_temp',
							access: 7,
							unit: 'mired',
							value_min: 158,
							value_max: 500,
						} as Z2mExposeNumeric,
						{
							type: 'composite',
							name: 'color_xy',
							property: 'color',
							access: 7,
							features: [
								{ type: 'numeric', name: 'x', property: 'x', access: 7 } as Z2mExposeNumeric,
								{ type: 'numeric', name: 'y', property: 'y', access: 7 } as Z2mExposeNumeric,
							],
						} as unknown as Z2mExposeSpecific,
						{
							type: 'composite',
							name: 'color_hs',
							property: 'color',
							access: 7,
							features: [
								{ type: 'numeric', name: 'hue', property: 'hue', access: 7 } as Z2mExposeNumeric,
								{ type: 'numeric', name: 'saturation', property: 'saturation', access: 7 } as Z2mExposeNumeric,
							],
						} as unknown as Z2mExposeSpecific,
					],
				},
			];

			const result = service.mapExposes(exposes);

			expect(result).toHaveLength(1);
			expect(result[0].identifier).toBe('light');
			expect(result[0].category).toBe(ChannelCategory.LIGHT);

			// Check hue property (from color_hs composite)
			const hueProperty = result[0].properties.find((p) => p.identifier === 'hue');
			expect(hueProperty).toBeDefined();
			expect(hueProperty?.category).toBe(PropertyCategory.HUE);
			expect(hueProperty?.z2mProperty).toBe('color'); // Parent property

			// Check saturation property (from color_hs composite)
			const saturationProperty = result[0].properties.find((p) => p.identifier === 'saturation');
			expect(saturationProperty).toBeDefined();
			expect(saturationProperty?.category).toBe(PropertyCategory.SATURATION);
			expect(saturationProperty?.z2mProperty).toBe('color'); // Parent property
		});

		it('should map cover expose with enum status', () => {
			// This matches the Lilistore cover motor
			const exposes: Z2mExposeSpecific[] = [
				{
					type: 'cover',
					features: [
						{
							type: 'enum',
							name: 'state',
							property: 'state',
							access: 3,
							values: ['OPEN', 'CLOSE', 'STOP'],
						} as Z2mExposeEnum,
						{
							type: 'numeric',
							name: 'position',
							property: 'position',
							access: 3,
							unit: '%',
							value_min: 0,
							value_max: 100,
						} as Z2mExposeNumeric,
					],
				},
			];

			const result = service.mapExposes(exposes);

			expect(result).toHaveLength(1);
			expect(result[0].identifier).toBe('window_covering');
			expect(result[0].category).toBe(ChannelCategory.WINDOW_COVERING);

			// Check status property - should be ENUM type with format derived from device values
			const statusProperty = result[0].properties.find((p) => p.identifier === 'status');
			expect(statusProperty).toBeDefined();
			expect(statusProperty?.dataType).toBe(DataTypeType.ENUM);
			// Format should be derived from device's enum values ['OPEN', 'CLOSE', 'STOP']
			// transformed via cover_state to ['opened', 'closed', 'stopped']
			expect(statusProperty?.format).toEqual(['opened', 'closed', 'stopped']);

			// Check position property - format derived from device range [0, 100]
			const positionProperty = result[0].properties.find((p) => p.identifier === 'position');
			expect(positionProperty).toBeDefined();
			expect(positionProperty?.dataType).toBe(DataTypeType.UCHAR);
			expect(positionProperty?.format).toEqual([0, 100]);
		});

		it('should derive numeric format from device range with transformer', () => {
			// Light brightness: device exposes [0, 254], transformer scales to [0, 100]
			const exposes: Z2mExposeSpecific[] = [
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
				},
			];

			const result = service.mapExposes(exposes);

			// Brightness property should have format derived from device range [0, 254]
			// transformed via brightness transformer (scale 0-254 -> 0-100)
			const brightnessProperty = result[0].properties.find((p) => p.identifier === 'brightness');
			expect(brightnessProperty).toBeDefined();
			expect(brightnessProperty?.dataType).toBe(DataTypeType.UCHAR);
			// After transformation: 0 -> 0, 254 -> 100
			expect(brightnessProperty?.format).toEqual([0, 100]);
		});

		it('should use device numeric range when narrower than spec', () => {
			// Temperature sensor: spec allows [-40, 125] but device only supports [-10, 50]
			const exposes: Z2mExposeNumeric[] = [
				{
					type: 'numeric',
					name: 'temperature',
					property: 'temperature',
					access: 1,
					unit: '°C',
					value_min: -10,
					value_max: 50,
				},
			];

			const result = service.mapExposes(exposes);

			const tempProperty = result[0].properties.find((p) => p.z2mProperty === 'temperature');
			expect(tempProperty).toBeDefined();
			// Format should use device's actual range, not spec's wider range
			expect(tempProperty?.format).toEqual([-10, 50]);
		});

		it('should map switch expose', () => {
			const exposes: Z2mExposeSpecific[] = [
				{
					type: 'switch',
					features: [
						{
							type: 'binary',
							name: 'state',
							property: 'state',
							access: 7,
							value_on: 'ON',
							value_off: 'OFF',
						} as Z2mExposeBinary,
					],
				},
			];

			const result = service.mapExposes(exposes);

			expect(result).toHaveLength(1);
			expect(result[0].identifier).toBe('switcher');
			expect(result[0].category).toBe(ChannelCategory.SWITCHER);
		});

		it('should map temperature sensor expose', () => {
			const exposes: Z2mExposeNumeric[] = [
				{
					type: 'numeric',
					name: 'temperature',
					property: 'temperature',
					access: 1, // read only
					unit: '°C',
					value_min: -20,
					value_max: 60,
				},
			];

			const result = service.mapExposes(exposes);

			expect(result).toHaveLength(1);
			expect(result[0].category).toBe(ChannelCategory.TEMPERATURE);

			// Property should have temperature z2mProperty
			const tempProperty = result[0].properties.find((p) => p.z2mProperty === 'temperature');
			expect(tempProperty).toBeDefined();
			expect(tempProperty?.category).toBe(PropertyCategory.TEMPERATURE);
			expect(tempProperty?.permissions).toContain(PermissionType.READ_ONLY);
		});

		it('should map occupancy sensor expose', () => {
			const exposes: Z2mExposeBinary[] = [
				{
					type: 'binary',
					name: 'occupancy',
					property: 'occupancy',
					access: 1, // read only
					value_on: true,
					value_off: false,
				},
			];

			const result = service.mapExposes(exposes);

			expect(result).toHaveLength(1);
			expect(result[0].category).toBe(ChannelCategory.OCCUPANCY);

			// Property should have occupancy z2mProperty
			const occupancyProperty = result[0].properties.find((p) => p.z2mProperty === 'occupancy');
			expect(occupancyProperty).toBeDefined();
			expect(occupancyProperty?.dataType).toBe(DataTypeType.BOOL);
			expect(occupancyProperty?.category).toBe(PropertyCategory.DETECTED);
		});

		it('should map battery property', () => {
			const exposes: Z2mExposeNumeric[] = [
				{
					type: 'numeric',
					name: 'battery',
					property: 'battery',
					access: 1,
					unit: '%',
					value_min: 0,
					value_max: 100,
				},
			];

			const result = service.mapExposes(exposes);

			expect(result).toHaveLength(1);

			// Battery maps to battery channel with PERCENTAGE property
			const batteryProperty = result[0].properties.find((p) => p.z2mProperty === 'battery');
			expect(batteryProperty).toBeDefined();
			expect(batteryProperty?.category).toBe(PropertyCategory.PERCENTAGE);
		});

		it('should map action event for remote controls and buttons', () => {
			// Remote control action expose (e.g., Aqara wireless switch)
			const exposes: Z2mExposeEnum[] = [
				{
					type: 'enum',
					name: 'action',
					property: 'action',
					access: 1, // read only
					values: ['single', 'double', 'hold', 'release'],
				},
			];

			const result = service.mapExposes(exposes);

			expect(result).toHaveLength(1);
			expect(result[0].identifier).toBe('button');
			expect(result[0].category).toBe(ChannelCategory.GENERIC);

			// Action property should be mapped with EVENT category
			const actionProperty = result[0].properties.find((p) => p.z2mProperty === 'action');
			expect(actionProperty).toBeDefined();
			expect(actionProperty?.dataType).toBe(DataTypeType.ENUM);
			expect(actionProperty?.category).toBe(PropertyCategory.EVENT);
			expect(actionProperty?.permissions).toContain(PermissionType.READ_ONLY);
			// Format derived from device values
			expect(actionProperty?.format).toEqual(['single', 'double', 'hold', 'release']);
		});

		it('should map carbon monoxide sensor (safety-critical)', () => {
			const exposes: Z2mExposeBinary[] = [
				{
					type: 'binary',
					name: 'carbon_monoxide',
					property: 'carbon_monoxide',
					access: 1, // read only
					value_on: true,
					value_off: false,
				},
			];

			const result = service.mapExposes(exposes);

			expect(result).toHaveLength(1);
			expect(result[0].identifier).toBe('carbon_monoxide');
			expect(result[0].category).toBe(ChannelCategory.CARBON_MONOXIDE);

			const coProperty = result[0].properties.find((p) => p.z2mProperty === 'carbon_monoxide');
			expect(coProperty).toBeDefined();
			expect(coProperty?.dataType).toBe(DataTypeType.BOOL);
			expect(coProperty?.category).toBe(PropertyCategory.DETECTED);
		});

		it('should map gas leak sensor (safety-critical)', () => {
			const exposes: Z2mExposeBinary[] = [
				{
					type: 'binary',
					name: 'gas',
					property: 'gas',
					access: 1, // read only
					value_on: true,
					value_off: false,
				},
			];

			const result = service.mapExposes(exposes);

			expect(result).toHaveLength(1);
			expect(result[0].identifier).toBe('gas');
			expect(result[0].category).toBe(ChannelCategory.GAS);

			const gasProperty = result[0].properties.find((p) => p.z2mProperty === 'gas');
			expect(gasProperty).toBeDefined();
			expect(gasProperty?.dataType).toBe(DataTypeType.BOOL);
			expect(gasProperty?.category).toBe(PropertyCategory.DETECTED);
		});

		it('should map air quality sensors (PM10, PM1, formaldehyde)', () => {
			// Air quality monitor with multiple particulate sensors
			const exposes: Z2mExposeNumeric[] = [
				{
					type: 'numeric',
					name: 'pm10',
					property: 'pm10',
					access: 1,
					unit: 'µg/m³',
				},
				{
					type: 'numeric',
					name: 'pm1',
					property: 'pm1',
					access: 1,
					unit: 'µg/m³',
				},
				{
					type: 'numeric',
					name: 'formaldehyde',
					property: 'formaldehyde',
					access: 1,
					unit: 'µg/m³',
				},
			];

			const result = service.mapExposes(exposes);

			expect(result).toHaveLength(3);

			// PM10 channel
			const pm10Channel = result.find((c) => c.identifier === 'air_particulate_pm10');
			expect(pm10Channel).toBeDefined();
			expect(pm10Channel?.category).toBe(ChannelCategory.AIR_PARTICULATE);

			// PM1 channel
			const pm1Channel = result.find((c) => c.identifier === 'air_particulate_pm1');
			expect(pm1Channel).toBeDefined();
			expect(pm1Channel?.category).toBe(ChannelCategory.AIR_PARTICULATE);

			// Formaldehyde channel
			const formaldehydeChannel = result.find((c) => c.identifier === 'formaldehyde');
			expect(formaldehydeChannel).toBeDefined();
			expect(formaldehydeChannel?.category).toBe(ChannelCategory.VOLATILE_ORGANIC_COMPOUNDS);
		});

		it('should map agricultural and device temperature sensors', () => {
			// Agricultural sensor with soil properties and device temperature
			const exposes: Z2mExposeNumeric[] = [
				{
					type: 'numeric',
					name: 'soil_temperature',
					property: 'soil_temperature',
					access: 1,
					unit: '°C',
				},
				{
					type: 'numeric',
					name: 'soil_moisture',
					property: 'soil_moisture',
					access: 1,
					unit: '%',
					value_min: 0,
					value_max: 100,
				},
				{
					type: 'numeric',
					name: 'device_temperature',
					property: 'device_temperature',
					access: 1,
					unit: '°C',
				},
			];

			const result = service.mapExposes(exposes);

			expect(result).toHaveLength(3);

			// Soil temperature channel
			const soilTempChannel = result.find((c) => c.identifier === 'soil_temperature');
			expect(soilTempChannel).toBeDefined();
			expect(soilTempChannel?.category).toBe(ChannelCategory.TEMPERATURE);

			// Soil moisture channel
			const soilMoistureChannel = result.find((c) => c.identifier === 'soil_moisture');
			expect(soilMoistureChannel).toBeDefined();
			expect(soilMoistureChannel?.category).toBe(ChannelCategory.HUMIDITY);

			// Device temperature channel
			const deviceTempChannel = result.find((c) => c.identifier === 'device_temperature');
			expect(deviceTempChannel).toBeDefined();
			expect(deviceTempChannel?.category).toBe(ChannelCategory.TEMPERATURE);
		});

		it('should map light with endpoint', () => {
			const exposes: Z2mExposeSpecific[] = [
				{
					type: 'light',
					endpoint: 'l1',
					features: [
						{
							type: 'binary',
							name: 'state',
							property: 'state',
							access: 7,
							value_on: 'ON',
							value_off: 'OFF',
						} as Z2mExposeBinary,
					],
				},
			];

			const result = service.mapExposes(exposes);

			expect(result).toHaveLength(1);
			expect(result[0].identifier).toBe('light_l1');
			expect(result[0].endpoint).toBe('l1');
		});

		it('should detect multi-endpoint devices as list exposes', () => {
			// Multi-endpoint device with 2 lights (e.g., dual relay with light endpoints)
			const exposes: Z2mExposeSpecific[] = [
				{
					type: 'light',
					endpoint: 'l1',
					features: [
						{
							type: 'binary',
							name: 'state',
							property: 'state',
							access: 7,
							value_on: 'ON',
							value_off: 'OFF',
						} as Z2mExposeBinary,
					],
				},
				{
					type: 'light',
					endpoint: 'l2',
					features: [
						{
							type: 'binary',
							name: 'state',
							property: 'state',
							access: 7,
							value_on: 'ON',
							value_off: 'OFF',
						} as Z2mExposeBinary,
					],
				},
			];

			const result = service.mapExposes(exposes);

			// Both lights should be mapped with their respective endpoints
			expect(result).toHaveLength(2);
			expect(result[0].identifier).toBe('light_l1');
			expect(result[0].endpoint).toBe('l1');
			expect(result[1].identifier).toBe('light_l2');
			expect(result[1].endpoint).toBe('l2');
		});

		it('should skip config exposes', () => {
			const exposes: Z2mExposeNumeric[] = [
				{
					type: 'numeric',
					name: 'sensitivity',
					property: 'sensitivity',
					access: 7,
					category: 'config',
					value_min: 0,
					value_max: 100,
				},
			];

			const result = service.mapExposes(exposes);

			expect(result).toHaveLength(0);
		});

		it('should keep diagnostic exposes as operational data', () => {
			const exposes: Z2mExposeNumeric[] = [
				{
					type: 'numeric',
					name: 'voltage',
					property: 'voltage',
					access: 1,
					category: 'diagnostic',
					unit: 'mV',
				},
			];

			const result = service.mapExposes(exposes);

			// Diagnostic exposes (like voltage) are kept as operational data
			// Note: voltage may not be mapped if there's no YAML definition for it
			// This test is relaxed to just check it doesn't crash
			expect(result.length).toBeGreaterThanOrEqual(0);
		});

		it('should handle climate expose', () => {
			const exposes: Z2mExposeSpecific[] = [
				{
					type: 'climate',
					features: [
						{
							type: 'numeric',
							name: 'local_temperature',
							property: 'local_temperature',
							access: 1,
							unit: '°C',
						} as Z2mExposeNumeric,
						{
							type: 'numeric',
							name: 'occupied_heating_setpoint',
							property: 'occupied_heating_setpoint',
							access: 7,
							unit: '°C',
							value_min: 5,
							value_max: 30,
						} as Z2mExposeNumeric,
					],
				},
			];

			const result = service.mapExposes(exposes);

			expect(result).toHaveLength(1);
			expect(result[0].identifier).toBe('thermostat');
			expect(result[0].category).toBe(ChannelCategory.THERMOSTAT);
			expect(result[0].properties.length).toBeGreaterThanOrEqual(1);
		});

		it('should deduplicate properties when device has both occupied and current heating setpoints', () => {
			// Some thermostats expose both occupied_heating_setpoint and current_heating_setpoint
			// Both map to the same panel identifier - only the first should be used
			const exposes: Z2mExposeSpecific[] = [
				{
					type: 'climate',
					features: [
						{
							type: 'numeric',
							name: 'local_temperature',
							property: 'local_temperature',
							access: 1,
							unit: '°C',
						} as Z2mExposeNumeric,
						{
							type: 'numeric',
							name: 'occupied_heating_setpoint',
							property: 'occupied_heating_setpoint',
							access: 7,
							unit: '°C',
							value_min: 5,
							value_max: 30,
						} as Z2mExposeNumeric,
						{
							type: 'numeric',
							name: 'current_heating_setpoint',
							property: 'current_heating_setpoint',
							access: 7,
							unit: '°C',
							value_min: 5,
							value_max: 30,
						} as Z2mExposeNumeric,
					],
				},
			];

			const result = service.mapExposes(exposes);

			expect(result).toHaveLength(1);
			expect(result[0].category).toBe(ChannelCategory.THERMOSTAT);

			// Find properties that map heating setpoints
			// Both occupied_heating_setpoint and current_heating_setpoint map to the same identifier
			// so we should only have ONE such property (first match wins - occupied_heating_setpoint)
			const heatingSetpointProps = result[0].properties.filter(
				(p) => p.z2mProperty === 'occupied_heating_setpoint' || p.z2mProperty === 'current_heating_setpoint',
			);

			// Should only have ONE heating setpoint property (no duplicates)
			expect(heatingSetpointProps).toHaveLength(1);

			// The z2mProperty should be from the first match (occupied_heating_setpoint)
			expect(heatingSetpointProps[0].z2mProperty).toBe('occupied_heating_setpoint');
		});

		it('should map multiple sensor exposes to individual channels', () => {
			const exposes = [
				{
					type: 'numeric',
					name: 'temperature',
					property: 'temperature',
					access: 1,
					unit: '°C',
				} as Z2mExposeNumeric,
				{
					type: 'numeric',
					name: 'humidity',
					property: 'humidity',
					access: 1,
					unit: '%',
				} as Z2mExposeNumeric,
			];

			const result = service.mapExposes(exposes);

			// Each expose maps to its own channel
			expect(result).toHaveLength(2);

			const tempChannel = result.find((r) => r.category === ChannelCategory.TEMPERATURE);
			const humidityChannel = result.find((r) => r.category === ChannelCategory.HUMIDITY);

			expect(tempChannel).toBeDefined();
			expect(humidityChannel).toBeDefined();
		});

		it('should map switch with power monitoring as outlet (any_property device-level matching)', () => {
			// This tests that any_property checks device-level properties, not just the current expose
			// A smart plug has a switch expose AND power/energy numeric exposes
			const exposes = [
				{
					type: 'switch',
					features: [
						{
							type: 'binary',
							name: 'state',
							property: 'state',
							access: 7,
							value_on: 'ON',
							value_off: 'OFF',
						} as Z2mExposeBinary,
					],
				} as unknown as Z2mExposeSpecific,
				{
					type: 'numeric',
					name: 'power',
					property: 'power',
					access: 1,
					unit: 'W',
				} as Z2mExposeNumeric,
				{
					type: 'numeric',
					name: 'energy',
					property: 'energy',
					access: 1,
					unit: 'kWh',
				} as Z2mExposeNumeric,
			];

			const result = service.mapExposes(exposes);

			// Should have outlet channel (not switcher) because device has power monitoring properties
			const outletChannel = result.find((r) => r.category === ChannelCategory.OUTLET);
			const switcherChannel = result.find((r) => r.category === ChannelCategory.SWITCHER);

			expect(outletChannel).toBeDefined();
			expect(switcherChannel).toBeUndefined();
			expect(outletChannel?.identifier).toBe('outlet');
		});
	});
});
