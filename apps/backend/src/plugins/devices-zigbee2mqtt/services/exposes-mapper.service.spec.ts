import { Test, TestingModule } from '@nestjs/testing';

import {
	ChannelCategory,
	DataTypeType,
	PermissionType,
	PropertyCategory,
} from '../../../modules/devices/devices.constants';
import { Z2mExposeBinary, Z2mExposeNumeric, Z2mExposeSpecific } from '../interfaces/zigbee2mqtt.interface';

import { Z2mExposesMapperService } from './exposes-mapper.service';

describe('Z2mExposesMapperService', () => {
	let service: Z2mExposesMapperService;

	beforeEach(async () => {
		const module: TestingModule = await Test.createTestingModule({
			providers: [Z2mExposesMapperService],
		}).compile();

		service = module.get<Z2mExposesMapperService>(Z2mExposesMapperService);
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
			expect(result[0].properties).toHaveLength(2);

			// Check state property - identifier is 'on' (from PropertyCategory.ON), z2mProperty is 'state'
			const stateProperty = result[0].properties.find((p) => p.z2mProperty === 'state');
			expect(stateProperty).toBeDefined();
			expect(stateProperty?.identifier).toBe('on');
			expect(stateProperty?.dataType).toBe(DataTypeType.BOOL);
			expect(stateProperty?.category).toBe(PropertyCategory.ON);
			expect(stateProperty?.permissions).toContain(PermissionType.READ_WRITE);

			// Check brightness property - identifier is 'brightness' (from PropertyCategory.BRIGHTNESS)
			const brightnessProperty = result[0].properties.find((p) => p.z2mProperty === 'brightness');
			expect(brightnessProperty).toBeDefined();
			expect(brightnessProperty?.identifier).toBe('brightness');
			expect(brightnessProperty?.dataType).toBe(DataTypeType.UCHAR);
			expect(brightnessProperty?.category).toBe(PropertyCategory.BRIGHTNESS);
			expect(brightnessProperty?.min).toBe(0);
			expect(brightnessProperty?.max).toBe(100);
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
			expect(result[0].identifier).toBe('switch');
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
			expect(result[0].identifier).toBe(ChannelCategory.TEMPERATURE);

			// Property identifier comes from category, z2mProperty is 'temperature'
			const tempProperty = result[0].properties.find((p) => p.z2mProperty === 'temperature');
			expect(tempProperty).toBeDefined();
			expect(tempProperty?.identifier).toBe('temperature');
			expect(tempProperty?.category).toBe(PropertyCategory.TEMPERATURE);
			expect(tempProperty?.unit).toBe('°C');
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

			// Property identifier is 'detected' (from PropertyCategory.DETECTED), z2mProperty is 'occupancy'
			const occupancyProperty = result[0].properties.find((p) => p.z2mProperty === 'occupancy');
			expect(occupancyProperty).toBeDefined();
			expect(occupancyProperty?.identifier).toBe('detected');
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

			// Battery maps to: identifier='percentage', z2mProperty='battery', category=PERCENTAGE
			const batteryProperty = result[0].properties.find((p) => p.z2mProperty === 'battery');
			expect(batteryProperty).toBeDefined();
			expect(batteryProperty?.identifier).toBe('percentage');
			expect(batteryProperty?.category).toBe(PropertyCategory.PERCENTAGE);
			expect(batteryProperty?.unit).toBe('%');
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
							property: 'state_l1',
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
			expect(result).toHaveLength(1);
			const voltageProperty = result[0].properties.find((p) => p.z2mProperty === 'voltage');
			expect(voltageProperty).toBeDefined();
			expect(voltageProperty?.category).toBe(PropertyCategory.VOLTAGE);
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
			expect(result[0].identifier).toBe('climate');
			expect(result[0].category).toBe(ChannelCategory.THERMOSTAT);
			expect(result[0].properties).toHaveLength(2);
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

			// Each expose maps to its own channel with category-based identifier
			expect(result).toHaveLength(2);
			expect(result[0].identifier).toBe(ChannelCategory.TEMPERATURE);
			expect(result[0].category).toBe(ChannelCategory.TEMPERATURE);
			expect(result[1].identifier).toBe(ChannelCategory.HUMIDITY);
			expect(result[1].category).toBe(ChannelCategory.HUMIDITY);
		});
	});
});
