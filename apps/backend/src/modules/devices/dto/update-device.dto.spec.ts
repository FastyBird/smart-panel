import { validate } from 'class-validator';

import { toInstance } from '../../../common/utils/transform.utils';
import { DeviceHiddenBy } from '../devices.constants';

import { UpdateDeviceDto } from './update-device.dto';

describe('UpdateDeviceDto hidden provenance', () => {
	it.each([null, DeviceHiddenBy.USER, DeviceHiddenBy.SYSTEM])('preserves submitted provenance %s', async (hiddenBy) => {
		const dto = toInstance(UpdateDeviceDto, { type: 'virtual', hidden_by: hiddenBy });

		expect(dto.hidden_by).toBe(hiddenBy);
		expect(await validate(dto)).toEqual([]);
	});

	it('keeps omitted provenance distinct from null', async () => {
		const dto = toInstance(UpdateDeviceDto, { type: 'virtual', name: 'Renamed' });

		expect(dto.hidden_by).toBeUndefined();
		expect(await validate(dto)).toEqual([]);
	});

	it('rejects an unknown provenance', async () => {
		const dto = toInstance(UpdateDeviceDto, { type: 'virtual', hidden_by: 'unknown' });

		expect((await validate(dto)).map((error) => error.property)).toContain('hidden_by');
	});
});
