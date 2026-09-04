import { type ComponentPublicInstance, computed, defineComponent, ref } from 'vue';

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { VueWrapper, mount } from '@vue/test-utils';

import { NotificationsModuleNotificationKind, NotificationsModuleNotificationSeverity } from '../../../openapi.constants';
import type { INotification } from '../store/notifications.store.schemas';

import NotificationPopover from './notification-popover.vue';

type NotificationPopoverInstance = ComponentPublicInstance;

const mockPush = vi.fn();

vi.mock('vue-router', () => ({
	useRouter: () => ({ push: mockPush }),
}));

vi.mock('vue-i18n', () => ({
	useI18n: () => ({ t: (key: string) => key }),
}));

const mockExecute = vi.fn();
const isExecutingRef = ref(false);
const activeRef = ref<INotification[]>([]);

vi.mock('../composables/composables', () => ({
	useNotifications: () => ({
		active: computed(() => activeRef.value),
	}),
	useNotificationsActions: () => ({
		markRead: vi.fn(),
		markAllRead: vi.fn(),
		dismiss: vi.fn(),
	}),
	useNotificationAction: () => ({
		execute: mockExecute,
		isExecuting: isExecutingRef,
	}),
}));

// A minimal stand-in that just surfaces the props it was given - the real `NotificationItem` (and
// its own `isExecuting`-disables-the-button behaviour) is covered by `notification-item.spec.ts`.
vi.mock('./notification-item.vue', () => ({
	default: defineComponent({
		name: 'NotificationItem',
		props: {
			notification: { type: Object, required: true },
			isExecuting: { type: Boolean, default: false },
		},
		emits: ['click', 'action', 'dismiss'],
		template: '<div class="notification-item-stub" :data-is-executing="isExecuting" />',
	}),
}));

const notificationFixture = (overrides: Partial<INotification> = {}): INotification => ({
	id: '11111111-1111-1111-1111-111111111111',
	source: 'system-module',
	kind: NotificationsModuleNotificationKind.event,
	key: null,
	severity: NotificationsModuleNotificationSeverity.warning,
	title: 'Home Assistant connection lost',
	message: null,
	actions: [],
	data: null,
	persistent: false,
	occurrences: 1,
	readAt: null,
	dismissedAt: null,
	resolvedAt: null,
	createdAt: new Date('2026-09-02T12:00:00.000Z'),
	updatedAt: null,
	...overrides,
});

const mountPopover = (): VueWrapper<NotificationPopoverInstance> =>
	mount(NotificationPopover, {
		global: {
			stubs: { ElButton: false, ElResult: true },
		},
	}) as VueWrapper<NotificationPopoverInstance>;

describe('NotificationPopover', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		isExecutingRef.value = false;
		activeRef.value = [notificationFixture()];
	});

	// Backstops the composable-level guard in `useNotificationAction.spec.ts`: even if something
	// ever called `onAction` twice in the same tick, the row's own button is already disabled.
	it('passes the shared isExecuting flag down to every notification-item row', () => {
		isExecutingRef.value = true;

		const wrapper = mountPopover();

		const item = wrapper.find('.notification-item-stub');

		expect(item.attributes('data-is-executing')).toBe('true');
	});

	it('reflects a settled (not executing) state to its rows', () => {
		isExecutingRef.value = false;

		const wrapper = mountPopover();

		const item = wrapper.find('.notification-item-stub');

		expect(item.attributes('data-is-executing')).toBe('false');
	});
});
