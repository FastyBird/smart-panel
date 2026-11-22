import { describe, expect, it } from 'vitest';

import { DevicesModuleDeviceCategory } from '../../openapi.constants';

import { configDeviceIds, configDomain, deviceCategoryDomain } from './automations.domains';

describe('automation block domains', () => {
	it('maps device categories to the domains of the domain icon', () => {
		expect(deviceCategoryDomain(DevicesModuleDeviceCategory.lighting)).toBe('lights');
		expect(deviceCategoryDomain(DevicesModuleDeviceCategory.thermostat)).toBe('climate');
		expect(deviceCategoryDomain(DevicesModuleDeviceCategory.window_covering)).toBe('covers');
		expect(deviceCategoryDomain(DevicesModuleDeviceCategory.television)).toBe('media');
		expect(deviceCategoryDomain(DevicesModuleDeviceCategory.sensor)).toBe('sensors');
		expect(deviceCategoryDomain(DevicesModuleDeviceCategory.outlet)).toBe('energy');
		expect(deviceCategoryDomain(DevicesModuleDeviceCategory.camera)).toBe('cameras');
		expect(deviceCategoryDomain(DevicesModuleDeviceCategory.generic)).toBeUndefined();
		expect(deviceCategoryDomain(null)).toBeUndefined();
	});

	it('finds every device a configuration names, at any depth', () => {
		expect(
			configDeviceIds({
				device_id: 'a',
				writes: [{ device_id: 'b' }, { device_id: 'a' }, { device_id: '' }],
				other: { nested: [{ device_id: 'c' }] },
			})
		).toEqual(['a', 'b', 'c']);
		expect(configDeviceIds({ seconds: 5 })).toEqual([]);
	});

	it('gives a block the one domain its devices share, and none for mixed or unknown devices', () => {
		const categories: Record<string, DevicesModuleDeviceCategory> = {
			lamp: DevicesModuleDeviceCategory.lighting,
			strip: DevicesModuleDeviceCategory.lighting,
			blind: DevicesModuleDeviceCategory.window_covering,
		};
		const categoryOf = (id: string) => categories[id];

		expect(configDomain({ writes: [{ device_id: 'lamp' }, { device_id: 'strip' }] }, categoryOf)).toBe('lights');
		expect(configDomain({ writes: [{ device_id: 'lamp' }, { device_id: 'blind' }] }, categoryOf)).toBeUndefined();
		expect(configDomain({ device_id: 'unknown' }, categoryOf)).toBeUndefined();
		expect(configDomain({}, categoryOf)).toBeUndefined();
	});
});
