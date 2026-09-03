import { type ComponentPublicInstance, ref } from 'vue';

import { ElButton } from 'element-plus';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { VueWrapper, flushPromises, mount } from '@vue/test-utils';

import {
	ExtensionKind,
	NotificationsModuleNotificationActionOperation,
	NotificationsModuleNotificationActionType,
	NotificationsModuleNotificationKind,
	NotificationsModuleNotificationSeverity,
} from '../../../openapi.constants';
import type { INotification, INotificationAction } from '../store/notifications.store.schemas';

import NotificationDetailDrawer from './notification-detail-drawer.vue';

type NotificationDetailDrawerInstance = ComponentPublicInstance;

vi.mock('vue-i18n', () => ({
	createI18n: () => ({ global: { locale: { value: 'en-US' }, getLocaleMessage: () => ({}), setLocaleMessage: () => {} } }),
	useI18n: () => ({ t: (key: string) => key }),
}));

const mockDismiss = vi.fn();
const mockRemove = vi.fn();
const mockExecute = vi.fn();

vi.mock('../composables/composables', () => ({
	useNotificationsActions: () => ({ dismiss: mockDismiss, remove: mockRemove }),
	useNotificationAction: () => ({ execute: mockExecute, isExecuting: ref(false) }),
}));

const linkAction = (label: string): INotificationAction => ({
	type: NotificationsModuleNotificationActionType.link,
	label,
	url: '/system/info',
	primary: true,
});

const serviceAction = (label: string): INotificationAction => ({
	type: NotificationsModuleNotificationActionType.service,
	label,
	extensionKind: ExtensionKind.plugin,
	extensionType: 'devices-shelly-ng-plugin',
	serviceId: 'shelly-ng-scanner',
	operation: NotificationsModuleNotificationActionOperation.restart,
});

const baseNotification: INotification = {
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
};

// `el-drawer` mounts its body lazily - the first synchronous render pass has nothing to find yet,
// so every caller awaits this before asserting against the drawer's content.
const mountDrawer = async (notification: INotification | null): Promise<VueWrapper<NotificationDetailDrawerInstance>> => {
	const wrapper = mount(NotificationDetailDrawer, {
		props: { modelValue: true, notification },
	});

	await flushPromises();

	return wrapper;
};

describe('NotificationDetailDrawer', () => {
	let wrapper: VueWrapper<NotificationDetailDrawerInstance>;

	beforeEach(() => {
		vi.clearAllMocks();
	});

	describe('message', () => {
		it('preserves newlines in the notification message', async () => {
			const message = 'Installed 1.9.2.\nChannel: stable.\nSee the release notes for details.';

			wrapper = await mountDrawer({ ...baseNotification, message });

			expect(wrapper.find('.notification-detail-drawer__message').text()).toBe(message);
		});

		it('renders no message element when the notification has none', async () => {
			wrapper = await mountDrawer({ ...baseNotification, message: null });

			expect(wrapper.find('.notification-detail-drawer__message').exists()).toBe(false);
		});
	});

	describe('data table', () => {
		it('renders every data entry as a key/value row', async () => {
			wrapper = await mountDrawer({
				...baseNotification,
				data: { current_version: '1.9.2', latest_version: '2.4.0', forced: true },
			});

			// The "Data" descriptions block is the first of the two - "Lifecycle" always follows it.
			const dataTable = wrapper.findAll('.el-descriptions')[0];
			const labels = dataTable.findAll('.el-descriptions__label').map((cell) => cell.text());
			const values = dataTable.findAll('.el-descriptions__content').map((cell) => cell.text());

			expect(labels).toEqual(['current_version', 'latest_version', 'forced']);
			expect(values).toEqual(['1.9.2', '2.4.0', 'true']);
		});

		it('renders no data table when the notification carries no data', async () => {
			wrapper = await mountDrawer({ ...baseNotification, data: null });

			expect(wrapper.text()).not.toContain('notificationsModule.headings.notifications.data');
		});
	});

	describe('actions', () => {
		it('renders a button for every action on the notification', async () => {
			wrapper = await mountDrawer({
				...baseNotification,
				actions: [linkAction('View update'), serviceAction('Restart service')],
			});

			const container = wrapper.find('.notification-actions');
			const buttons: VueWrapper<ComponentPublicInstance>[] = container.findAllComponents(ElButton);

			expect(buttons).toHaveLength(2);
			expect(buttons.map((button) => button.text())).toEqual(['View update', 'Restart service']);
		});

		it('renders no actions container when the notification has none', async () => {
			wrapper = await mountDrawer({ ...baseNotification, actions: [] });

			expect(wrapper.find('.notification-actions').exists()).toBe(false);
		});
	});

	describe('footer', () => {
		it('dismisses the notification', async () => {
			wrapper = await mountDrawer({ ...baseNotification, dismissedAt: null });

			const buttons = wrapper.findAllComponents(ElButton);
			const dismissButton = buttons.find((button) => button.text() === 'notificationsModule.buttons.dismiss.title');

			await dismissButton?.trigger('click');

			expect(mockDismiss).toHaveBeenCalledWith(baseNotification.id, true);
		});

		it('hides the dismiss button once the notification is already dismissed', async () => {
			wrapper = await mountDrawer({ ...baseNotification, dismissedAt: new Date('2026-01-02T00:00:00.000Z') });

			const buttons = wrapper.findAllComponents(ElButton);

			expect(buttons.some((button) => button.text() === 'notificationsModule.buttons.dismiss.title')).toBe(false);
		});

		it('removes the notification', async () => {
			wrapper = await mountDrawer({ ...baseNotification, dismissedAt: null });

			const buttons = wrapper.findAllComponents(ElButton);
			const removeButton = buttons.find((button) => button.text() === 'application.bulkActions.delete');

			await removeButton?.trigger('click');

			expect(mockRemove).toHaveBeenCalledWith(baseNotification.id);
		});
	});
});
