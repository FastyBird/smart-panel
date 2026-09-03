import { ref } from 'vue';

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { flushPromises, mount } from '@vue/test-utils';

import { ListNotifications } from '../components/components';

import ViewNotifications from './view-notifications.vue';

const mocks = vi.hoisted(() => ({
	markAllRead: vi.fn(),
	bulkMarkUnread: vi.fn(),
	bulkDismiss: vi.fn(),
	bulkRemove: vi.fn(),
	fetchNotifications: vi.fn(),
	loadMoreNotifications: vi.fn(),
}));

vi.mock('vue-i18n', () => ({
	useI18n: () => ({ t: (key: string) => key }),
}));

vi.mock('../../../common', async () => {
	const { defineComponent: defineVueComponent, h, ref: vueRef } = await import('vue');

	const StubComponent = defineVueComponent({
		setup(_, { slots }) {
			return () => h('div', [slots.default?.(), slots.icon?.(), slots.title?.(), slots.subtitle?.()]);
		},
	});

	return {
		AppBarHeading: StubComponent,
		ViewHeader: StubComponent,
		useBreakpoints: () => ({
			isMDDevice: vueRef(true),
		}),
	};
});

// `ListNotifications` is stubbed so the test can fire its `bulk-action` event directly, without
// depending on the real table/toolbar markup - that wiring is covered by `list-notifications.vue`
// itself. `NotificationDetailDrawer`/`NotificationsFilter` are simple pass-throughs.
vi.mock('../components/components', async () => {
	const { defineComponent: defineVueComponent } = await import('vue');

	return {
		ListNotifications: defineVueComponent({
			name: 'ListNotifications',
			props: {
				items: { type: Array, default: () => [] },
				hasMore: { type: Boolean, default: false },
				loading: { type: Boolean, default: false },
			},
			emits: ['detail', 'load-more', 'bulk-action'],
			template: '<div />',
		}),
		NotificationDetailDrawer: defineVueComponent({ template: '<div />' }),
		NotificationsFilter: defineVueComponent({ template: '<div />' }),
	};
});

vi.mock('../composables/composables', () => ({
	useNotificationsActions: () => ({
		markAllRead: mocks.markAllRead,
		bulkMarkUnread: mocks.bulkMarkUnread,
		bulkDismiss: mocks.bulkDismiss,
		bulkRemove: mocks.bulkRemove,
	}),
	useNotificationsDataSource: () => ({
		notifications: ref([]),
		hasMore: ref(false),
		areLoading: ref(false),
		filters: ref({}),
		fetchNotifications: mocks.fetchNotifications,
		loadMoreNotifications: mocks.loadMoreNotifications,
	}),
}));

vi.mock('../notifications.exceptions', () => ({
	NotificationsException: Error,
}));

const mountView = () => mount(ViewNotifications);

const emitBulkAction = (wrapper: ReturnType<typeof mountView>, action: string, ids: string[] = ['1']): void => {
	wrapper.findComponent(ListNotifications).vm.$emit('bulk-action', action, ids);
};

describe('ViewNotifications bulk actions', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mocks.fetchNotifications.mockResolvedValue(undefined);
	});

	// The initial `onBeforeMount` load also calls `fetchNotifications` - cleared after mount so
	// each assertion below only counts the refetch (or lack of one) triggered by the bulk action.
	const mountAndClearInitialFetch = async (): Promise<ReturnType<typeof mountView>> => {
		const wrapper = mountView();

		await flushPromises();

		mocks.fetchNotifications.mockClear();

		return wrapper;
	};

	it('refetches after a bulk action that fully mutated the selection', async () => {
		mocks.bulkDismiss.mockResolvedValue('mutated');

		const wrapper = await mountAndClearInitialFetch();

		emitBulkAction(wrapper, 'dismiss', ['1', '2']);

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

		emitBulkAction(wrapper, 'delete', ['1', '2']);

		await flushPromises();

		expect(mocks.fetchNotifications).toHaveBeenCalledTimes(1);
	});

	it('does not refetch after a cancelled bulk action', async () => {
		mocks.bulkRemove.mockResolvedValue('cancelled');

		const wrapper = await mountAndClearInitialFetch();

		emitBulkAction(wrapper, 'delete');

		await flushPromises();

		expect(mocks.fetchNotifications).not.toHaveBeenCalled();
	});

	it('does not refetch after a bulk action that failed outright', async () => {
		mocks.bulkMarkUnread.mockResolvedValue('failed');

		const wrapper = await mountAndClearInitialFetch();

		emitBulkAction(wrapper, 'mark-unread');

		await flushPromises();

		expect(mocks.fetchNotifications).not.toHaveBeenCalled();
	});

	it('refetches when markAllRead reports a mutation through its boolean outcome', async () => {
		mocks.markAllRead.mockResolvedValue(true);

		const wrapper = await mountAndClearInitialFetch();

		emitBulkAction(wrapper, 'mark-read');

		await flushPromises();

		expect(mocks.fetchNotifications).toHaveBeenCalledTimes(1);
	});

	it('does not refetch when markAllRead reports no mutation', async () => {
		mocks.markAllRead.mockResolvedValue(false);

		const wrapper = await mountAndClearInitialFetch();

		emitBulkAction(wrapper, 'mark-read');

		await flushPromises();

		expect(mocks.fetchNotifications).not.toHaveBeenCalled();
	});
});
