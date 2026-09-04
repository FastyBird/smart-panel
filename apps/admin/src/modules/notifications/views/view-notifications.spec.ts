import type { Ref } from 'vue';

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { flushPromises, mount } from '@vue/test-utils';

import { NotificationsModuleNotificationKind, NotificationsModuleNotificationSeverity } from '../../../openapi.constants';
import { ListNotifications, NotificationDetailDrawer } from '../components/components';
import type { INotificationsFilter } from '../schemas/list.schemas';
import type { INotification } from '../store/notifications.store.schemas';

import ViewNotifications from './view-notifications.vue';

const mocks = vi.hoisted(() => ({
	markRead: vi.fn(),
	markAllRead: vi.fn(),
	dismiss: vi.fn(),
	remove: vi.fn(),
	bulkMarkUnread: vi.fn(),
	bulkDismiss: vi.fn(),
	bulkRemove: vi.fn(),
	fetchNotifications: vi.fn(),
	loadMoreNotifications: vi.fn(),
	resetFilters: vi.fn(),
	routerPush: vi.fn(),
	// Assigned by the composables mock factory below, which is the first place `ref` is available.
	notifications: null as unknown as Ref<INotification[]>,
	filters: null as unknown as Ref<INotificationsFilter>,
}));

vi.mock('vue-i18n', () => ({
	useI18n: () => ({ t: (key: string) => key }),
}));

vi.mock('vue-meta', () => ({
	useMeta: () => ({ meta: {} }),
}));

vi.mock('vue-router', () => ({
	useRouter: () => ({
		push: mocks.routerPush,
		resolve: (to: unknown) => to,
	}),
}));

vi.mock('../../../common', async () => {
	const { defineComponent: defineVueComponent, h, ref: vueRef } = await import('vue');

	const StubComponent = defineVueComponent({
		setup(_, { slots }) {
			return () => h('div', [slots.default?.(), slots.icon?.(), slots.title?.(), slots.subtitle?.()]);
		},
	});

	return {
		AppBarButton: StubComponent,
		AppBarButtonAlign: { LEFT: 'left', RIGHT: 'right', BACK: 'back', NONE: 'none' },
		AppBarHeading: StubComponent,
		AppBreadcrumbs: StubComponent,
		ViewHeader: StubComponent,
		useBreakpoints: () => ({
			isMDDevice: vueRef(true),
			isLGDevice: vueRef(true),
		}),
	};
});

// `ListNotifications` and `NotificationDetailDrawer` are stubbed so the tests can fire their events
// directly, without depending on the real table/toolbar/drawer markup - that wiring is covered by
// the components' own specs.
vi.mock('../components/components', async () => {
	const { defineComponent: defineVueComponent } = await import('vue');

	return {
		ListNotifications: defineVueComponent({
			name: 'ListNotifications',
			props: {
				items: { type: Array, default: () => [] },
				filters: { type: Object, default: () => ({}) },
				filtersActive: { type: Boolean, default: false },
				hasMore: { type: Boolean, default: false },
				loading: { type: Boolean, default: false },
			},
			emits: ['detail', 'dismiss', 'remove', 'load-more', 'reset-filters', 'update:filters', 'bulk-action'],
			template: '<div />',
		}),
		NotificationDetailDrawer: defineVueComponent({
			name: 'NotificationDetailDrawer',
			props: {
				modelValue: { type: Boolean, default: false },
				notification: { type: Object, default: null },
			},
			emits: ['update:modelValue', 'mark-read', 'dismiss', 'remove'],
			template: '<div />',
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

const mountView = () => mount(ViewNotifications);

const emitFromList = (wrapper: ReturnType<typeof mountView>, event: string, ...args: unknown[]): void => {
	wrapper.findComponent(ListNotifications).vm.$emit(event, ...args);
};

// The initial `onBeforeMount` load also calls `fetchNotifications` - cleared after mount so each
// assertion below only counts the refetch (or lack of one) triggered by the action under test.
const mountAndClearInitialFetch = async (): Promise<ReturnType<typeof mountView>> => {
	const wrapper = mountView();

	await flushPromises();

	mocks.fetchNotifications.mockClear();

	return wrapper;
};

describe('ViewNotifications', () => {
	beforeEach(() => {
		vi.clearAllMocks();

		mocks.fetchNotifications.mockResolvedValue(undefined);
		mocks.markRead.mockResolvedValue(undefined);
		mocks.dismiss.mockResolvedValue(undefined);
		mocks.remove.mockResolvedValue(undefined);
		mocks.notifications.value = [];
		mocks.filters.value = { status: 'all', severity: [], source: undefined, unread: false };
	});

	describe('bulk actions', () => {
		it('refetches after a bulk action that fully mutated the selection', async () => {
			mocks.bulkDismiss.mockResolvedValue('mutated');

			const wrapper = await mountAndClearInitialFetch();

			emitFromList(wrapper, 'bulk-action', 'dismiss', ['1', '2']);

			await flushPromises();

			expect(mocks.bulkDismiss).toHaveBeenCalledWith(['1', '2']);
			expect(mocks.fetchNotifications).toHaveBeenCalledTimes(1);
		});

		it('refetches after a bulk action that only partially mutated the selection', async () => {
			// `bulkDismiss`/`bulkMarkUnread`/`bulkRemove` already report a partial success as
			// 'mutated' themselves (see useNotificationsActions.spec.ts) - this confirms the view
			// still refetches for that outcome rather than treating it as a failure.
			mocks.bulkRemove.mockResolvedValue('mutated');

			const wrapper = await mountAndClearInitialFetch();

			emitFromList(wrapper, 'bulk-action', 'delete', ['1', '2']);

			await flushPromises();

			expect(mocks.fetchNotifications).toHaveBeenCalledTimes(1);
		});

		it('does not refetch after a cancelled bulk action', async () => {
			mocks.bulkRemove.mockResolvedValue('cancelled');

			const wrapper = await mountAndClearInitialFetch();

			emitFromList(wrapper, 'bulk-action', 'delete', ['1']);

			await flushPromises();

			expect(mocks.fetchNotifications).not.toHaveBeenCalled();
		});

		it('does not refetch after a bulk action that failed outright', async () => {
			mocks.bulkMarkUnread.mockResolvedValue('failed');

			const wrapper = await mountAndClearInitialFetch();

			emitFromList(wrapper, 'bulk-action', 'mark-unread', ['1']);

			await flushPromises();

			expect(mocks.fetchNotifications).not.toHaveBeenCalled();
		});

		it('refetches when markAllRead reports a mutation through its boolean outcome', async () => {
			mocks.markAllRead.mockResolvedValue(true);

			const wrapper = await mountAndClearInitialFetch();

			emitFromList(wrapper, 'bulk-action', 'mark-read', ['1']);

			await flushPromises();

			expect(mocks.fetchNotifications).toHaveBeenCalledTimes(1);
		});

		it('does not refetch when markAllRead reports no mutation', async () => {
			mocks.markAllRead.mockResolvedValue(false);

			const wrapper = await mountAndClearInitialFetch();

			emitFromList(wrapper, 'bulk-action', 'mark-read', ['1']);

			await flushPromises();

			expect(mocks.fetchNotifications).not.toHaveBeenCalled();
		});
	});

	describe('single row actions', () => {
		const row = notification();

		it('resets the filters through the data source', async () => {
			const wrapper = await mountAndClearInitialFetch();

			emitFromList(wrapper, 'reset-filters');

			expect(mocks.resetFilters).toHaveBeenCalledTimes(1);
		});

		it('refetches after a dismissal under the active filter once the row really was dismissed', async () => {
			mocks.filters.value.status = 'active';
			mocks.notifications.value = [row];
			mocks.dismiss.mockImplementation(async (): Promise<void> => {
				mocks.notifications.value = [{ ...row, dismissedAt: new Date('2026-01-02T00:00:00.000Z') }];
			});

			const wrapper = await mountAndClearInitialFetch();

			emitFromList(wrapper, 'dismiss', row.id);

			await flushPromises();

			expect(mocks.dismiss).toHaveBeenCalledWith(row.id, true);
			expect(mocks.fetchNotifications).toHaveBeenCalledTimes(1);
		});

		it('does not refetch a dismissal the operator cancelled', async () => {
			mocks.filters.value.status = 'active';
			mocks.notifications.value = [row];

			const wrapper = await mountAndClearInitialFetch();

			emitFromList(wrapper, 'dismiss', row.id);

			await flushPromises();

			expect(mocks.dismiss).toHaveBeenCalledWith(row.id, true);
			expect(mocks.fetchNotifications).not.toHaveBeenCalled();
		});

		it('does not refetch a dismissal when the list is not restricted to active rows', async () => {
			mocks.notifications.value = [row];
			mocks.dismiss.mockImplementation(async (): Promise<void> => {
				mocks.notifications.value = [{ ...row, dismissedAt: new Date('2026-01-02T00:00:00.000Z') }];
			});

			const wrapper = await mountAndClearInitialFetch();

			emitFromList(wrapper, 'dismiss', row.id);

			await flushPromises();

			expect(mocks.fetchNotifications).not.toHaveBeenCalled();
		});

		it('refetches after marking a row read under the unread-only filter', async () => {
			mocks.filters.value.unread = true;

			const wrapper = await mountAndClearInitialFetch();

			wrapper.findComponent(NotificationDetailDrawer).vm.$emit('mark-read', row.id, true);

			await flushPromises();

			expect(mocks.markRead).toHaveBeenCalledWith(row.id, true);
			expect(mocks.fetchNotifications).toHaveBeenCalledTimes(1);
		});

		it('does not refetch after marking a row unread - it can only gain a place in the unread list', async () => {
			mocks.filters.value.unread = true;

			const wrapper = await mountAndClearInitialFetch();

			wrapper.findComponent(NotificationDetailDrawer).vm.$emit('mark-read', row.id, false);

			await flushPromises();

			expect(mocks.markRead).toHaveBeenCalledWith(row.id, false);
			expect(mocks.fetchNotifications).not.toHaveBeenCalled();
		});

		it('never refetches after a removal - the store drops the row from the list itself', async () => {
			mocks.filters.value.status = 'active';

			const wrapper = await mountAndClearInitialFetch();

			emitFromList(wrapper, 'remove', row.id);

			await flushPromises();

			expect(mocks.remove).toHaveBeenCalledWith(row.id);
			expect(mocks.fetchNotifications).not.toHaveBeenCalled();
		});
	});

	describe('detail drawer', () => {
		it('opens the drawer over the clicked row and closes it once that row disappears from the list', async () => {
			const row = notification();

			mocks.notifications.value = [row];

			const wrapper = await mountAndClearInitialFetch();

			emitFromList(wrapper, 'detail', row.id);

			await flushPromises();

			const drawer = wrapper.findComponent(NotificationDetailDrawer);

			expect(drawer.props('modelValue')).toBe(true);
			expect(drawer.props('notification')).toEqual(row);

			mocks.notifications.value = [];

			await flushPromises();

			expect(drawer.props('modelValue')).toBe(false);
			expect(drawer.props('notification')).toBeNull();
		});
	});
});
