import { describe, expect, it, vi } from 'vitest';

import { mount } from '@vue/test-utils';

import { NotificationsModuleNotificationKind, NotificationsModuleNotificationSeverity } from '../../../openapi.constants';
import type { INotification } from '../store/notifications.store.schemas';

import NotificationsInboxList from './notifications-inbox-list.vue';

vi.mock('vue-i18n', () => ({
	useI18n: () => ({ t: (key: string) => key }),
}));

vi.mock('../../../common', () => ({
	StateView: { name: 'StateView', props: ['kind', 'title', 'icon'], template: '<div :data-kind="kind"><slot name="action" /></div>' },
}));

const row = (id: string, overrides: Partial<INotification> = {}): INotification => ({
	id,
	source: 'system-module',
	kind: NotificationsModuleNotificationKind.event,
	key: null,
	severity: NotificationsModuleNotificationSeverity.warning,
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
	...overrides,
});

const mountList = (props: Record<string, unknown> = {}) =>
	mount(NotificationsInboxList, {
		props: {
			items: [row('n1'), row('n2', { readAt: new Date(), occurrences: 4 })],
			selectedIds: [],
			loading: false,
			filtersActive: false,
			hasMore: false,
			...props,
		},
	});

describe('NotificationsInboxList', () => {
	it('marks the open row and the unread ones', () => {
		const wrapper = mountList({ activeId: 'n2' });
		const rows = wrapper.findAll('[data-test-id="notifications-inbox-row"]');

		expect(rows[0].attributes('data-unread')).toBe('true');
		expect(rows[1].attributes('data-unread')).toBeUndefined();
		expect(rows[1].classes()).toContain('bg-primary-soft');
		expect(rows[1].find('[data-test-id="notifications-inbox-open"]').attributes('aria-current')).toBe('true');
		expect(rows[1].text()).toContain('×4');
	});

	it('opens a row', async () => {
		const wrapper = mountList();

		await wrapper.findAll('[data-test-id="notifications-inbox-open"]')[1].trigger('click');

		expect(wrapper.emitted('open')).toEqual([['n2']]);
	});

	it('adds and removes rows from the selection', async () => {
		const wrapper = mountList({ selectedIds: ['n1'] });
		const boxes = wrapper.findAllComponents({ name: 'ElCheckbox' });

		boxes[1].vm.$emit('update:model-value', true);
		boxes[0].vm.$emit('update:model-value', false);

		expect(wrapper.emitted('update:selected-ids')).toEqual([[['n1', 'n2']], [[]]]);
	});

	it('grows with Load more while there is more', async () => {
		expect(mountList().find('[data-test-id="load-more-notifications"]').exists()).toBe(false);

		const wrapper = mountList({ hasMore: true });

		await wrapper.find('[data-test-id="load-more-notifications"]').trigger('click');

		expect(wrapper.emitted('load-more')).toHaveLength(1);
	});

	it('offers a reset when the filters leave nothing, and a plain empty state otherwise', async () => {
		const filtered = mountList({ items: [], filtersActive: true });

		await filtered.find('[data-test-id="reset-notifications-filters-empty"]').trigger('click');

		expect(filtered.emitted('reset-filters')).toHaveLength(1);
		expect(mountList({ items: [] }).find('[data-test-id="reset-notifications-filters-empty"]').exists()).toBe(false);
		expect(mountList({ items: [], loading: true }).find('[data-kind="loading"]').exists()).toBe(true);
	});
});
