import { instanceToPlain } from 'class-transformer';
import { validateSync } from 'class-validator';

import { toInstance } from '../../../common/utils/transform.utils';
import { CAMERAS_MODULE_NAME, GO2RTC_DEFAULT_BINARY_PATH } from '../cameras.constants';

import { CamerasConfigModel } from './config.model';

describe('CamerasConfigModel', () => {
	it('defaults to a managed relay at the install path with 8 / 4 sessions', () => {
		const config = toInstance(CamerasConfigModel, { type: CAMERAS_MODULE_NAME });

		expect(config.go2rtc).toEqual(
			expect.objectContaining({ mode: 'managed', binaryPath: GO2RTC_DEFAULT_BINARY_PATH, externalUrl: null }),
		);
		expect([config.maxSessions, config.maxSessionsPerCamera]).toEqual([8, 4]);
		expect(instanceToPlain(config)).toMatchObject({
			go2rtc: { binary_path: GO2RTC_DEFAULT_BINARY_PATH, external_url: null },
			max_sessions: 8,
			max_sessions_per_camera: 4,
		});
	});

	it('loads a hand-edited external config without a url', () => {
		const config = toInstance(CamerasConfigModel, { type: CAMERAS_MODULE_NAME, go2rtc: { mode: 'external' } });

		expect(config.go2rtc.mode).toBe('external');
		expect(config.go2rtc.externalUrl).toBeNull();
		expect(validateSync(config)).toHaveLength(0);
	});
});
