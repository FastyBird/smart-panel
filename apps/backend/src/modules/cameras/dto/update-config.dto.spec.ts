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

	it.each([
		[{ go2rtc: { mode: 'bogus' } }, 'mode'],
		[{ go2rtc: { binary_path: '/bin/sh' } }, 'binary_path'],
		[{ go2rtc: { external_url: 'http://u:p@h' } }, 'external_url'],
		[{ max_sessions: 0 }, 'max_sessions'],
		[{ max_sessions: 33 }, 'max_sessions'],
		[{ max_sessions_per_camera: 17 }, 'max_sessions_per_camera'],
	])('rejects %j', async (data, field) => {
		const errors = await validate(plainToInstance(UpdateCamerasConfigDto, { type: CAMERAS_MODULE_NAME, ...data }));

		expect(errors.length).toBeGreaterThan(0);
		expect(JSON.stringify(errors)).toContain(field);
	});

	it('accepts a valid relay update and an explicit null url', async () => {
		const dto = plainToInstance(UpdateCamerasConfigDto, {
			type: CAMERAS_MODULE_NAME,
			go2rtc: { mode: 'external', binary_path: '/opt/go2rtc', external_url: null },
			max_sessions: 32,
			max_sessions_per_camera: 16,
		});

		expect(await validate(dto)).toHaveLength(0);
		expect(dto.go2rtc?.externalUrl).toBeNull();
	});

	it('keeps stored go2rtc fields that a nested update omits', () => {
		const stored = toInstance(CamerasConfigModel, {
			type: CAMERAS_MODULE_NAME,
			go2rtc: { mode: 'external', external_url: 'http://h:1984', binary_path: '/opt/go2rtc' },
		});
		const update = toInstance(
			UpdateCamerasConfigDto,
			{ type: CAMERAS_MODULE_NAME, go2rtc: { mode: 'managed' } },
			{ excludeExtraneousValues: false },
		);

		const merged = toInstance(
			CamerasConfigModel,
			new ConfigSecretsService().merge(stored, { type: CAMERAS_MODULE_NAME, ...update }),
		);

		expect(merged.go2rtc).toEqual(
			expect.objectContaining({ mode: 'managed', externalUrl: 'http://h:1984', binaryPath: '/opt/go2rtc' }),
		);
	});
});
