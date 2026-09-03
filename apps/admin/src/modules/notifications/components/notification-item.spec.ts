import { type ComponentPublicInstance } from 'vue';

import { describe, expect, it, vi } from 'vitest';

import { VueWrapper, mount } from '@vue/test-utils';

import {
	NotificationsModuleNotificationActionType,
	NotificationsModuleNotificationKind,
	NotificationsModuleNotificationSeverity,
} from '../../../openapi.constants';
import type { INotification } from '../store/notifications.store.schemas';

import NotificationItem from './notification-item.vue';

type NotificationItemInstance = ComponentPublicInstance;

vi.mock('vue-i18n', () => ({
	useI18n: () => ({
		t: (key: string) => key,
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

const mountItem = (
	overrides: Partial<INotification> = {},
	props: { isExecuting?: boolean } = {}
): { notification: INotification; wrapper: VueWrapper<NotificationItemInstance> } => {
	const notification = notificationFixture(overrides);

	const wrapper = mount(NotificationItem, {
		props: {
			notification,
			...props,
		},
	}) as VueWrapper<NotificationItemInstance>;

	return { notification, wrapper };
};

describe('NotificationItem', () => {
	// The row itself carries the click handler for mouse users, but a `div` is never part of the
	// tab order - keyboard users need a real, separate focusable control for the same action. It
	// cannot be `role="button"` on the row, because the row also contains real nested `<button>`s
	// (dismiss, the primary action), and a button may not contain another interactive control.
	it('exposes the title as a focusable control with the notification title as its name', () => {
		const { wrapper } = mountItem();

		const control = wrapper.find('[role="button"]');

		expect(control.exists()).toBe(true);
		expect(control.attributes('tabindex')).toBe('0');
		expect(control.attributes('aria-label')).toBe('Home Assistant connection lost');
	});

	it('emits click when the title control is clicked', async () => {
		const { notification, wrapper } = mountItem();

		await wrapper.find('[role="button"]').trigger('click');

		expect(wrapper.emitted('click')).toHaveLength(1);
		expect(wrapper.emitted('click')![0]).toEqual([notification]);
	});

	it('emits click when the title control is activated with Enter from the keyboard', async () => {
		const { notification, wrapper } = mountItem();

		await wrapper.find('[role="button"]').trigger('keydown', { key: 'Enter' });

		expect(wrapper.emitted('click')).toHaveLength(1);
		expect(wrapper.emitted('click')![0]).toEqual([notification]);
	});

	it('still emits click for mouse users clicking elsewhere on the row', async () => {
		const { wrapper } = mountItem();

		await wrapper.find('.notification-item').trigger('click');

		expect(wrapper.emitted('click')).toHaveLength(1);
	});

	describe('primary action', () => {
		const withPrimaryAction: Partial<INotification> = {
			actions: [{ type: NotificationsModuleNotificationActionType.link, label: 'Reconnect', url: '/system/reconnect', primary: true }],
		};

		it('is enabled by default', () => {
			const { wrapper } = mountItem(withPrimaryAction);

			const button = wrapper.findAll('button').find((candidate) => candidate.text() === 'Reconnect');

			expect(button?.attributes('disabled')).toBeUndefined();
		});

		// A shared `isExecuting` from the popover's single `useNotificationAction()` call - disabling
		// it here backstops the composable-level guard (`useNotificationAction.spec.ts`) so a second
		// click cannot even reach `execute()` in the first place while one is in flight.
		it('disables the primary action button while isExecuting is true', () => {
			const { wrapper } = mountItem(withPrimaryAction, { isExecuting: true });

			const button = wrapper.findAll('button').find((candidate) => candidate.text() === 'Reconnect');

			expect(button?.attributes('disabled')).toBeDefined();
		});

		it('emits action when the primary action button is clicked while not executing', async () => {
			const { notification, wrapper } = mountItem(withPrimaryAction);

			const button = wrapper.findAll('button').find((candidate) => candidate.text() === 'Reconnect');

			await button!.trigger('click');

			expect(wrapper.emitted('action')).toEqual([[notification]]);
		});
	});
});
