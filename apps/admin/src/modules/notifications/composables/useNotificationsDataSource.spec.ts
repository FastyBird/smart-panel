import { type Ref, nextTick, ref } from 'vue';

import { createPinia, setActivePinia } from 'pinia';

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { injectStoresManager, useListQuery } from '../../../common';
import { NotificationsModuleNotificationSeverity } from '../../../openapi.constants';
import type { INotificationsFilter } from '../schemas/list.schemas';

import { defaultNotificationsFilter, useNotificationsDataSource } from './useNotificationsDataSource';

vi.mock('../../../common', () => ({
	injectStoresManager: vi.fn(),
	useListQuery: vi.fn(),
}));

const mockFetch = vi.fn();

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

		(useListQuery as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
			filters,
			reset: vi.fn(),
		});
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
});
