import { describe, expect, it, vi } from 'vitest';

import { ConfigModuleAudioType } from '../../../openapi.constants';
import { ConfigValidationException } from '../config.exceptions';

import type { IConfigAudioEditActionPayload, IConfigAudioRes } from './config-audio.store.types';
import { transformConfigAudioResponse, transformConfigAudioUpdateRequest } from './config-audio.transformers';

vi.mock('../../../common', async () => {
	const actual = await vi.importActual('../../../common');

	return {
		...actual,
		logger: {
			error: vi.fn(),
			info: vi.fn(),
			warning: vi.fn(),
			log: vi.fn(),
		},
	};
});

const validConfigAudioResponse: IConfigAudioRes = {
	type: ConfigModuleAudioType.audio,
	speaker: true,
	speaker_volume: 80,
	microphone: false,
	microphone_volume: 50,
};

const validConfigAudioUpdatePayload: IConfigAudioEditActionPayload['data'] = {
	speaker: true,
	speakerVolume: 80,
	microphone: false,
	microphoneVolume: 50,
};

describe('Config Audio Transformers', (): void => {
	describe('transformConfigAudioResponse', (): void => {
		it('should transform a valid config audio response', (): void => {
			const result = transformConfigAudioResponse(validConfigAudioResponse);

			expect(result).toEqual({
				type: ConfigModuleAudioType.audio,
				speaker: true,
				speakerVolume: 80,
				microphone: false,
				microphoneVolume: 50,
			});
		});

		it('should throw an error for an invalid config audio response', (): void => {
			expect(() => transformConfigAudioResponse({ ...validConfigAudioResponse, speakerVolume: null } as unknown as IConfigAudioRes)).toThrow(
				ConfigValidationException
			);
		});
	});

	describe('transformConfigAudioUpdateRequest', (): void => {
		it('should transform a valid config audio update request', (): void => {
			const result = transformConfigAudioUpdateRequest(validConfigAudioUpdatePayload);

			expect(result).toEqual({
				type: ConfigModuleAudioType.audio,
				speaker: true,
				speaker_volume: 80,
				microphone: false,
				microphone_volume: 50,
			});
		});

		it('should throw an error for an invalid config audio update request', (): void => {
			expect(() =>
				transformConfigAudioUpdateRequest({
					...validConfigAudioUpdatePayload,
					speakerVolume: 200,
				} as unknown as IConfigAudioEditActionPayload['data'])
			).toThrow(ConfigValidationException);
		});
	});
});
