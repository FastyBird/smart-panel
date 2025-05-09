import { type Ref, nextTick, ref } from 'vue';

import { createPinia, setActivePinia } from 'pinia';

import { type Mock, beforeEach, describe, expect, it, vi } from 'vitest';

import { injectStoresManager } from '../../../common';
import type { IHomeAssistantState } from '../store/home-assistant-states.store.types';

import { defaultStatesFilter, useStatesDataSource } from './useStatesDataSource';

vi.mock('../../../common', async () => {
	const actual = await vi.importActual('../../../common');
	return {
		...actual,
		injectStoresManager: vi.fn(),
	};
});

describe('useStatesDataSource', () => {
	let mockStore: {
		findAll: Mock;
		fetch: Mock;
		semaphore: Ref;
		firstLoad: Ref;
	};
	let mockStates: IHomeAssistantState[];

	beforeEach(() => {
		setActivePinia(createPinia());

		mockStates = [
			{
				entityId: 'entity-identifier-light',
				state: true,
				attributes: {
					friendlyName: 'Light',
				},
				lastChanged: new Date('2025-01-01'),
				lastReported: new Date('2025-01-01'),
				lastUpdated: new Date('2025-01-01'),
			} as IHomeAssistantState,
			{
				entityId: 'entity-identifier-plug',
				state: false,
				attributes: {
					friendlyName: 'Plug',
				},
				lastChanged: new Date('2025-01-02'),
				lastReported: new Date('2025-01-02'),
				lastUpdated: new Date('2025-01-02'),
			} as IHomeAssistantState,
		];

		mockStore = {
			findAll: vi.fn(() => mockStates),
			fetch: vi.fn(),
			semaphore: ref({ fetching: { items: false } }),
			firstLoad: ref(true),
		};

		(injectStoresManager as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
			getStore: () => mockStore,
		});
	});

	it('fetches states correctly', async () => {
		const { fetchStates } = useStatesDataSource();

		await fetchStates();

		expect(mockStore.fetch).toHaveBeenCalled();
	});

	it('returns states', () => {
		const { states } = useStatesDataSource();

		expect(states.value.length).toBe(2);
	});

	it('filters states by search text', () => {
		const { filters, states } = useStatesDataSource();

		filters.value.search = 'plug';

		expect(states.value).toEqual([mockStates[1]]);
	});

	it('filters states by adoption status', () => {
		const { filters, states } = useStatesDataSource();

		filters.value.lastChangedFrom = new Date('2025-01-02');

		expect(states.value).toEqual([mockStates[1]]);
	});

	it('sorts states in ascending order by default', () => {
		const { states } = useStatesDataSource();

		expect(states.value.map((d) => d.entityId)).toEqual(['entity-identifier-light', 'entity-identifier-plug']);
	});

	it('paginates states', () => {
		const { statesPaginated, paginateSize, paginatePage } = useStatesDataSource();

		paginateSize.value = 1;
		paginatePage.value = 2;

		expect(statesPaginated.value).toEqual([mockStates[1]]);
	});

	it('tracks filtersActive correctly', () => {
		const { filters, filtersActive } = useStatesDataSource();

		expect(filtersActive.value).toBe(false);

		filters.value.search = 'something';

		expect(filtersActive.value).toBe(true);
	});

	it('resets filters to default', () => {
		const { filters, resetFilter } = useStatesDataSource();

		filters.value.search = 'abc';
		filters.value.lastChangedFrom = new Date('2025-01-02');

		resetFilter();

		expect(filters.value).toEqual(defaultStatesFilter);
	});

	it('updates pagination page on filter change', async () => {
		const { filters, paginatePage } = useStatesDataSource();

		paginatePage.value = 3;

		filters.value.search = 'abc';

		await nextTick();

		expect(paginatePage.value).toBe(1);
	});

	it('handles areLoading correctly based on flags', () => {
		const { areLoading } = useStatesDataSource();

		mockStore.semaphore.value.fetching.items = true;
		expect(areLoading.value).toBe(true);

		mockStore.firstLoad.value = true;
		mockStore.semaphore.value.fetching.items = false;
		expect(areLoading.value).toBe(false);
	});

	it('returns correct total rows', () => {
		const { totalRows } = useStatesDataSource();

		expect(totalRows.value).toBe(2);
	});
});
