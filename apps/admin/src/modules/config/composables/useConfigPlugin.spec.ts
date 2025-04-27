import { type Ref, ref } from 'vue';

import { createPinia, setActivePinia } from 'pinia';

import { type Mock, beforeEach, describe, expect, it, vi } from 'vitest';

import { injectStoresManager } from '../../../common';
import type { IConfigPlugin } from '../store/config-plugins.store.types';

import { useConfigPlugin } from './useConfigPlugin';

const mockPlugin: IConfigPlugin = {
	type: 'custom-plugin',
};

vi.mock('../../../common', async () => {
	const actual = await vi.importActual('../../../common');

	return {
		...actual,
		injectStoresManager: vi.fn(),
	};
});

describe('useConfigPlugin', () => {
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
			$id: 'configPlugin',
			data: ref({}),
			semaphore: ref({
				getting: [],
			}),
		};

		(injectStoresManager as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
			getStore: () => mockStore,
		});
	});

	it('should return a config', () => {
		mockStore.data.value = { [mockPlugin.type]: mockPlugin };

		const { configPlugin } = useConfigPlugin({ type: 'custom-plugin' });

		expect(configPlugin.value).toEqual(mockPlugin);
	});

	it('returns isLoading true if data is null and getting is true', () => {
		mockStore.semaphore.value.getting.push(mockPlugin.type);

		const { isLoading } = useConfigPlugin({ type: 'custom-plugin' });

		expect(isLoading.value).toBe(true);
	});

	it('returns isLoading false if data is present', () => {
		mockStore.semaphore.value.getting = [];

		const { isLoading } = useConfigPlugin({ type: 'custom-plugin' });

		expect(isLoading.value).toBe(false);
	});

	it('calls fetchConfigPlugin and triggers store.get', async () => {
		const { fetchConfigPlugin } = useConfigPlugin({ type: 'custom-plugin' });

		await fetchConfigPlugin();

		expect(get).toHaveBeenCalled();
	});
});
