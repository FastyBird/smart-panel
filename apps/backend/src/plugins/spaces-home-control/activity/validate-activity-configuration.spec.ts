import { ClimateMode, LightingMode } from '../spaces-home-control.constants';

import { ActivityMode } from './space-activity.constants';
import { defaultActivityConfiguration } from './space-activity.defaults';
import { validateActivityConfiguration } from './validate-activity-configuration';

describe('activity configuration validation', () => {
	it('accepts defaults and explicit operator numeric/preset selections', async () => {
		const config = defaultActivityConfiguration(ActivityMode.WORK);
		await expect(validateActivityConfiguration(config)).resolves.toBeDefined();
		config.climate = { enabled: true, mode: ClimateMode.HEAT, setpoint: 21 };
		await expect(validateActivityConfiguration(config)).resolves.toBeDefined();
		config.climate = { enabled: true, thermostat_preset: 'comfort' };
		await expect(validateActivityConfiguration(config)).resolves.toBeDefined();
	});
	it.each([
		{ enabled: true },
		{ enabled: true, thermostat_preset: '' },
		{ enabled: true, thermostat_preset: 'nonexistent' },
		{ enabled: true, thermostat_preset: null },
		{ enabled: true, mode: ClimateMode.HEAT, setpoint: null },
		{ enabled: true, thermostat_preset: 'comfort', setpoint: 21 },
		{ enabled: false, thermostat_preset: 'eco', setpoint_delta: 2 },
		{ enabled: true, mode: ClimateMode.HEAT, setpoint: 21, setpoint_delta: 2 },
		{ enabled: true, mode: ClimateMode.AUTO, setpoint: 21 },
		{ enabled: true, mode: ClimateMode.OFF, setpoint_delta: 2 },
		{ enabled: true, setpoint: 21 },
		{ enabled: true, thermostat_preset: 'comfort', mode: ClimateMode.HEAT },
	])('rejects invalid or ambiguous climate action %j', async (climate) => {
		const config = defaultActivityConfiguration(ActivityMode.WORK);
		config.climate = climate as never;
		await expect(validateActivityConfiguration(config)).rejects.toThrow();
	});
	it('rejects nested unknown fields, invalid values and OFF brightness', async () => {
		const config = defaultActivityConfiguration(ActivityMode.WORK);
		Object.assign(config.climate, { owner_id: 'public-owner' });
		await expect(validateActivityConfiguration(config)).rejects.toThrow();
		Reflect.deleteProperty(config.climate, 'owner_id');
		config.lighting.brightness = 101;
		await expect(validateActivityConfiguration(config)).rejects.toThrow();
		config.lighting = { enabled: true, mode: LightingMode.OFF, brightness: 0 };
		await expect(validateActivityConfiguration(config)).rejects.toThrow();
	});
});
