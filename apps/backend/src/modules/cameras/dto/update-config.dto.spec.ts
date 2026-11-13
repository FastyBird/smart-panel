import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';

import { toInstance } from '../../../common/utils/transform.utils';
import { ConfigSecretsService } from '../../config/services/config-secrets.service';
import { CAMERAS_MODULE_NAME } from '../cameras.constants';
import { CamerasConfigModel } from '../models/config.model';

import { UpdateCamerasConfigDto } from './update-config.dto';

describe('UpdateCamerasConfigDto', () => {
	it('leaves enabled undefined when the update omits it', async () => {
		const dto = plainToInstance(
			UpdateCamerasConfigDto,
			{ type: CAMERAS_MODULE_NAME },
			{ excludeExtraneousValues: false },
		);

		expect(dto.enabled).toBeUndefined();
		expect(await validate(dto)).toHaveLength(0);
	});

	it('keeps a stored disabled state when the update omits enabled', () => {
		const stored = toInstance(CamerasConfigModel, { type: CAMERAS_MODULE_NAME, enabled: false });
		const update = toInstance(
			UpdateCamerasConfigDto,
			{ type: CAMERAS_MODULE_NAME },
			{ excludeExtraneousValues: false },
		);

		// The same merge ConfigService.setModuleConfig applies to the stored module config.
		const merged = toInstance(
			CamerasConfigModel,
			new ConfigSecretsService().merge(stored, { type: CAMERAS_MODULE_NAME, ...update }),
		);

		expect(merged.enabled).toBe(false);
	});

	it('keeps the enabled default on the config model', () => {
		expect(new CamerasConfigModel().enabled).toBe(true);
	});
});
