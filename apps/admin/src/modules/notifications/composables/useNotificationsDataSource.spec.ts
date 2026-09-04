import { type Ref, nextTick, ref } from 'vue';

import { createPinia, setActivePinia } from 'pinia';

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { flushPromises } from '@vue/test-utils';

import { injectStoresManager, useListQuery } from '../../../common';
import { NotificationsModuleNotificationSeverity } from '../../../openapi.constants';
import type { INotificationsFilter } from '../schemas/list.schemas';

import { defaultNotificationsFilter, useNotificationsDataSource } from './useNotificationsDataSource';

const { mockFlashError } = vi.hoisted(() => ({ mockFlashError: vi.fn() }));

vi.mock('../../../common', () => ({
	injectStoresManager: vi.fn(),
	useListQuery: vi.fn(),
	useFlashMessage: () => ({
		success: vi.fn(),
		info: vi.fn(),
		warning: vi.fn(),
		error: mockFlashError,
	}),
}));

vi.mock('vue-i18n', () => ({
	useI18n: () => ({ t: (key: string) => key }),
}));

const mockFetch = vi.fn();
const mockReset = vi.fn();

describe('useNotificationsDataSource', () => {
	let mockStore: {
		list: ReturnType<typeof vi.fn>;
		fetch: ReturnType<typeof vi.fn>;
		semaphore: Ref<{ fetching: { items: boolean } }>;
		firstLoad: Ref<boolean>;
		hasMore: Ref<boolean>;
		nextCursor: Ref<string | undefined>;
	};

	let filters: Ref<INotificationsFilter>;

	beforeEach(() => {
		setActivePinia(createPinia());

		mockFetch.mockReset().mockResolvedValue([]);

		mockStore = {
			list: vi.fn(() => []),
			fetch: mockFetch,
			semaphore: ref({ fetching: { items: false } }),
			firstLoad: ref(true),
			hasMore: ref(false),
			nextCursor: ref(undefined),
		};

		(injectStoresManager as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
			getStore: () => mockStore,
		});

		filters = ref<INotificationsFilter>({ ...defaultNotificationsFilter });

		mockReset.mockReset();

		(useListQuery as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
			filters,
			reset: mockReset,
		});
	});

	describe('filtersActive', () => {
		it('is off while every filter sits at its rest state', () => {
			const { filtersActive } = useNotificationsDataSource();

			expect(filtersActive.value).toBe(false);
		});

		it.each([
			['status', { status: 'active' }],
			['severity', { severity: [NotificationsModuleNotificationSeverity.error] }],
			['source', { source: 'system-module' }],
			['unread', { unread: true }],
		] as const)('turns on once the %s filter constrains the request', (_name, change) => {
			const { filtersActive } = useNotificationsDataSource();

			filters.value = { ...defaultNotificationsFilter, ...change };

			expect(filtersActive.value).toBe(true);
		});

		it('treats a cleared source select as no constraint', () => {
			const { filtersActive } = useNotificationsDataSource();

			filters.value = { ...defaultNotificationsFilter, source: '' };

			expect(filtersActive.value).toBe(false);
		});
	});

	it('resetFilters hands the reset to the list query, which owns the defaults', () => {
		const { resetFilters } = useNotificationsDataSource();

		resetFilters();

		expect(mockReset).toHaveBeenCalledTimes(1);
	});

	it('does not fetch on its own when created - the caller triggers the first load', () => {
		useNotificationsDataSource();

		expect(mockFetch).not.toHaveBeenCalled();
	});

	it('fetchNotifications forwards the active filters and resets the list (append: false)', async () => {
		filters.value = {
			status: 'active',
			severity: [NotificationsModuleNotificationSeverity.error],
			source: 'system-module',
			unread: true,
		};

		const { fetchNotifications } = useNotificationsDataSource();

		await fetchNotifications();

		expect(mockFetch).toHaveBeenCalledWith({
			status: 'active',
			severity: [NotificationsModuleNotificationSeverity.error],
			source: 'system-module',
			unread: true,
			append: false,
		});
	});

	it('omits default filter values from the request instead of sending them literally', async () => {
		const { fetchNotifications } = useNotificationsDataSource();

		await fetchNotifications();

		expect(mockFetch).toHaveBeenCalledWith({
			status: undefined,
			severity: undefined,
			source: undefined,
			unread: undefined,
			append: false,
		});
	});

	it('refetches with append: false whenever a filter changes', async () => {
		useNotificationsDataSource();

		filters.value = { ...filters.value, source: 'devices-home-assistant-plugin' };

		await nextTick();
		await nextTick();

		expect(mockFetch).toHaveBeenCalledWith(expect.objectContaining({ source: 'devices-home-assistant-plugin', append: false }));
	});

	it('loadMoreNotifications fetches the next page with append: true while hasMore is true', async () => {
		mockStore.hasMore.value = true;
		mockStore.nextCursor.value = 'cursor-123';

		const { loadMoreNotifications } = useNotificationsDataSource();

		await loadMoreNotifications();

		expect(mockFetch).toHaveBeenCalledWith(expect.objectContaining({ afterId: 'cursor-123', append: true }));
	});

	it('loadMoreNotifications does nothing once hasMore is false', async () => {
		mockStore.hasMore.value = false;

		const { loadMoreNotifications } = useNotificationsDataSource();

		await loadMoreNotifications();

		expect(mockFetch).not.toHaveBeenCalled();
	});

	it('reflects the store loading state', () => {
		mockStore.semaphore.value.fetching.items = true;

		const { areLoading } = useNotificationsDataSource();

		expect(areLoading.value).toBe(true);
	});

	it('reads notifications from the store list ordering', () => {
		const rows = [{ id: '1' }, { id: '2' }];
		mockStore.list.mockReturnValue(rows);

		const { notifications } = useNotificationsDataSource();

		expect(notifications.value).toBe(rows);
	});

	// Previously `fetchNotifications().catch((): void => undefined)` inside the filters watcher -
	// a failed request left the table showing the previous filter's rows with nothing telling the
	// operator the new filter never actually applied.
	it('flashes an error when a filter-triggered fetch fails, instead of leaving the table silently stale', async () => {
		mockFetch.mockRejectedValueOnce(new Error('network down'));

		useNotificationsDataSource();

		filters.value = { ...filters.value, source: 'devices-home-assistant-plugin' };

		await flushPromises();

		expect(mockFlashError).toHaveBeenCalled();
	});
});
