import { type ComponentPublicInstance, ref } from 'vue';

import { ElBadge } from 'element-plus';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { Icon } from '@iconify/vue';
import { VueWrapper, mount } from '@vue/test-utils';

import { NotificationsModuleNotificationSeverity } from '../../../openapi.constants';

import NotificationBell from './notification-bell.vue';

type NotificationBellInstance = ComponentPublicInstance;

const mockUnreadCount = ref<number>(0);
const mockHighestActiveSeverity = ref<NotificationsModuleNotificationSeverity | null>(null);
const mockFetchNotifications = vi.fn();

vi.mock('vue-i18n', () => ({
	createI18n: () => ({ global: { locale: { value: 'en-US' }, getLocaleMessage: () => ({}), setLocaleMessage: () => {} } }),
	useI18n: () => ({
		t: (key: string) => key,
	}),
}));

vi.mock('../composables/composables', () => ({
	useNotifications: () => ({
		unreadCount: mockUnreadCount,
		highestActiveSeverity: mockHighestActiveSeverity,
		fetchNotifications: mockFetchNotifications,
	}),
}));

const mountBell = (): VueWrapper<NotificationBellInstance> =>
	mount(NotificationBell, {
		global: {
			// The popover pulls in the store and the router; the bell's own behaviour (badge, icon,
			// initial fetch) does not depend on what is inside it.
			stubs: { NotificationPopover: true },
		},
	});

describe('NotificationBell', () => {
	let wrapper: VueWrapper<NotificationBellInstance>;

	beforeEach(() => {
		mockUnreadCount.value = 0;
		mockHighestActiveSeverity.value = null;
		vi.clearAllMocks();

		wrapper = mountBell();
	});

	it('fetches active notifications on mount', () => {
		expect(mockFetchNotifications).toHaveBeenCalledWith({ status: 'active' });
	});

	it('hides the badge when the unread count is zero', () => {
		const badge = wrapper.findComponent(ElBadge);

		expect(badge.props('hidden')).toBe(true);
		expect(badge.props('value')).toBe(0);
	});

	it('shows the unread count on the badge once it is above zero', () => {
		mockUnreadCount.value = 3;

		wrapper = mountBell();

		const badge = wrapper.findComponent(ElBadge);

		expect(badge.props('hidden')).toBe(false);
		expect(badge.props('value')).toBe(3);
	});

	it('keeps the badge inside the 44px top bar', () => {
		mockUnreadCount.value = 3;

		wrapper = mountBell();

		// The bar's container clips overflow, and a badge sits half its height above the button -
		// without the nudge its top third is cut off.
		expect(wrapper.findComponent(ElBadge).props('offset')).toEqual([0, 4]);
	});

	it('renders the outline bell with no alert styling when nothing active is severe', () => {
		const icon = wrapper.findComponent(Icon);

		expect(icon.props('icon')).toBe('mdi:bell-outline');
		expect(icon.classes()).not.toContain('notification-bell__icon--danger');
	});

	it('does not switch to the alert bell for a warning severity', () => {
		mockHighestActiveSeverity.value = NotificationsModuleNotificationSeverity.warning;

		wrapper = mountBell();

		const icon = wrapper.findComponent(Icon);

		expect(icon.props('icon')).toBe('mdi:bell-outline');
	});

	it('switches to the alert bell in the danger colour when the highest active severity is error', () => {
		mockHighestActiveSeverity.value = NotificationsModuleNotificationSeverity.error;

		wrapper = mountBell();

		const icon = wrapper.findComponent(Icon);

		expect(icon.props('icon')).toBe('mdi:bell-alert');
		expect(icon.classes()).toContain('notification-bell__icon--danger');
	});

	it('switches to the alert bell when the highest active severity is critical', () => {
		mockHighestActiveSeverity.value = NotificationsModuleNotificationSeverity.critical;

		wrapper = mountBell();

		const icon = wrapper.findComponent(Icon);

		expect(icon.props('icon')).toBe('mdi:bell-alert');
		expect(icon.classes()).toContain('notification-bell__icon--danger');
	});
});
