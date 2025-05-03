import { type Ref, ref } from 'vue';

import { createPinia, setActivePinia } from 'pinia';

import { type Mock, beforeEach, describe, expect, it, vi } from 'vitest';

import { injectStoresManager } from '../../../common';
import type { IHomeAssistantState } from '../store/home-assistant-states.store.types';

import { useStates } from './useStates';

vi.mock('../../../common', async () => {
	const actual = await vi.importActual('../../../common');

	return {
		...actual,
		injectStoresManager: vi.fn(),
	};
});

describe('useStates', () => {
	let mockData: Record<string, IHomeAssistantState>;
	let semaphore: Ref;
	let firstLoad: Ref;
	let fetch: Mock;
	let findAll: Mock;
	let mockStore: {
		$id: string;
		fetch: Mock;
		findAll: Mock;
		semaphore: Ref;
		firstLoad: Ref;
	};

	beforeEach(() => {
		setActivePinia(createPinia());

		mockData = {
			'entity-identifier1': { entityId: 'entity-identifier1' } as IHomeAssistantState,
			'entity-identifier2': { entityId: 'entity-identifier2' } as IHomeAssistantState,
		};

		semaphore = ref({
			fetching: {
				items: false,
			},
		});

		firstLoad = ref(false);
		fetch = vi.fn();
		findAll = vi.fn(() => Object.values(mockData));

		mockStore = {
			$id: 'states',
			fetch,
			findAll,
			semaphore,
			firstLoad,
		};

		(injectStoresManager as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
			getStore: () => mockStore,
		});
	});

	it('should return states', () => {
		const { states } = useStates();

		expect(states.value).toEqual([{ entityId: 'entity-identifier1' }, { entityId: 'entity-identifier2' }]);
	});

	it('should call fetchStates', async () => {
		const { fetchStates } = useStates();

		await fetchStates();

		expect(fetch).toHaveBeenCalled();
	});

	it('should return areLoading = true if fetching.items is truthy', () => {
		semaphore.value.fetching.items = ['all'];

		const { areLoading } = useStates();

		expect(areLoading.value).toBe(true);
	});

	it('should return areLoading = false if firstLoad is true', () => {
		firstLoad.value = true;

		const { areLoading } = useStates();

		expect(areLoading.value).toBe(false);
	});

	it('should return loaded = true if firstLoad is true', () => {
		firstLoad.value = true;

		const { loaded } = useStates();

		expect(loaded.value).toBe(true);
	});

	it('should return loaded = false if firstLoad is false', () => {
		firstLoad.value = false;

		const { loaded } = useStates();

		expect(loaded.value).toBe(false);
	});
});
