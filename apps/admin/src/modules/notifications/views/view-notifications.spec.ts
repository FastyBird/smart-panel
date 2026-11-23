import type { Ref } from 'vue';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { enableAutoUnmount, flushPromises, mount } from '@vue/test-utils';

import { NotificationsModuleNotificationKind, NotificationsModuleNotificationSeverity } from '../../../openapi.constants';
import { RouteNames } from '../notifications.constants';
import type { INotificationsFilter } from '../schemas/list.schemas';
import type { INotification } from '../store/notifications.store.schemas';

import ViewNotifications from './view-notifications.vue';

// The route is shared by every mount, so a view left mounted would keep acting on the next test's navigation
enableAutoUnmount(afterEach);

const mocks = vi.hoisted(() => ({
	markRead: vi.fn(),
	markAllRead: vi.fn(),
	markEverythingRead: vi.fn(),
	dismiss: vi.fn(),
	remove: vi.fn(),
	bulkMarkUnread: vi.fn(),
	bulkDismiss: vi.fn(),
	bulkRemove: vi.fn(),
	fetchNotifications: vi.fn(),
	loadMoreNotifications: vi.fn(),
	resetFilters: vi.fn(),
	routerPush: vi.fn(),
	storeGet: vi.fn(),
	unreadCount: 0,
	// Assigned by the mock factories below, which are the first place `ref` and `reactive` are available
	notifications: null as unknown as Ref<INotification[]>,
	filters: null as unknown as Ref<INotificationsFilter>,
	stored: null as unknown as Ref<INotification[]>,
	isPhone: null as unknown as Ref<boolean>,
	isTabletPortrait: null as unknown as Ref<boolean>,
	route: null as unknown as { name: string; params: Record<string, string>; query: Record<string, string> },
}));

vi.mock('vue-i18n', () => ({
	useI18n: () => ({ t: (key: string) => key, locale: { value: 'en-US' } }),
}));

vi.mock('vue-meta', () => ({
	useMeta: () => ({ meta: {} }),
}));

vi.mock('vue-router', async () => {
	const { reactive: vueReactive } = await import('vue');

	mocks.route = vueReactive({ name: 'notifications_module-notifications', params: {}, query: { status: 'all' } });

	return {
		useRoute: () => mocks.route,
		useRouter: () => ({
			push: mocks.routerPush,
			resolve: (to: unknown) => to,
		}),
	};
});

vi.mock('../../../common', async () => {
	const { defineComponent: defineVueComponent, h, ref: vueRef } = await import('vue');

	mocks.isPhone = vueRef(false);
	mocks.isTabletPortrait = vueRef(false);
	mocks.stored = vueRef<INotification[]>([]);

	return {
		AppBreadcrumbs: defineVueComponent({ name: 'AppBreadcrumbs', setup: () => () => h('nav') }),
		ViewHeader: defineVueComponent({
			name: 'ViewHeader',
			props: ['title', 'subtitle', 'icon', 'actions'],
			setup:
				(_, { slots }) =>
				() =>
					h('header', slots.actions?.()),
		}),
		StateView: defineVueComponent({ name: 'StateView', props: ['kind', 'title', 'icon'], setup: () => () => h('div') }),
		useSizeClass: () => ({ isPhone: mocks.isPhone, isTabletPortrait: mocks.isTabletPortrait }),
		injectStoresManager: () => ({
			getStore: () => ({
				findById: (id: string) => mocks.stored.value.find((item) => item.id === id) ?? null,
				unreadCount: () => mocks.unreadCount,
				get: mocks.storeGet,
			}),
		}),
	};
});

// The filter bar and the list are stubbed so the tests can fire their events directly; their own specs cover the markup
vi.mock('../components/notifications-filter.vue', async () => {
	const { defineComponent: defineVueComponent, h } = await import('vue');

	return {
		default: defineVueComponent({
			name: 'NotificationsFilter',
			props: ['filters', 'filtersActive', 'selectedCount'],
			emits: ['update:filters', 'reset-filters', 'bulk-action', 'clear-selection'],
			setup: () => () => h('div'),
		}),
	};
});

vi.mock('../components/notifications-inbox-list.vue', async () => {
	const { defineComponent: defineVueComponent, h } = await import('vue');

	return {
		default: defineVueComponent({
			name: 'NotificationsInboxList',
			props: ['items', 'activeId', 'selectedIds', 'loading', 'filtersActive', 'hasMore'],
			emits: ['open', 'load-more', 'reset-filters', 'update:selected-ids'],
			setup: () => () => h('div'),
		}),
	};
});

vi.mock('../composables/composables', async () => {
	const { ref: vueRef } = await import('vue');

	mocks.notifications = vueRef<INotification[]>([]);
	mocks.filters = vueRef<INotificationsFilter>({ status: 'all', severity: [], source: undefined, unread: false });

	return {
		useNotificationsActions: () => ({
			markRead: mocks.markRead,
			markAllRead: mocks.markAllRead,
			markEverythingRead: mocks.markEverythingRead,
			dismiss: mocks.dismiss,
			remove: mocks.remove,
			bulkMarkUnread: mocks.bulkMarkUnread,
			bulkDismiss: mocks.bulkDismiss,
			bulkRemove: mocks.bulkRemove,
		}),
		useNotificationsDataSource: () => ({
			notifications: mocks.notifications,
			hasMore: vueRef(false),
			areLoading: vueRef(false),
			filters: mocks.filters,
			filtersActive: vueRef(false),
			fetchNotifications: mocks.fetchNotifications,
			loadMoreNotifications: mocks.loadMoreNotifications,
			resetFilters: mocks.resetFilters,
		}),
	};
});

vi.mock('../notifications.exceptions', () => ({
	NotificationsException: Error,
}));

const notification = (overrides: Partial<INotification> = {}): INotification => ({
	id: 'a1111111-1111-4111-8111-111111111111',
	source: 'system-module',
	kind: NotificationsModuleNotificationKind.issue,
	key: 'update-available',
	severity: NotificationsModuleNotificationSeverity.warning,
	title: 'Update 2.4.0 is available',
	message: null,
	actions: [],
	data: null,
	persistent: false,
	occurrences: 1,
	readAt: null,
	dismissedAt: null,
	resolvedAt: null,
	createdAt: new Date('2026-01-01T00:00:00.000Z'),
	updatedAt: null,
	...overrides,
});

// The detail route's view, as the router would render it into the inbox
const DetailStub = {
	name: 'ViewNotification',
	props: ['notification', 'loading', 'inPane'],
	emits: ['mark-read', 'dismiss', 'remove'],
	template: '<div />',
};

const RouterViewStub = {
	name: 'RouterView',
	setup(_: unknown, { slots }: { slots: { default?: (scope: { Component: unknown }) => unknown } }) {
		return () => slots.default?.({ Component: mocks.route.name === RouteNames.NOTIFICATION ? DetailStub : undefined });
	},
};

const mountView = () =>
	mount(ViewNotifications, { global: { stubs: { RouterView: RouterViewStub, ElButton: { template: '<button><slot /></button>' } } } });

const openDetail = (id: string): void => {
	mocks.route.name = RouteNames.NOTIFICATION;
	mocks.route.params = { id };
};

// The initial `onBeforeMount` load also calls `fetchNotifications` - cleared after mount so each assertion below only
// counts the refetch (or lack of one) the action under test caused
const mountAndClearInitialFetch = async (): Promise<ReturnType<typeof mountView>> => {
	const wrapper = mountView();

	await flushPromises();

	mocks.fetchNotifications.mockClear();
	mocks.markRead.mockClear();

	return wrapper;
};

const select = async (wrapper: ReturnType<typeof mountView>, ids: string[]): Promise<void> => {
	wrapper.findComponent({ name: 'NotificationsInboxList' }).vm.$emit('update:selected-ids', ids);
	await flushPromises();
};

const bulk = (wrapper: ReturnType<typeof mountView>, action: string): void => {
	wrapper.findComponent({ name: 'NotificationsFilter' }).vm.$emit('bulk-action', action);
};

const detail = (wrapper: ReturnType<typeof mountView>) => wrapper.findComponent({ name: 'ViewNotification' });

describe('ViewNotifications', () => {
	beforeEach(() => {
		vi.clearAllMocks();

		mocks.fetchNotifications.mockResolvedValue(undefined);
		mocks.markRead.mockResolvedValue(undefined);
		mocks.dismiss.mockResolvedValue(undefined);
		mocks.remove.mockResolvedValue(undefined);
		mocks.storeGet.mockResolvedValue(undefined);
		mocks.notifications.value = [];
		mocks.stored.value = [];
		mocks.unreadCount = 0;
		mocks.filters.value = { status: 'all', severity: [], source: undefined, unread: false };
		mocks.isPhone.value = false;
		mocks.isTabletPortrait.value = false;
		mocks.route.name = RouteNames.NOTIFICATIONS;
		mocks.route.params = {};
	});

	describe('layout (template 7)', () => {
		it('shows the list and the detail side by side from tablet landscape, with a placeholder until one is open', async () => {
			const wrapper = await mountAndClearInitialFetch();

			expect(wrapper.find('[data-test-id="notifications-two-pane"]').exists()).toBe(true);
			expect(wrapper.findComponent({ name: 'NotificationsInboxList' }).exists()).toBe(true);
			expect(wrapper.find('[data-test-id="notifications-no-selection"]').exists()).toBe(true);
		});

		it('hands the open notification to the detail in the right pane', async () => {
			const row = notification();

			mocks.stored.value = [row];
			openDetail(row.id);

			const wrapper = await mountAndClearInitialFetch();

			expect(detail(wrapper).props('notification')).toEqual(row);
			expect(detail(wrapper).props('inPane')).not.toBe(false);
			expect(wrapper.findComponent({ name: 'NotificationsInboxList' }).props('activeId')).toBe(row.id);
		});

		it.each([
			['phone', true, false],
			['tablet portrait', false, true],
		])('shows the list, then the detail as its own page on %s', async (_label, phone, portrait) => {
			mocks.isPhone.value = phone;
			mocks.isTabletPortrait.value = portrait;

			const wrapper = await mountAndClearInitialFetch();

			expect(wrapper.find('[data-test-id="notifications-two-pane"]').exists()).toBe(false);
			expect(wrapper.findComponent({ name: 'NotificationsInboxList' }).exists()).toBe(true);

			openDetail(notification().id);
			await flushPromises();

			expect(wrapper.findComponent({ name: 'NotificationsInboxList' }).exists()).toBe(false);
			expect(detail(wrapper).exists()).toBe(true);
			expect(detail(wrapper).props('inPane')).toBeUndefined();
		});

		it('opens a row on the detail route and keeps the list filters in the query', async () => {
			const wrapper = await mountAndClearInitialFetch();

			wrapper.findComponent({ name: 'NotificationsInboxList' }).vm.$emit('open', 'n1');

			expect(mocks.routerPush).toHaveBeenCalledWith({ name: RouteNames.NOTIFICATION, params: { id: 'n1' }, query: { status: 'all' } });
		});
	});

	describe('opening a notification', () => {
		it('marks an unread notification read when it opens', async () => {
			const row = notification();

			mocks.stored.value = [row];
			openDetail(row.id);

			mountView();
			await flushPromises();

			expect(mocks.markRead).toHaveBeenCalledWith(row.id, true);
		});

		it('reads the list again under "Unread only", so the opened row leaves it', async () => {
			const row = notification();

			mocks.stored.value = [row];
			mocks.filters.value.unread = true;
			openDetail(row.id);

			mountView();
			await flushPromises();

			expect(mocks.markRead).toHaveBeenCalledWith(row.id, true);
			// The initial load, then the read after marking
			expect(mocks.fetchNotifications).toHaveBeenCalledTimes(2);
		});

		it('reads the "Unread only" list again when the bell already read the row it opens', async () => {
			const row = notification({ readAt: new Date('2026-01-02T00:00:00.000Z') });

			mocks.stored.value = [row];
			mocks.notifications.value = [row];
			mocks.filters.value.unread = true;
			openDetail(row.id);

			mountView();
			await flushPromises();

			expect(mocks.markRead).not.toHaveBeenCalled();
			// The initial load, then the read for the row that no longer matches
			expect(mocks.fetchNotifications).toHaveBeenCalledTimes(2);
		});

		it('keeps loading for the notification now open when an earlier read comes back first', async () => {
			const first = notification({ id: 'b2222222-2222-4222-8222-222222222222' });
			const second = notification({ id: 'c3333333-3333-4333-8333-333333333333' });
			const pending: Record<string, () => void> = {};

			mocks.storeGet.mockImplementation(
				({ id }: { id: string }) =>
					new Promise<void>((resolve) => {
						pending[id] = (): void => {
							mocks.stored.value = [...mocks.stored.value, id === first.id ? first : second];
							resolve();
						};
					})
			);

			openDetail(first.id);

			const wrapper = mountView();
			await flushPromises();

			openDetail(second.id);
			await flushPromises();

			pending[first.id]();
			await flushPromises();

			expect(detail(wrapper).props('loading')).toBe(true);
			expect(mocks.markRead).not.toHaveBeenCalledWith(first.id, true);

			pending[second.id]();
			await flushPromises();

			expect(detail(wrapper).props('loading')).toBe(false);
			expect(detail(wrapper).props('notification')).toEqual(second);
		});

		it('leaves a read notification alone', async () => {
			const row = notification({ readAt: new Date('2026-01-02T00:00:00.000Z') });

			mocks.stored.value = [row];
			openDetail(row.id);

			mountView();
			await flushPromises();

			expect(mocks.markRead).not.toHaveBeenCalled();
		});

		it('reads a notification the list does not hold from the backend, as the bell can open one', async () => {
			const row = notification();

			mocks.storeGet.mockImplementation(async (): Promise<void> => {
				mocks.stored.value = [row];
			});
			openDetail(row.id);

			const wrapper = mountView();
			await flushPromises();

			expect(mocks.storeGet).toHaveBeenCalledWith({ id: row.id });
			expect(detail(wrapper).props('notification')).toEqual(row);
			expect(mocks.markRead).toHaveBeenCalledWith(row.id, true);
		});
	});

	describe('mark all as read', () => {
		it('disables the header button with nothing unread', async () => {
			const wrapper = await mountAndClearInitialFetch();

			expect(wrapper.find('[data-test-id="mark-all-notifications-read"]').attributes('disabled')).toBeDefined();
		});

		it('disables the phone app bar action the same way', async () => {
			const wrapper = await mountAndClearInitialFetch();
			const [action] = wrapper.findComponent({ name: 'ViewHeader' }).props('actions') as { disabled?: boolean }[];

			expect(action.disabled).toBe(true);
		});

		it('enables the phone app bar action once something is unread', async () => {
			mocks.unreadCount = 1;

			const wrapper = await mountAndClearInitialFetch();
			const [action] = wrapper.findComponent({ name: 'ViewHeader' }).props('actions') as { disabled?: boolean }[];

			expect(action.disabled).toBe(false);
		});

		it('marks everything read from the header', async () => {
			mocks.markEverythingRead.mockResolvedValue(true);
			mocks.unreadCount = 2;

			const wrapper = await mountAndClearInitialFetch();

			await wrapper.find('[data-test-id="mark-all-notifications-read"]').trigger('click');
			await flushPromises();

			expect(mocks.markEverythingRead).toHaveBeenCalledTimes(1);
			// Nothing filtered to unread, so the rows stay where they are
			expect(mocks.fetchNotifications).not.toHaveBeenCalled();
		});

		it('reads the list again under "Unread only", where the rows just read no longer match', async () => {
			mocks.markEverythingRead.mockResolvedValue(true);
			mocks.unreadCount = 2;
			mocks.filters.value.unread = true;

			const wrapper = await mountAndClearInitialFetch();

			await wrapper.find('[data-test-id="mark-all-notifications-read"]').trigger('click');
			await flushPromises();

			expect(mocks.fetchNotifications).toHaveBeenCalledTimes(1);
		});
	});

	describe('bulk actions', () => {
		it('runs the action on the selected rows, refetches and clears the selection once it mutated', async () => {
			mocks.bulkDismiss.mockResolvedValue('mutated');

			const wrapper = await mountAndClearInitialFetch();

			await select(wrapper, ['1', '2']);

			expect(wrapper.findComponent({ name: 'NotificationsFilter' }).props('selectedCount')).toBe(2);

			bulk(wrapper, 'dismiss');
			await flushPromises();

			expect(mocks.bulkDismiss).toHaveBeenCalledWith(['1', '2']);
			expect(mocks.fetchNotifications).toHaveBeenCalledTimes(1);
			expect(wrapper.findComponent({ name: 'NotificationsFilter' }).props('selectedCount')).toBe(0);
		});

		it.each([
			['delete', 'bulkRemove', 'cancelled'],
			['mark-unread', 'bulkMarkUnread', 'failed'],
		])('does not refetch after %s comes back %s', async (action, mock, outcome) => {
			(mocks[mock as 'bulkRemove'] as ReturnType<typeof vi.fn>).mockResolvedValue(outcome);

			const wrapper = await mountAndClearInitialFetch();

			await select(wrapper, ['1']);
			bulk(wrapper, action);
			await flushPromises();

			expect(mocks.fetchNotifications).not.toHaveBeenCalled();
		});

		it('refetches when marking the selection read reports a mutation through its boolean outcome', async () => {
			mocks.markAllRead.mockResolvedValue(true);

			const wrapper = await mountAndClearInitialFetch();

			await select(wrapper, ['1']);
			bulk(wrapper, 'mark-read');
			await flushPromises();

			expect(mocks.markAllRead).toHaveBeenCalledWith(['1']);
			expect(mocks.fetchNotifications).toHaveBeenCalledTimes(1);
		});

		it('returns to the list when a bulk delete takes the open notification with it', async () => {
			const row = notification({ readAt: new Date('2026-01-02T00:00:00.000Z') });

			mocks.stored.value = [row];
			mocks.bulkRemove.mockImplementation(async (): Promise<string> => {
				mocks.stored.value = [];

				return 'mutated';
			});
			openDetail(row.id);

			const wrapper = await mountAndClearInitialFetch();

			await select(wrapper, [row.id]);
			bulk(wrapper, 'delete');
			await flushPromises();

			expect(mocks.routerPush).toHaveBeenCalledWith({ name: RouteNames.NOTIFICATIONS, query: { status: 'all' } });
		});

		it('stays on the open notification when a bulk delete leaves it', async () => {
			const row = notification({ readAt: new Date('2026-01-02T00:00:00.000Z') });

			mocks.stored.value = [row];
			mocks.bulkRemove.mockResolvedValue('mutated');
			openDetail(row.id);

			const wrapper = await mountAndClearInitialFetch();

			await select(wrapper, ['other']);
			bulk(wrapper, 'delete');
			await flushPromises();

			expect(mocks.routerPush).not.toHaveBeenCalled();
		});

		it('drops a selection when the filters change', async () => {
			const wrapper = await mountAndClearInitialFetch();

			await select(wrapper, ['1']);

			mocks.filters.value = { ...mocks.filters.value, status: 'dismissed' };
			await flushPromises();

			expect(wrapper.findComponent({ name: 'NotificationsFilter' }).props('selectedCount')).toBe(0);
		});

		it('clears the selection from the filter bar', async () => {
			const wrapper = await mountAndClearInitialFetch();

			await select(wrapper, ['1']);

			wrapper.findComponent({ name: 'NotificationsFilter' }).vm.$emit('clear-selection');
			await flushPromises();

			expect(wrapper.findComponent({ name: 'NotificationsFilter' }).props('selectedCount')).toBe(0);
		});
	});

	describe('detail actions', () => {
		const row = notification({ readAt: new Date('2026-01-02T00:00:00.000Z') });

		beforeEach(() => {
			mocks.stored.value = [row];
			openDetail(row.id);
		});

		it('resets the filters through the data source', async () => {
			const wrapper = await mountAndClearInitialFetch();

			wrapper.findComponent({ name: 'NotificationsFilter' }).vm.$emit('reset-filters');

			expect(mocks.resetFilters).toHaveBeenCalledTimes(1);
		});

		it('refetches after a dismissal under the active filter once the row really was dismissed', async () => {
			mocks.filters.value.status = 'active';
			mocks.notifications.value = [row];
			mocks.dismiss.mockImplementation(async (): Promise<void> => {
				mocks.notifications.value = [{ ...row, dismissedAt: new Date('2026-01-03T00:00:00.000Z') }];
			});

			const wrapper = await mountAndClearInitialFetch();

			detail(wrapper).vm.$emit('dismiss', row.id);
			await flushPromises();

			expect(mocks.dismiss).toHaveBeenCalledWith(row.id, true);
			expect(mocks.fetchNotifications).toHaveBeenCalledTimes(1);
		});

		it('does not refetch a dismissal the operator cancelled', async () => {
			mocks.filters.value.status = 'active';
			mocks.notifications.value = [row];

			const wrapper = await mountAndClearInitialFetch();

			detail(wrapper).vm.$emit('dismiss', row.id);
			await flushPromises();

			expect(mocks.fetchNotifications).not.toHaveBeenCalled();
		});

		it('refetches after marking a row read under the unread-only filter', async () => {
			mocks.filters.value.unread = true;

			const wrapper = await mountAndClearInitialFetch();

			detail(wrapper).vm.$emit('mark-read', row.id, true);
			await flushPromises();

			expect(mocks.markRead).toHaveBeenCalledWith(row.id, true);
			expect(mocks.fetchNotifications).toHaveBeenCalledTimes(1);
		});

		it('marks a row unread without a refetch - it can only gain a place in the unread list', async () => {
			mocks.filters.value.unread = true;

			const wrapper = await mountAndClearInitialFetch();

			detail(wrapper).vm.$emit('mark-read', row.id, false);
			await flushPromises();

			expect(mocks.markRead).toHaveBeenCalledWith(row.id, false);
			expect(mocks.fetchNotifications).not.toHaveBeenCalled();
		});

		it('returns to the list once the open notification is removed, without a refetch', async () => {
			mocks.remove.mockImplementation(async (): Promise<void> => {
				mocks.stored.value = [];
			});

			const wrapper = await mountAndClearInitialFetch();

			detail(wrapper).vm.$emit('remove', row.id);
			await flushPromises();

			expect(mocks.remove).toHaveBeenCalledWith(row.id);
			expect(mocks.fetchNotifications).not.toHaveBeenCalled();
			expect(mocks.routerPush).toHaveBeenCalledWith({ name: RouteNames.NOTIFICATIONS, query: { status: 'all' } });
		});

		it('stays on the notification when its removal was cancelled', async () => {
			const wrapper = await mountAndClearInitialFetch();

			detail(wrapper).vm.$emit('remove', row.id);
			await flushPromises();

			expect(mocks.routerPush).not.toHaveBeenCalled();
		});
	});
});
