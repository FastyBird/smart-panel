import { LightingMode } from '../spaces-home-control.constants';

import { ActivityMode } from './space-activity.constants';
import { defaultActivityConfiguration } from './space-activity.defaults';

describe('activity defaults', () => {
	it.each(Object.values(ActivityMode))('%s never invents climate defaults', (mode) => {
		expect(defaultActivityConfiguration(mode).climate).toEqual({ enabled: false });
		expect(defaultActivityConfiguration(mode).security.enabled).toBe(false);
	});
	it('Sleep and Away send actual OFF, not night mode brightness hints', () => {
		expect(defaultActivityConfiguration(ActivityMode.SLEEP).lighting).toEqual({
			enabled: true,
			mode: LightingMode.OFF,
		});
		expect(defaultActivityConfiguration(ActivityMode.AWAY).lighting.mode).toBe(LightingMode.OFF);
	});
	it('returns independent authored copies', () => {
		const first = defaultActivityConfiguration(ActivityMode.WORK);
		first.climate.enabled = true;
		expect(defaultActivityConfiguration(ActivityMode.WORK).climate.enabled).toBe(false);
	});
});
