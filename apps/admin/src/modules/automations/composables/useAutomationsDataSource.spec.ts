import { type Ref, nextTick, ref } from 'vue';

import { createPinia, setActivePinia } from 'pinia';

import { type Mock, beforeEach, describe, expect, it, vi } from 'vitest';

import { deepClone, injectStoresManager, useListQuery } from '../../../common';
import { AutomationStatus, WHOLE_HOME_SPACE_FILTER } from '../automations.constants';
import type { IAutomation } from '../store/automations.store.types';

import { defaultAutomationsFilter, useAutomationsDataSource } from './useAutomationsDataSource';

vi.mock('../../../common', async () => {
	const actual = await vi.importActual('../../../common');

	return {
		...actual,
		injectStoresManager: vi.fn(),
		useListQuery: vi.fn(),
	};
});

const DefaultFilter = {
	search: undefined,
	spaceId: undefined,
	enabled: 'all',
	statuses: [],
};

const DefaultPagination = { page: 1, size: 2 };

const DefaultSort = [{ by: 'name', dir: 'asc' }];

const spaceId = 'b5f5f9a2-6a6c-4c0e-9d7f-1c1d3f1b2a03';

describe('useAutomationsDataSource', () => {
	let mockStore: {
		findAll: Mock;
		fetch: Mock;
		semaphore: Ref;
		firstLoad: Ref;
	};
	let mockAutomations: IAutomation[];
	let mockPagination: Ref<{ page: number; size: number }>;

	beforeEach(() => {
		setActivePinia(createPinia());

		mockAutomations = [
			{
				id: '1',
				name: 'Hallway motion light',
				description: 'Turns the light on',
				enabled: true,
				spaceId,
				status: AutomationStatus.ok,
				lastTriggeredAt: new Date('2026-01-03T10:00:00.000Z'),
			} as IAutomation,
			{
				id: '2',
				name: 'Night mode',
				description: null,
				enabled: false,
				spaceId: null,
				status: AutomationStatus.invalid,
				lastTriggeredAt: null,
			} as IAutomation,
			{
				id: '3',
				name: 'Away heating',
				description: null,
				enabled: true,
				spaceId: null,
				status: AutomationStatus.suspended,
				lastTriggeredAt: new Date('2026-01-01T10:00:00.000Z'),
			} as IAutomation,
		];

		mockStore = {
			findAll: vi.fn(() => mockAutomations),
			fetch: vi.fn(),
			semaphore: ref({ fetching: { items: false } }),
			firstLoad: ref(true),
		};

		const mockFilter = ref(deepClone(DefaultFilter));
		const mockSort = ref(deepClone(DefaultSort));

		mockPagination = ref(deepClone(DefaultPagination));

		(injectStoresManager as Mock).mockReturnValue({
			getStore: () => mockStore,
		});

		(useListQuery as Mock).mockReturnValue({
			filters: mockFilter,
			sort: mockSort,
			pagination: mockPagination,
			reset: (): void => {
				mockFilter.value = deepClone(DefaultFilter);
				mockPagination.value = deepClone(DefaultPagination);
			},
		});
	});

	it('matches the default filter the list query starts from', () => {
		expect(defaultAutomationsFilter).toEqual(DefaultFilter);
	});

	it('fetches the automations', async () => {
		const { fetchAutomations } = useAutomationsDataSource();

		await fetchAutomations();

		expect(mockStore.fetch).toHaveBeenCalled();
	});

	it('stops waiting for the first load and says so when it fails, until a retry succeeds', async () => {
		mockStore.firstLoad.value = false;
		mockStore.fetch.mockRejectedValueOnce(new Error('offline'));

		const { fetchAutomations, areLoading, loadFailed } = useAutomationsDataSource();

		expect(areLoading.value).toBe(true);
		expect(loadFailed.value).toBe(false);

		await expect(fetchAutomations()).rejects.toThrow('offline');

		expect(areLoading.value).toBe(false);
		expect(loadFailed.value).toBe(true);

		mockStore.fetch.mockImplementationOnce(async (): Promise<void> => {
			mockStore.firstLoad.value = true;
		});

		const retry = fetchAutomations();

		// The failure is gone as soon as it is tried again
		expect(loadFailed.value).toBe(false);

		await retry;

		expect(areLoading.value).toBe(false);
		expect(loadFailed.value).toBe(false);
	});

	it('forgets a failed load once the list was loaded by something else', async () => {
		mockStore.firstLoad.value = false;
		mockStore.fetch.mockRejectedValueOnce(new Error('offline'));

		const { fetchAutomations, loadFailed } = useAutomationsDataSource();

		await expect(fetchAutomations()).rejects.toThrow('offline');

		// The refresh after the socket has reconnected
		mockStore.firstLoad.value = true;

		expect(loadFailed.value).toBe(false);
	});

	it('sorts by name by default and paginates', () => {
		const { automations, automationsPaginated, totalRows } = useAutomationsDataSource();

		expect(automations.value.map((automation) => automation.name)).toEqual(['Away heating', 'Hallway motion light', 'Night mode']);
		expect(automationsPaginated.value.map((automation) => automation.id)).toEqual(['3', '1']);
		expect(totalRows.value).toBe(3);
	});

	it('searches in the name and the description', () => {
		const { automations, filters, filtersActive } = useAutomationsDataSource();

		filters.value.search = 'NIGHT';

		expect(automations.value.map((automation) => automation.id)).toEqual(['2']);
		expect(filtersActive.value).toBe(true);

		filters.value.search = 'turns the light';

		expect(automations.value.map((automation) => automation.id)).toEqual(['1']);
	});

	it('filters by the enabled state', () => {
		const { automations, filters } = useAutomationsDataSource();

		filters.value.enabled = 'enabled';

		expect(automations.value.map((automation) => automation.id)).toEqual(['3', '1']);

		filters.value.enabled = 'disabled';

		expect(automations.value.map((automation) => automation.id)).toEqual(['2']);
	});

	it('filters by status', () => {
		const { automations, filters, filtersActive } = useAutomationsDataSource();

		filters.value.statuses = [AutomationStatus.invalid, AutomationStatus.suspended];

		expect(automations.value.map((automation) => automation.id)).toEqual(['3', '2']);
		expect(filtersActive.value).toBe(true);
	});

	it('filters by space, with its own value for automations of the whole home', () => {
		const { automations, filters } = useAutomationsDataSource();

		filters.value.spaceId = spaceId;

		expect(automations.value.map((automation) => automation.id)).toEqual(['1']);

		filters.value.spaceId = WHOLE_HOME_SPACE_FILTER;

		expect(automations.value.map((automation) => automation.id)).toEqual(['3', '2']);
	});

	it('sorts by the last run, with automations that never ran as the oldest', () => {
		const { automations, sortBy, sortDir } = useAutomationsDataSource();

		sortBy.value = 'lastTriggeredAt';
		sortDir.value = 'desc';

		expect(automations.value.map((automation) => automation.id)).toEqual(['1', '3', '2']);

		sortDir.value = 'asc';

		expect(automations.value.map((automation) => automation.id)).toEqual(['2', '3', '1']);
	});

	it('sorts by status', () => {
		const { automations, sortBy } = useAutomationsDataSource();

		sortBy.value = 'status';

		expect(automations.value.map((automation) => automation.status)).toEqual([
			AutomationStatus.invalid,
			AutomationStatus.ok,
			AutomationStatus.suspended,
		]);
	});

	it('goes back to the first page when a filter changes', async () => {
		const { filters, paginatePage } = useAutomationsDataSource();

		paginatePage.value = 2;

		await nextTick();

		expect(mockPagination.value.page).toBe(2);

		filters.value.enabled = 'enabled';

		await nextTick();

		expect(paginatePage.value).toBe(1);
	});

	it('resets the filters', () => {
		const { filters, filtersActive, resetFilter } = useAutomationsDataSource();

		filters.value.search = 'night';

		expect(filtersActive.value).toBe(true);

		resetFilter();

		expect(filters.value).toEqual(DefaultFilter);
		expect(filtersActive.value).toBe(false);
	});

	it('is loading until the first load has finished', () => {
		mockStore.firstLoad.value = false;

		const { areLoading, loaded } = useAutomationsDataSource();

		expect(areLoading.value).toBe(true);
		expect(loaded.value).toBe(false);

		mockStore.firstLoad.value = true;

		expect(areLoading.value).toBe(false);
		expect(loaded.value).toBe(true);
	});
});
