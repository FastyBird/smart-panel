import { describe, expect, it, vi } from 'vitest';

import { shallowMount } from '@vue/test-utils';

import { NotificationsModuleNotificationKind, NotificationsModuleNotificationSeverity } from '../../../openapi.constants';
import { RouteNames } from '../notifications.constants';
import type { INotification } from '../store/notifications.store.schemas';

import ViewNotification from './view-notification.vue';

vi.mock('vue-i18n', () => ({
	useI18n: () => ({ t: (key: string) => key }),
}));

vi.mock('vue-router', () => ({
	useRoute: () => ({ query: { unread: 'true' } }),
	useRouter: () => ({ push: vi.fn() }),
}));

vi.mock('../../../common', () => ({
	ViewHeader: { name: 'ViewHeader', props: ['title', 'subtitle', 'back', 'icon'], template: '<header />' },
	StateView: { name: 'StateView', props: ['kind', 'title', 'icon'], template: '<div />' },
}));

const notification: INotification = {
	id: 'n1',
	source: 'system-module',
	kind: NotificationsModuleNotificationKind.event,
	key: null,
	severity: NotificationsModuleNotificationSeverity.info,
	title: 'Backup finished',
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
};

describe('ViewNotification', () => {
	it('carries a header leading back to the list, filters kept, on a page of its own', () => {
		const wrapper = shallowMount(ViewNotification, { props: { id: 'n1', notification } });
		const header = wrapper.findComponent({ name: 'ViewHeader' });

		expect(header.props('title')).toBe('Backup finished');
		expect(header.props('back')).toEqual({ name: RouteNames.NOTIFICATIONS, query: { unread: 'true' } });
	});

	it('leaves the header to the inbox in the right pane', () => {
		const wrapper = shallowMount(ViewNotification, { props: { id: 'n1', notification, inPane: true } });

		expect(wrapper.findComponent({ name: 'ViewHeader' }).exists()).toBe(false);
		expect(wrapper.findComponent({ name: 'NotificationDetail' }).props('notification')).toEqual(notification);
	});

	it('passes the detail actions up to the inbox', () => {
		const wrapper = shallowMount(ViewNotification, { props: { id: 'n1', notification, inPane: true } });
		const detail = wrapper.findComponent({ name: 'NotificationDetail' });

		detail.vm.$emit('mark-read', 'n1', false);
		detail.vm.$emit('dismiss', 'n1');
		detail.vm.$emit('remove', 'n1');

		expect(wrapper.emitted('mark-read')).toEqual([['n1', false]]);
		expect(wrapper.emitted('dismiss')).toEqual([['n1']]);
		expect(wrapper.emitted('remove')).toEqual([['n1']]);
	});

	it('shows loading while the notification is read, then not found', async () => {
		const wrapper = shallowMount(ViewNotification, { props: { id: 'gone', notification: null, loading: true } });

		expect(wrapper.findComponent({ name: 'StateView' }).props('kind')).toBe('loading');

		await wrapper.setProps({ loading: false });

		expect(wrapper.findComponent({ name: 'StateView' }).props('kind')).toBe('not-found');
	});
});
