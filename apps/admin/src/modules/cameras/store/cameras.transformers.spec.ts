import { describe, expect, it, vi } from 'vitest';

import type { CamerasModuleCameraSchema } from '../../../openapi.constants';
import { CamerasValidationException } from '../cameras.exceptions';

import { transformCameraResponse } from './cameras.transformers';

vi.mock('../../../common', async () => {
	const utils = await vi.importActual('../../../common/utils/utils');

	return { ...utils, logger: { error: vi.fn() } };
});

describe('cameras transformers', () => {
	it('transformers reject a profile without available', () => {
		const response = {
			device_id: 'a',
			name: 'Front door',
			category: 'camera',
			type: 'x',
			live_view: true,
			profiles: [
				{ id: 'high', channel_id: null, width: null, height: null, fps: null, video_codec: null, audio_codec: null, unavailable_reason: null },
			],
		} as unknown as CamerasModuleCameraSchema;

		expect(() => transformCameraResponse(response)).toThrow(CamerasValidationException);
	});
});
