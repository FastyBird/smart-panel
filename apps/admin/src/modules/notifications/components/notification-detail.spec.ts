import { describe, expect, it, vi } from 'vitest';

import { mount } from '@vue/test-utils';

import { NotificationsModuleNotificationKind, NotificationsModuleNotificationSeverity } from '../../../openapi.constants';
import type { INotification } from '../store/notifications.store.schemas';

import NotificationDetail from './notification-detail.vue';

vi.mock('vue-i18n', () => ({
	useI18n: () => ({ t: (key: string) => key, locale: { value: 'en-US' } }),
}));

vi.mock('../composables/composables', async () => {
	const { ref } = await import('vue');

	return { useNotificationAction: () => ({ execute: vi.fn(), isExecuting: ref(false) }) };
});

vi.mock('../../../common', () => ({
	KvGrid: { name: 'KvGrid', props: ['items', 'cols'], template: '<dl />' },
	StatusTag: { name: 'StatusTag', props: ['status', 'label'], template: '<span :data-status="status">{{ label }}</span>' },
}));

const notification = (overrides: Partial<INotification> = {}): INotification => ({
	id: 'a1111111-1111-4111-8111-111111111111',
	source: 'system-module',
	kind: NotificationsModuleNotificationKind.issue,
	key: null,
	severity: NotificationsModuleNotificationSeverity.critical,
	title: 'Disk almost full',
	message: 'Only 2 % left on /data',
	actions: [],
	data: { mount: '/data', free: 2, critical: true },
	persistent: false,
	occurrences: 3,
	readAt: null,
	dismissedAt: null,
	resolvedAt: null,
	createdAt: new Date('2026-01-01T00:00:00.000Z'),
	updatedAt: null,
	...overrides,
});

const stubs = {
	ElTooltip: { template: '<div><slot /></div>' },
	ElDropdown: { name: 'ElDropdown', emits: ['command'], template: '<div><slot /><slot name="dropdown" /></div>' },
	ElDropdownMenu: { template: '<ul><slot /></ul>' },
	ElDropdownItem: { template: '<li><slot /></li>' },
};

const mountDetail = (overrides: Partial<INotification> = {}) =>
	mount(NotificationDetail, { props: { notification: notification(overrides) }, global: { stubs } });

describe('NotificationDetail', () => {
	it('shows the severity, the unread state, the title, the message, the data and the lifecycle', () => {
		const wrapper = mountDetail();

		expect(wrapper.find('h2').text()).toBe('Disk almost full');
		expect(wrapper.find('[data-status="critical"]').exists()).toBe(true);
		expect(wrapper.find('[data-test-id="notification-detail-unread"]').exists()).toBe(true);
		expect(wrapper.find('[data-test-id="notification-detail-message"]').text()).toBe('Only 2 % left on /data');

		const [data, lifecycle] = wrapper.findAllComponents({ name: 'KvGrid' });

		expect(data.props('items')).toEqual([
			{ label: 'mount', value: '/data', mono: true },
			{ label: 'free', value: 2, mono: true },
			{ label: 'critical', value: 'true', mono: true },
		]);
		expect((lifecycle.props('items') as { label: string }[]).map((item) => item.label)).toContain(
			'notificationsModule.fields.notifications.dismissedAt.title'
		);
	});

	it('leaves out the data section when there is none', () => {
		expect(mountDetail({ data: null }).find('[data-test-id="notification-detail-data"]').exists()).toBe(false);
	});

	it('offers Mark as read on an unread notification and Mark as unread on a read one', async () => {
		const unread = mountDetail();

		expect(unread.find('[data-test-id="toggle-read-notification"]').text()).toContain('notificationsModule.buttons.markRead.title');

		await unread.find('[data-test-id="toggle-read-notification"]').trigger('click');

		expect(unread.emitted('mark-read')).toEqual([['a1111111-1111-4111-8111-111111111111', true]]);

		const read = mountDetail({ readAt: new Date('2026-01-02T00:00:00.000Z') });

		expect(read.find('[data-test-id="toggle-read-notification"]').text()).toContain('notificationsModule.buttons.markUnread.title');

		await read.find('[data-test-id="toggle-read-notification"]').trigger('click');

		expect(read.emitted('mark-read')).toEqual([['a1111111-1111-4111-8111-111111111111', false]]);
	});

	it('hides Dismiss once dismissed', () => {
		expect(mountDetail().find('[data-test-id="dismiss-notification"]').exists()).toBe(true);
		expect(
			mountDetail({ dismissedAt: new Date('2026-01-02T00:00:00.000Z') })
				.find('[data-test-id="dismiss-notification"]')
				.exists()
		).toBe(false);
	});

	it('keeps Delete in the more menu as a destructive item', async () => {
		const wrapper = mountDetail();
		const remove = wrapper.find('[data-test-id="remove-notification"]');

		expect(remove.classes()).toContain('text-danger!');

		wrapper.findComponent({ name: 'ElDropdown' }).vm.$emit('command', 'remove');

		expect(wrapper.emitted('remove')).toEqual([['a1111111-1111-4111-8111-111111111111']]);
	});
});
