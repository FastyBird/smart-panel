import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { DeviceCategory } from '../../../modules/devices/devices.constants';
import { HomeyCapabilityType, HomeyCapabilityValue, createHomeyCapability } from '../models/homey-capability.model';
import { HomeyDevice } from '../models/homey-device.model';

import { HomeyMappingLoaderService } from './mapping-loader.service';
import { HomeyMappingTransformerService } from './mapping-transformer.service';
import { ResolvedHomeyPropertyBinding } from './mapping.types';

const EXPECTED_FIXTURE_ROOT = resolve(__dirname, '../__fixtures__/expected/v1/devices');

const readDeviceFixture = (name: string): HomeyDevice =>
	JSON.parse(readFileSync(resolve(EXPECTED_FIXTURE_ROOT, `${name}.json`), 'utf8')) as HomeyDevice;

const capability = (
	id: string,
	value: HomeyCapabilityValue,
	options: { writable?: boolean; unit?: string; minimum?: number; maximum?: number } = {},
) =>
	createHomeyCapability({
		id,
		title: id,
		value,
		type:
			typeof value === 'boolean'
				? HomeyCapabilityType.BOOLEAN
				: typeof value === 'number'
					? HomeyCapabilityType.NUMBER
					: HomeyCapabilityType.ENUM,
		unit: options.unit ?? null,
		minimum: options.minimum ?? null,
		maximum: options.maximum ?? null,
		step: null,
		enumValues: [],
		readable: true,
		writable: options.writable ?? false,
		available: true,
		lastUpdatedAt: null,
	});

const publishedContractDevice = (deviceClass: string, capabilities: HomeyDevice['capabilities']): HomeyDevice => ({
	id: `published-${deviceClass}`,
	name: `Published ${deviceClass} contract`,
	class: deviceClass,
	zoneId: null,
	zoneName: null,
	zonePath: [],
	available: true,
	availabilityMessage: null,
	driverId: null,
	manufacturer: null,
	model: null,
	energy: null,
	capabilities,
});

describe('Homey MVP mapping catalog', () => {
	const loader = new HomeyMappingLoaderService();
	const transformer = new HomeyMappingTransformerService();

	const bindingsByName = (device: HomeyDevice): Map<string, ResolvedHomeyPropertyBinding> => {
		const resolution = loader.resolvePropertyMappings(device);
		expect(resolution.conflicts).toStrictEqual([]);

		return new Map(resolution.mappings.map((binding) => [binding.mapping.name, binding]));
	};

	const read = (bindings: Map<string, ResolvedHomeyPropertyBinding>, name: string, value: HomeyCapabilityValue) => {
		const binding = bindings.get(name);
		expect(binding).toBeDefined();

		return transformer.read(binding.mapping, value);
	};

	const write = (bindings: Map<string, ResolvedHomeyPropertyBinding>, name: string, value: HomeyCapabilityValue) => {
		const binding = bindings.get(name);
		expect(binding).toBeDefined();

		return transformer.write(binding.mapping, value);
	};

	beforeAll(() => {
		loader.loadAllMappings();
	});

	it('loads the complete built-in catalog without ambiguity', () => {
		expect(loader.getDeviceMappings()).toHaveLength(7);
		expect(loader.getChannelMappings()).toHaveLength(19);
		expect(loader.getPropertyMappings()).toHaveLength(28);
	});

	it('maps the captured light fixture and applies inverse lighting transformations', () => {
		const device = readDeviceFixture('light');
		const bindings = bindingsByName(device);

		expect(loader.resolveDeviceMappings(device)).toMatchObject({
			conflicts: [],
			mappings: [expect.objectContaining({ deviceCategory: DeviceCategory.LIGHTING })],
		});
		expect(loader.resolveChannelMappings(device).mappings.map((mapping) => mapping.channel.identifier)).toStrictEqual([
			'light',
		]);
		expect(read(bindings, 'light-power', false)).toBe(false);
		expect(read(bindings, 'light-brightness', 0.24)).toBe(24);
		expect(write(bindings, 'light-brightness', 24)).toBe(0.24);
		expect(read(bindings, 'light-hue', 0.87)).toBe(313);
		expect(write(bindings, 'light-hue', 180)).toBe(0.5);
		expect(read(bindings, 'light-saturation', 0.95)).toBe(95);
		expect(write(bindings, 'light-saturation', 95)).toBe(0.95);
		expect(read(bindings, 'light-color-temperature', 0.01)).toBe(6455);
		expect(write(bindings, 'light-color-temperature', 6455)).toBeCloseTo(0.01, 12);
	});

	it('maps captured outlet, energy, and repeated full capability IDs', () => {
		const outlet = readDeviceFixture('switch');
		const bindings = bindingsByName(outlet);

		expect(loader.resolveDeviceMappings(outlet).mappings[0]?.deviceCategory).toBe(DeviceCategory.OUTLET);
		expect(read(bindings, 'outlet-power', false)).toBe(false);
		expect(read(bindings, 'instantaneous-power', 0)).toBe(0);
		expect(read(bindings, 'accumulated-energy', 58.03)).toBe(58.03);

		const repeated = loader.resolvePropertyMappings(readDeviceFixture('repeated-capabilities'));
		const energyBindings = repeated.mappings.filter((binding) => binding.mapping.name === 'accumulated-energy');
		expect(energyBindings.map((binding) => binding.capabilityId)).toStrictEqual([
			'meter_power',
			'meter_power.capability-suffix-000007',
		]);
	});

	it('maps captured environmental and battery values', () => {
		const device = readDeviceFixture('sensor-air-quality');
		const bindings = bindingsByName(device);

		expect(loader.resolveDeviceMappings(device).mappings[0]?.deviceCategory).toBe(DeviceCategory.SENSOR);
		expect(read(bindings, 'battery-level', 100)).toBe(100);
		expect(read(bindings, 'humidity', 28.65)).toBe(29);
		expect(read(bindings, 'sensor-temperature', 30.6)).toBe(30.6);
		expect(read(bindings, 'illuminance', 1)).toBe(1);
	});

	it('maps the captured cover and preserves open, close, stop, and position semantics', () => {
		const device = readDeviceFixture('cover');
		const bindings = bindingsByName(device);

		expect(loader.resolveDeviceMappings(device).mappings[0]?.deviceCategory).toBe(DeviceCategory.WINDOW_COVERING);
		expect(read(bindings, 'window-covering-status', 'down')).toBe('closing');
		expect(write(bindings, 'window-covering-command', 'open')).toBe('up');
		expect(write(bindings, 'window-covering-command', 'close')).toBe('down');
		expect(write(bindings, 'window-covering-command', 'stop')).toBe('idle');
		expect(read(bindings, 'window-covering-position', 0)).toBe(0);
		expect(write(bindings, 'window-covering-position', 45)).toBe(0.45);
	});

	it('maps published thermostat modes and target temperature without claiming live fixture provenance', () => {
		const device = publishedContractDevice('thermostat', [
			capability('measure_temperature', 21.5, { unit: '°C' }),
			capability('target_temperature', 22.5, { unit: '°C', writable: true, minimum: 4, maximum: 35 }),
			capability('thermostat_mode', 'heat', { writable: true }),
		]);
		const bindings = bindingsByName(device);

		expect(loader.resolveDeviceMappings(device).mappings[0]?.deviceCategory).toBe(DeviceCategory.THERMOSTAT);
		expect(read(bindings, 'thermostat-current-temperature', 21.5)).toBe(21.5);
		expect(read(bindings, 'thermostat-target-temperature', 22.5)).toBe(22.5);
		expect(write(bindings, 'thermostat-target-temperature', 19.5)).toBe(19.5);
		expect(['auto', 'heat', 'cool', 'off']).toStrictEqual(
			['auto', 'heat', 'cool', 'off'].map((mode) => read(bindings, 'thermostat-mode', mode)),
		);
		expect(write(bindings, 'thermostat-mode', 'cool')).toBe('cool');
	});

	it('maps published environment and safety capability contracts', () => {
		const device = publishedContractDevice('sensor', [
			capability('measure_pressure', 1013, { unit: 'mbar' }),
			capability('measure_co2', 850, { unit: 'ppm' }),
			capability('alarm_motion', true),
			capability('alarm_contact', false),
			capability('alarm_smoke', true),
			capability('alarm_co', false),
			capability('alarm_battery', true),
		]);
		const bindings = bindingsByName(device);

		expect(read(bindings, 'pressure', 1013)).toBeCloseTo(101.3, 12);
		expect(read(bindings, 'carbon-dioxide', 850)).toBe(850);
		expect(read(bindings, 'motion', true)).toBe(true);
		expect(read(bindings, 'contact', false)).toBe(false);
		expect(read(bindings, 'smoke', true)).toBe(true);
		expect(read(bindings, 'carbon-monoxide', false)).toBe(false);
		expect(read(bindings, 'battery-alarm', true)).toBe('low');
	});

	it('maps published lock and tilt contracts with inverse control values', () => {
		const lock = publishedContractDevice('lock', [capability('locked', true, { writable: true })]);
		const lockBindings = bindingsByName(lock);
		expect(loader.resolveDeviceMappings(lock).mappings[0]?.deviceCategory).toBe(DeviceCategory.LOCK);
		expect(read(lockBindings, 'lock-state', true)).toBe(true);
		expect(write(lockBindings, 'lock-state', false)).toBe(false);

		const cover = publishedContractDevice('windowcoverings', [
			capability('windowcoverings_state', 'idle', { writable: true }),
			capability('windowcoverings_set', 0.5, { writable: true, minimum: 0, maximum: 1 }),
			capability('windowcoverings_tilt_set', 0.5, { writable: true, minimum: 0, maximum: 1 }),
		]);
		const coverBindings = bindingsByName(cover);
		expect(loader.resolveDeviceMappings(cover).mappings[0]?.deviceCategory).toBe(DeviceCategory.WINDOW_COVERING);
		expect(read(coverBindings, 'window-covering-tilt', 0.5)).toBe(0);
		expect(write(coverBindings, 'window-covering-tilt', 45)).toBe(0.75);
	});
});
