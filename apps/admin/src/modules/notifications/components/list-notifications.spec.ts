import { type ComponentPublicInstance, defineComponent, reactive } from 'vue';

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { VueWrapper, flushPromises, mount } from '@vue/test-utils';

import { NotificationsModuleNotificationKind, NotificationsModuleNotificationSeverity } from '../../../openapi.constants';
import type { INotificationsFilter } from '../schemas/list.schemas';
import type { INotification } from '../store/notifications.store.schemas';

import ListNotifications from './list-notifications.vue';

vi.mock('vue-i18n', () => ({
	useI18n: () => ({ t: (key: string) => key }),
}));

vi.mock('../../../common', async () => {
	const { ref: vueRef } = await import('vue');

	return {
		useBreakpoints: () => ({ isMDDevice: vueRef(true), isLGDevice: vueRef(true) }),
	};
});

// The filter bar and the table are exercised by their own specs - here they are reduced to the
// events the list wires together (selection -> bulk action, load more).
const NotificationsFilterStub = defineComponent({
	name: 'NotificationsFilter',
	props: {
		filters: { type: Object, required: true },
		filtersActive: { type: Boolean, default: false },
		selectedCount: { type: Number, default: 0 },
		bulkActions: { type: Array, default: () => [] },
	},
	emits: ['update:filters', 'reset-filters', 'bulk-action'],
	template: '<div class="filter-stub">{{ selectedCount }}</div>',
});

const NotificationsTableStub = defineComponent({
	name: 'NotificationsTable',
	props: {
		items: { type: Array, default: () => [] },
		filters: { type: Object, required: true },
		loading: { type: Boolean, default: false },
		filtersActive: { type: Boolean, default: false },
		tableHeight: { type: Number, default: 0 },
	},
	emits: ['detail', 'dismiss', 'remove', 'reset-filters', 'selected-changes', 'update:filters'],
	template: '<div class="table-stub" />',
});

const notification = (id: string): INotification => ({
	id,
	source: 'system-module',
	kind: NotificationsModuleNotificationKind.issue,
	key: null,
	severity: NotificationsModuleNotificationSeverity.info,
	title: `Notification ${id}`,
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
});

const mountList = async (
	props: Partial<{ items: INotification[]; hasMore: boolean; loading: boolean }> = {}
): Promise<VueWrapper<ComponentPublicInstance>> => {
	const wrapper = mount(ListNotifications, {
		props: {
			items: [],
			filters: reactive<INotificationsFilter>({ status: 'all', severity: [], source: undefined, unread: false }),
			filtersActive: false,
			hasMore: false,
			loading: false,
			...props,
		},
		global: {
			stubs: {
				NotificationsFilter: NotificationsFilterStub,
				NotificationsTable: NotificationsTableStub,
			},
		},
	});

	await flushPromises();

	return wrapper;
};

describe('ListNotifications', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it('shows the load-more row only while the backend reports more pages, and asks for the next one from it', async () => {
		const wrapper = await mountList({ hasMore: false });

		expect(wrapper.find('[data-test-id="load-more-notifications"]').exists()).toBe(false);

		await wrapper.setProps({ hasMore: true });

		await wrapper.find('[data-test-id="load-more-notifications"]').trigger('click');

		expect(wrapper.emitted('load-more')).toHaveLength(1);
	});

	it('carries the selected row ids into a bulk action', async () => {
		const first = notification('a1111111-1111-4111-8111-111111111111');
		const second = notification('b2222222-2222-4222-8222-222222222222');

		const wrapper = await mountList({ items: [first, second] });

		wrapper.findComponent(NotificationsTableStub).vm.$emit('selected-changes', [first, second]);

		await flushPromises();

		expect(wrapper.find('.filter-stub').text()).toBe('2');

		wrapper.findComponent(NotificationsFilterStub).vm.$emit('bulk-action', 'dismiss');

		expect(wrapper.emitted('bulk-action')).toEqual([['dismiss', [first.id, second.id]]]);
	});

	it('passes row events straight through', async () => {
		const wrapper = await mountList();

		const table = wrapper.findComponent(NotificationsTableStub);

		table.vm.$emit('detail', '1');
		table.vm.$emit('dismiss', '2');
		table.vm.$emit('remove', '3');
		table.vm.$emit('reset-filters');

		expect(wrapper.emitted('detail')).toEqual([['1']]);
		expect(wrapper.emitted('dismiss')).toEqual([['2']]);
		expect(wrapper.emitted('remove')).toEqual([['3']]);
		expect(wrapper.emitted('reset-filters')).toHaveLength(1);
	});
});
