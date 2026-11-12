import { describe, expect, it } from 'vitest';

import { DevicesModuleDeviceCategory } from '../../openapi.constants';

import { deviceChannelsSortingSpecification, deviceChannelsSpecificationMappers } from './devices.mapping';

describe('Devices mapping', (): void => {
	it.each([DevicesModuleDeviceCategory.camera, DevicesModuleDeviceCategory.doorbell])('orders detection channels for %s', (category): void => {
		const order: string[] = deviceChannelsSortingSpecification[category];

		for (const channel of ['object_detection', 'sound_detection', 'indicator', 'illuminance', 'smoke', 'carbon_monoxide']) {
			expect(order).toContain(channel);
		}

		expect(order.indexOf('motion')).toBeLessThan(order.indexOf('object_detection'));
		expect(order.indexOf('object_detection')).toBeLessThan(order.indexOf('sound_detection'));
	});

	it('marks camera and detection channels as multiple on cameras', (): void => {
		const spec = deviceChannelsSpecificationMappers[DevicesModuleDeviceCategory.camera];

		expect(spec.multiple).toEqual(expect.arrayContaining(['camera', 'object_detection', 'sound_detection']));
	});
});
