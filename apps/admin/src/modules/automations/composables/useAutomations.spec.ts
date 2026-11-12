import { type Ref, ref } from 'vue';

import { createPinia, setActivePinia } from 'pinia';

import { type Mock, beforeEach, describe, expect, it, vi } from 'vitest';

import { injectStoresManager } from '../../../common';
import type { IAutomation } from '../store/automations.store.types';

import { useAutomations } from './useAutomations';

vi.mock('../../../common', async () => {
	const actual = await vi.importActual('../../../common');

	return {
		...actual,
		injectStoresManager: vi.fn(),
	};
});

describe('useAutomations', () => {
	let mockStore: {
		findAll: Mock;
		fetch: Mock;
		semaphore: Ref;
		firstLoad: Ref;
	};

	beforeEach(() => {
		setActivePinia(createPinia());

		mockStore = {
			findAll: vi.fn(() => [{ id: '2', name: 'Night mode' } as IAutomation, { id: '1', name: 'Hallway motion light' } as IAutomation]),
			fetch: vi.fn(),
			semaphore: ref({ fetching: { items: false, item: [] } }),
			firstLoad: ref(false),
		};

		(injectStoresManager as Mock).mockReturnValue({
			getStore: () => mockStore,
		});
	});

	it('returns the automations sorted by name', () => {
		const { automations } = useAutomations();

		expect(automations.value.map((automation) => automation.name)).toEqual(['Hallway motion light', 'Night mode']);
	});

	it('fetches the automations', async () => {
		const { fetchAutomations } = useAutomations();

		await fetchAutomations();

		expect(mockStore.fetch).toHaveBeenCalledTimes(1);
	});

	it('is loading until the first load has finished', () => {
		const { areLoading, loaded } = useAutomations();

		expect(areLoading.value).toBe(true);
		expect(loaded.value).toBe(false);

		mockStore.firstLoad.value = true;

		expect(areLoading.value).toBe(false);
		expect(loaded.value).toBe(true);
	});

	it('is loading while the list is being fetched again', () => {
		mockStore.firstLoad.value = true;
		mockStore.semaphore.value.fetching.items = true;

		const { areLoading } = useAutomations();

		expect(areLoading.value).toBe(true);
	});
});
