import { createPinia, setActivePinia } from 'pinia';

import { type Mock, beforeEach, describe, expect, it, vi } from 'vitest';

import { ConfigModuleAudioType } from '../../../openapi';
import { ConfigApiException, ConfigValidationException } from '../config.exceptions';

import { useConfigAudio } from './config-audio.store';
import type { IConfigAudioEditActionPayload, IConfigAudioSetActionPayload } from './config-audio.store.types';

const mockAudioRes = {
	type: ConfigModuleAudioType.audio,
	speaker: true,
	speaker_volume: 80,
	microphone: false,
	microphone_volume: 50,
};

const mockAudio = {
	type: ConfigModuleAudioType.audio,
	speaker: true,
	speakerVolume: 80,
	microphone: false,
	microphoneVolume: 50,
};

const backendClient = {
	GET: vi.fn(),
	PATCH: vi.fn(),
};

vi.mock('../../../common', async () => {
	const actual = await vi.importActual('../../../common');

	return {
		...actual,
		useBackend: () => ({
			client: backendClient,
		}),
		useLogger: vi.fn(() => ({
			error: vi.fn(),
			info: vi.fn(),
			warning: vi.fn(),
			log: vi.fn(),
			debug: vi.fn(),
		})),
		getErrorReason: () => 'Some error',
	};
});

describe('ConfigAudio Store', () => {
	let store: ReturnType<typeof useConfigAudio>;

	beforeEach(() => {
		setActivePinia(createPinia());

		store = useConfigAudio();

		vi.clearAllMocks();
	});

	it('should set config audio data successfully', () => {
		const result = store.set({ data: mockAudio });

		expect(result).toEqual(mockAudio);
		expect(store.data).toEqual(mockAudio);
	});

	it('should throw validation error if set config audio with invalid data', () => {
		expect(() => store.set({ data: { ...mockAudio, speakerVolume: 'invalid' } } as unknown as IConfigAudioSetActionPayload)).toThrow(
			ConfigValidationException
		);
	});

	it('should fetch config audio successfully', async () => {
		(backendClient.GET as Mock).mockResolvedValue({
			data: { data: mockAudioRes },
			error: undefined,
			response: { status: 200 },
		});

		const result = await store.get();

		expect(result).toEqual(mockAudio);
		expect(store.data).toEqual(mockAudio);
	});

	it('should throw error if fetch fails', async () => {
		(backendClient.GET as Mock).mockResolvedValue({
			data: undefined,
			error: new Error('Network error'),
			response: { status: 500 },
		});

		await expect(store.get()).rejects.toThrow(ConfigApiException);
	});

	it('should update config audio successfully', async () => {
		store.data = { ...mockAudio };

		(backendClient.PATCH as Mock).mockResolvedValue({
			data: { data: { ...mockAudioRes, speaker_volume: 50 } },
			error: undefined,
			response: { status: 200 },
		});

		const result = await store.edit({
			data: { ...mockAudio, speakerVolume: 50 },
		});

		expect(result.speakerVolume).toBe(50);
		expect(store.data?.speakerVolume).toBe(50);
	});

	it('should throw validation error if edit payload is invalid', async () => {
		await expect(
			store.edit({
				data: { ...mockAudio, speakerVolume: 'not-a-number' },
			} as unknown as IConfigAudioEditActionPayload)
		).rejects.toThrow(ConfigValidationException);
	});

	it('should throw validation error if local data + edit is invalid', async () => {
		store.data = { ...mockAudio, speakerVolume: 75 };

		await expect(
			store.edit({
				data: { ...mockAudio, speakerVolume: undefined, speaker: false },
			} as unknown as IConfigAudioEditActionPayload)
		).rejects.toThrow(ConfigValidationException);
	});

	it('should refresh data and throw if API update fails', async () => {
		store.data = { ...mockAudio };

		(backendClient.PATCH as Mock).mockResolvedValue({
			data: undefined,
			error: new Error('Patch error'),
			response: { status: 500 },
		});

		(backendClient.GET as Mock).mockResolvedValue({
			data: { data: mockAudioRes },
			error: undefined,
			response: { status: 200 },
		});

		await expect(store.edit({ data: { ...mockAudio, speakerVolume: 20 } })).rejects.toThrow(ConfigApiException);
	});
});
