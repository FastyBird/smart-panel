import { validate } from 'class-validator';

import { toInstance } from '../../../common/utils/transform.utils';
import { DeviceCategory } from '../../../modules/devices/devices.constants';

import { WledAdoptRequestDto, WledProbeRequestDto } from './wled-adoption.dto';

describe('WLED adoption DTOs', () => {
	it('requires the probe wrapper data', async () => {
		const errors = await validate(toInstance(WledProbeRequestDto, {}));

		expect(errors.some((error) => error.property === 'data')).toBe(true);
	});

	it('accepts only lighting adoption requests', async () => {
		const valid = toInstance(WledAdoptRequestDto, {
			data: { devices: [{ host: '192.168.1.100', name: 'Strip', category: DeviceCategory.LIGHTING }] },
		});
		const invalid = toInstance(WledAdoptRequestDto, {
			data: { devices: [{ host: '192.168.1.100', name: 'Strip', category: DeviceCategory.SWITCHER }] },
		});

		await expect(validate(valid)).resolves.toHaveLength(0);
		const errors = await validate(invalid);
		expect(errors).not.toHaveLength(0);
	});
});
