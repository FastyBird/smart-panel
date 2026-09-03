import { type ComponentPublicInstance, ref } from 'vue';

import { ElBadge, ElButton } from 'element-plus';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { VueWrapper, mount } from '@vue/test-utils';

import { NotificationsModuleNotificationKind, NotificationsModuleNotificationSeverity } from '../../../openapi.constants';
import { NOTIFICATIONS_POPOVER_LIMIT, RouteNames } from '../notifications.constants';
import type { INotification } from '../store/notifications.store.schemas';

import NotificationItem from './notification-item.vue';
import NotificationPopover from './notification-popover.vue';

type NotificationPopoverInstance = ComponentPublicInstance;

const mockPush = vi.fn();

vi.mock('vue-router', async () => {
	const actual = await vi.importActual('vue-router');

	return {
		...actual,
		useRouter: () => ({ push: mockPush }),
	};
});

vi.mock('vue-i18n', () => ({
	createI18n: () => ({ global: { locale: { value: 'en-US' }, getLocaleMessage: () => ({}), setLocaleMessage: () => {} } }),
	useI18n: () => ({ t: (key: string) => key }),
}));

const mockActive = ref<INotification[]>([]);
const mockMarkRead = vi.fn();
const mockMarkAllRead = vi.fn();
const mockDismiss = vi.fn();
const mockExecute = vi.fn();

vi.mock('../composables/composables', () => ({
	useNotifications: () => ({ active: mockActive }),
	useNotificationsActions: () => ({ markRead: mockMarkRead, markAllRead: mockMarkAllRead, dismiss: mockDismiss }),
	useNotificationAction: () => ({ execute: mockExecute, isExecuting: ref(false) }),
}));

const makeNotification = (overrides: Partial<INotification> = {}): INotification => ({
	id: 'a1111111-1111-4111-8111-111111111111',
	source: 'system-module',
	kind: NotificationsModuleNotificationKind.event,
	key: null,
	severity: NotificationsModuleNotificationSeverity.info,
	title: 'Notification',
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

const mountPopover = (): VueWrapper<NotificationPopoverInstance> => mount(NotificationPopover);

describe('NotificationPopover', () => {
	let wrapper: VueWrapper<NotificationPopoverInstance>;

	beforeEach(() => {
		mockActive.value = [];
		vi.clearAllMocks();
	});

	describe('rendering order', () => {
		it('renders active notifications ordered by severity rank, then most recent first', () => {
			mockActive.value = [
				makeNotification({ id: 'n1', severity: NotificationsModuleNotificationSeverity.warning, createdAt: new Date('2026-01-01T00:00:00.000Z') }),
				makeNotification({ id: 'n2', severity: NotificationsModuleNotificationSeverity.critical, createdAt: new Date('2026-01-02T00:00:00.000Z') }),
				makeNotification({ id: 'n3', severity: NotificationsModuleNotificationSeverity.warning, createdAt: new Date('2026-01-03T00:00:00.000Z') }),
				makeNotification({ id: 'n4', severity: NotificationsModuleNotificationSeverity.info, createdAt: new Date('2026-01-04T00:00:00.000Z') }),
			];

			wrapper = mountPopover();

			const items = wrapper.findAllComponents(NotificationItem);

			expect(items.map((item) => item.props('notification').id)).toEqual(['n2', 'n3', 'n1', 'n4']);
		});

		it('renders only the top rows, never more than the popover limit', () => {
			mockActive.value = Array.from({ length: NOTIFICATIONS_POPOVER_LIMIT + 5 }, (_, index) =>
				makeNotification({ id: `n${index}`, createdAt: new Date(2026, 0, index + 1) })
			);

			wrapper = mountPopover();

			expect(wrapper.findAllComponents(NotificationItem)).toHaveLength(NOTIFICATIONS_POPOVER_LIMIT);
		});

		it('shows the empty state when there is nothing active', () => {
			mockActive.value = [];

			wrapper = mountPopover();

			expect(wrapper.findAllComponents(NotificationItem)).toHaveLength(0);
			expect(wrapper.text()).toContain('notificationsModule.texts.bell.empty');
		});
	});

	describe('occurrence badge', () => {
		it('shows the occurrence badge only for a notification repeated more than once', () => {
			mockActive.value = [
				makeNotification({ id: 'n1', occurrences: 1 }),
				makeNotification({ id: 'n2', occurrences: 5, severity: NotificationsModuleNotificationSeverity.critical }),
			];

			wrapper = mountPopover();

			const badges = wrapper.findAllComponents(ElBadge);

			expect(badges).toHaveLength(1);
			expect(badges[0].props('value')).toBe(5);
		});

		it('renders no occurrence badge when nothing has repeated', () => {
			mockActive.value = [makeNotification({ id: 'n1', occurrences: 1 }), makeNotification({ id: 'n2', occurrences: 1 })];

			wrapper = mountPopover();

			expect(wrapper.findAllComponents(ElBadge)).toHaveLength(0);
		});
	});

	describe('footer actions', () => {
		it('renders exactly the two footer actions', () => {
			mockActive.value = [makeNotification({ id: 'n1' })];

			wrapper = mountPopover();

			const footer = wrapper.find('.notification-popover__footer');
			const buttons = footer.findAllComponents(ElButton);

			expect(buttons).toHaveLength(2);
			expect(buttons[0].text()).toBe('notificationsModule.buttons.markAllRead.title');
			expect(buttons[1].text()).toBe('notificationsModule.buttons.viewAll.title');
		});

		it('disables "mark all as read" when nothing active is unread', () => {
			mockActive.value = [makeNotification({ id: 'n1', readAt: new Date('2026-01-01T00:00:00.000Z') })];

			wrapper = mountPopover();

			const footer = wrapper.find('.notification-popover__footer');
			const [markAllButton] = footer.findAllComponents(ElButton);

			expect(markAllButton.props('disabled')).toBe(true);
		});

		it('marks every unread active notification as read, ignoring ones already read', async () => {
			mockActive.value = [
				makeNotification({ id: 'n1', readAt: null }),
				makeNotification({ id: 'n2', readAt: new Date('2026-01-01T00:00:00.000Z') }),
				makeNotification({ id: 'n3', readAt: null }),
			];

			wrapper = mountPopover();

			const footer = wrapper.find('.notification-popover__footer');
			const [markAllButton] = footer.findAllComponents(ElButton);

			await markAllButton.trigger('click');

			expect(mockMarkAllRead).toHaveBeenCalledWith(['n1', 'n3']);
		});

		it('routes to the notifications page and closes the popover on "view all"', async () => {
			mockActive.value = [makeNotification({ id: 'n1' })];

			wrapper = mountPopover();

			const footer = wrapper.find('.notification-popover__footer');
			const [, viewAllButton] = footer.findAllComponents(ElButton);

			await viewAllButton.trigger('click');

			expect(wrapper.emitted('close')).toBeTruthy();
			expect(mockPush).toHaveBeenCalledWith({ name: RouteNames.NOTIFICATIONS });
		});
	});
});
