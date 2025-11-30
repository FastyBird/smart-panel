import { type Ref, ref } from 'vue';

import { createPinia, setActivePinia } from 'pinia';

import { type Mock, beforeEach, describe, expect, it, vi } from 'vitest';

import { injectStoresManager } from '../../../common';
import { ConfigModuleAudioType } from '../../../openapi.constants';
import type { IConfigAudio } from '../store/config-audio.store.types';

import { useConfigAudio } from './useConfigAudio';

const mockAudio: IConfigAudio = {
	type: ConfigModuleAudioType.audio,
	speaker: true,
	speakerVolume: 80,
	microphone: false,
	microphoneVolume: 50,
};

vi.mock('../../../common', async () => {
	const actual = await vi.importActual('../../../common');

	return {
		...actual,
		injectStoresManager: vi.fn(),
	};
});

describe('useConfigAudio', () => {
	let get: Mock;

	let mockStore: {
		get: Mock;
		$id: string;
		data: Ref;
		semaphore: Ref;
	};

	beforeEach(() => {
		setActivePinia(createPinia());

		get = vi.fn();

		mockStore = {
			get,
			$id: 'configAudio',
			data: ref(null),
			semaphore: ref({
				getting: false,
			}),
		};

		(injectStoresManager as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
			getStore: () => mockStore,
		});
	});

	it('should return a config', () => {
		mockStore.data.value = mockAudio;

		const { configAudio } = useConfigAudio();

		expect(configAudio.value).toEqual(mockAudio);
	});

	it('returns isLoading true if data is null and getting is true', () => {
		mockStore.semaphore.value.getting = true;

		const { isLoading } = useConfigAudio();

		expect(isLoading.value).toBe(true);
	});

	it('returns isLoading false if data is present', () => {
		mockStore.semaphore.value.getting = false;

		const { isLoading } = useConfigAudio();

		expect(isLoading.value).toBe(false);
	});

	it('calls fetchConfigAudio and triggers store.get', async () => {
		const { fetchConfigAudio } = useConfigAudio();

		await fetchConfigAudio();

		expect(get).toHaveBeenCalled();
	});
});
