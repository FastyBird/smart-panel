import { type Ref, ref } from 'vue';

import { createPinia, setActivePinia } from 'pinia';

import { type Mock, beforeEach, describe, expect, it, vi } from 'vitest';

import { injectStoresManager } from '../../../common';
import type { IThrottleStatus } from '../store';

import { useThrottleStatus } from './useThrottleStatus';

const mockAudio: IThrottleStatus = {
	undervoltage: false,
	frequencyCapping: false,
	throttling: false,
	softTempLimit: false,
};

vi.mock('../../../common', async () => {
	const actual = await vi.importActual('../../../common');

	return {
		...actual,
		injectStoresManager: vi.fn(),
	};
});

describe('useThrottleStatus', () => {
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
			$id: 'throttleStatus',
			data: ref(null),
			semaphore: ref({
				getting: false,
			}),
		};

		(injectStoresManager as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
			getStore: () => mockStore,
		});
	});

	it('should return a throttle status', () => {
		mockStore.data.value = mockAudio;

		const { throttleStatus } = useThrottleStatus();

		expect(throttleStatus.value).toEqual(mockAudio);
	});

	it('returns isLoading true if data is null and getting is true', () => {
		mockStore.semaphore.value.getting = true;

		const { isLoading } = useThrottleStatus();

		expect(isLoading.value).toBe(true);
	});

	it('returns isLoading false if data is present', () => {
		mockStore.semaphore.value.getting = false;

		const { isLoading } = useThrottleStatus();

		expect(isLoading.value).toBe(false);
	});

	it('calls fetchThrottleStatus and triggers store.get', async () => {
		const { fetchThrottleStatus } = useThrottleStatus();

		await fetchThrottleStatus();

		expect(get).toHaveBeenCalled();
	});
});
