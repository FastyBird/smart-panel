import { describe, it, expect } from 'vitest';

import { useFriendlyNameHumanizer } from './useFriendlyNameHumanizer';

describe('useFriendlyNameHumanizer', () => {
	const { humanize } = useFriendlyNameHumanizer();

	it('humanizes snake_case', () => {
		expect(humanize('living_room_lamp')).toBe('Living Room Lamp');
	});

	it('humanizes kebab-case', () => {
		expect(humanize('kitchen-light-1')).toBe('Kitchen Light 1');
	});

	it('humanizes camelCase', () => {
		expect(humanize('frontDoorSensor')).toBe('Front Door Sensor');
	});

	it('humanizes single word', () => {
		expect(humanize('thermostat')).toBe('Thermostat');
	});

	it('preserves trailing numbers as separate tokens', () => {
		expect(humanize('sensor_3')).toBe('Sensor 3');
	});

	it('handles already-humanized names', () => {
		expect(humanize('Living Room Lamp')).toBe('Living Room Lamp');
	});

	it('returns empty string for empty input', () => {
		expect(humanize('')).toBe('');
	});
});
