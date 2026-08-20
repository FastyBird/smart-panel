import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';

import { DeviceCategory } from '../../../modules/devices/devices.constants';

import { HomeyMappingPreviewRequestDto } from './mapping-preview.dto';

describe('HomeyMappingPreviewRequestDto', () => {
	it('transforms the snake-case request contract', async () => {
		const dto = plainToInstance(
			HomeyMappingPreviewRequestDto,
			{ device_id: 'homey-light', device_category: DeviceCategory.LIGHTING },
			{ excludeExtraneousValues: true },
		);

		expect(dto).toMatchObject({ deviceId: 'homey-light', deviceCategory: DeviceCategory.LIGHTING });
		await expect(validate(dto)).resolves.toStrictEqual([]);
	});

	it.each([{}, { device_id: '' }, { device_id: 'homey-light', device_category: 'not-a-category' }])(
		'rejects an invalid request: %p',
		async (body) => {
			const dto = plainToInstance(HomeyMappingPreviewRequestDto, body, { excludeExtraneousValues: true });

			await expect(validate(dto)).resolves.not.toStrictEqual([]);
		},
	);
});
