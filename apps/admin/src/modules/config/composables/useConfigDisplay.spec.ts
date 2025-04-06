import { type Ref, ref } from 'vue';

import { createPinia, setActivePinia } from 'pinia';

import { type Mock, beforeEach, describe, expect, it, vi } from 'vitest';

import { injectStoresManager } from '../../../common';
import { ConfigDisplayType } from '../../../openapi';
import type { IConfigDisplay } from '../store/config-display.store.types';

import { useConfigDisplay } from './useConfigDisplay';

const mockDisplay: IConfigDisplay = {
	type: ConfigDisplayType.display,
	darkMode: true,
	brightness: 80,
	screenLockDuration: 300,
	screenSaver: true,
};

vi.mock('../../../common', async () => {
	const actual = await vi.importActual('../../../common');

	return {
		...actual,
		injectStoresManager: vi.fn(),
	};
});

describe('useConfigDisplay', () => {
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
			$id: 'configDisplay',
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
		mockStore.data.value = mockDisplay;

		const { configDisplay } = useConfigDisplay();

		expect(configDisplay.value).toEqual(mockDisplay);
	});

	it('returns isLoading true if data is null and getting is true', () => {
		mockStore.semaphore.value.getting = true;

		const { isLoading } = useConfigDisplay();

		expect(isLoading.value).toBe(true);
	});

	it('returns isLoading false if data is present', () => {
		mockStore.semaphore.value.getting = false;

		const { isLoading } = useConfigDisplay();

		expect(isLoading.value).toBe(false);
	});

	it('calls fetchConfigDisplay and triggers store.get', async () => {
		const { fetchConfigDisplay } = useConfigDisplay();

		await fetchConfigDisplay();

		expect(get).toHaveBeenCalled();
	});
});
