import { ref } from 'vue';

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ExtensionKind, NotificationsModuleNotificationActionOperation, NotificationsModuleNotificationActionType } from '../../../openapi.constants';
import type { INotification, INotificationAction } from '../store/notifications.store.schemas';

import { useNotificationAction } from './useNotificationAction';

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

const mockSuccess = vi.fn();
const mockError = vi.fn();

vi.mock('../../../common', async () => {
	const actual = await vi.importActual('../../../common');

	return {
		...actual,
		useFlashMessage: () => ({
			success: mockSuccess,
			error: mockError,
			info: vi.fn(),
			warning: vi.fn(),
		}),
	};
});

const { confirmMock } = vi.hoisted(() => ({ confirmMock: vi.fn() }));

vi.mock('element-plus', async () => {
	const actual = await vi.importActual('element-plus');

	return {
		...actual,
		ElMessageBox: {
			confirm: confirmMock,
		},
	};
});

const mockFetchActions = vi.fn();
const mockExecuteAction = vi.fn();
const actionDescriptors = ref<{ id: string; label: string; dangerous?: boolean }[]>([]);

vi.mock('../../extensions/composables/useActions', () => ({
	useActions: () => ({
		actions: actionDescriptors,
		isLoading: ref(false),
		executingActions: ref(new Map()),
		fetchActions: mockFetchActions,
		executeAction: mockExecuteAction,
		fetchActionHistory: vi.fn(),
	}),
}));

const mockStartService = vi.fn();
const mockStopService = vi.fn();
const mockRestartService = vi.fn();

vi.mock('../../extensions/composables/useServiceActions', () => ({
	useServiceActions: () => ({
		startService: mockStartService,
		stopService: mockStopService,
		restartService: mockRestartService,
		isActing: vi.fn(),
	}),
}));

const baseNotification: INotification = {
	id: 'a1111111-1111-4111-8111-111111111111',
	source: 'system-module',
	kind: 'event' as INotification['kind'],
	key: null,
	severity: 'warning' as INotification['severity'],
	title: 'Something happened',
	message: null,
	actions: [],
	data: null,
	persistent: false,
	occurrences: 1,
	readAt: null,
	dismissedAt: null,
	resolvedAt: null,
	createdAt: new Date('2026-09-01T00:00:00.000Z'),
	updatedAt: null,
};

const linkAction = (url: string): INotificationAction => ({
	type: NotificationsModuleNotificationActionType.link,
	label: 'Open',
	url,
});

const extensionAction = (overrides: Partial<INotificationAction> = {}): INotificationAction => ({
	type: NotificationsModuleNotificationActionType.extension_action,
	label: 'Run action',
	extensionType: 'devices-home-assistant-plugin',
	actionId: 'reconnect',
	...overrides,
});

const serviceAction = (operation: NotificationsModuleNotificationActionOperation): INotificationAction => ({
	type: NotificationsModuleNotificationActionType.service,
	label: 'Restart service',
	extensionKind: ExtensionKind.plugin,
	extensionType: 'devices-shelly-ng-plugin',
	serviceId: 'shelly-ng-scanner',
	operation,
});

beforeEach(() => {
	vi.clearAllMocks();
	actionDescriptors.value = [];
});

describe('useNotificationAction', () => {
	describe('link actions', () => {
		it('pushes a relative url through the router', async () => {
			const { execute } = useNotificationAction();

			await execute(baseNotification, linkAction('/system/info'));

			expect(mockPush).toHaveBeenCalledWith('/system/info');
		});

		it('opens an absolute http(s) url in a new tab', async () => {
			const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null);

			const { execute } = useNotificationAction();

			await execute(baseNotification, linkAction('https://example.com/docs'));

			expect(openSpy).toHaveBeenCalledWith('https://example.com/docs', '_blank', 'noopener');
			expect(mockPush).not.toHaveBeenCalled();

			openSpy.mockRestore();
		});

		it('refuses any other scheme and executes nothing', async () => {
			const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null);

			const { execute } = useNotificationAction();

			await execute(baseNotification, linkAction('javascript:alert(1)'));

			expect(mockPush).not.toHaveBeenCalled();
			expect(openSpy).not.toHaveBeenCalled();
			expect(mockError).toHaveBeenCalled();

			openSpy.mockRestore();
		});
	});

	describe('extension_action actions', () => {
		it('fetches the descriptors and executes a non-dangerous action without confirming', async () => {
			mockFetchActions.mockImplementation(async () => {
				actionDescriptors.value = [{ id: 'reconnect', label: 'Reconnect', dangerous: false }];
			});
			mockExecuteAction.mockResolvedValue({ success: true });

			const { execute } = useNotificationAction();

			await execute(baseNotification, extensionAction({ params: { force: true } }));

			expect(mockFetchActions).toHaveBeenCalledWith('devices-home-assistant-plugin');
			expect(confirmMock).not.toHaveBeenCalled();
			expect(mockExecuteAction).toHaveBeenCalledWith('devices-home-assistant-plugin', 'reconnect', { force: true });
		});

		it('confirms before a dangerous action, then executes it', async () => {
			mockFetchActions.mockImplementation(async () => {
				actionDescriptors.value = [{ id: 'reconnect', label: 'Reconnect', dangerous: true }];
			});
			confirmMock.mockResolvedValueOnce(undefined);
			mockExecuteAction.mockResolvedValue({ success: true });

			const { execute } = useNotificationAction();

			await execute(baseNotification, extensionAction());

			expect(confirmMock).toHaveBeenCalled();
			expect(mockExecuteAction).toHaveBeenCalledWith('devices-home-assistant-plugin', 'reconnect', undefined);
		});

		it('does not execute a dangerous action when the confirmation is cancelled', async () => {
			mockFetchActions.mockImplementation(async () => {
				actionDescriptors.value = [{ id: 'reconnect', label: 'Reconnect', dangerous: true }];
			});
			confirmMock.mockRejectedValueOnce(new Error('cancel'));

			const { execute } = useNotificationAction();

			await execute(baseNotification, extensionAction());

			expect(confirmMock).toHaveBeenCalled();
			expect(mockExecuteAction).not.toHaveBeenCalled();
		});

		it('fails closed and executes nothing when the descriptor fetch fails', async () => {
			mockFetchActions.mockRejectedValue(new Error('network down'));

			const { execute } = useNotificationAction();

			await execute(baseNotification, extensionAction());

			expect(mockExecuteAction).not.toHaveBeenCalled();
			expect(confirmMock).not.toHaveBeenCalled();
			expect(mockError).toHaveBeenCalled();
		});

		it('fails closed and executes nothing when no descriptor matches action_id', async () => {
			mockFetchActions.mockImplementation(async () => {
				actionDescriptors.value = [{ id: 'some-other-action', label: 'Other' }];
			});

			const { execute } = useNotificationAction();

			await execute(baseNotification, extensionAction());

			expect(mockExecuteAction).not.toHaveBeenCalled();
			expect(mockError).toHaveBeenCalled();
		});

		it('executes nothing when the action carries no action_id', async () => {
			const { execute } = useNotificationAction();

			await execute(baseNotification, extensionAction({ actionId: undefined }));

			expect(mockFetchActions).not.toHaveBeenCalled();
			expect(mockExecuteAction).not.toHaveBeenCalled();
			expect(mockError).toHaveBeenCalled();
		});
	});

	describe('service actions', () => {
		it('starts a service without confirming', async () => {
			const { execute } = useNotificationAction();

			await execute(baseNotification, serviceAction(NotificationsModuleNotificationActionOperation.start));

			expect(confirmMock).not.toHaveBeenCalled();
			expect(mockStartService).toHaveBeenCalledWith(ExtensionKind.plugin, 'devices-shelly-ng-plugin', 'shelly-ng-scanner');
		});

		it('confirms before stopping a service, then stops it', async () => {
			confirmMock.mockResolvedValueOnce(undefined);

			const { execute } = useNotificationAction();

			await execute(baseNotification, serviceAction(NotificationsModuleNotificationActionOperation.stop));

			expect(confirmMock).toHaveBeenCalled();
			expect(mockStopService).toHaveBeenCalledWith(ExtensionKind.plugin, 'devices-shelly-ng-plugin', 'shelly-ng-scanner');
		});

		it('confirms before restarting a service, then restarts it', async () => {
			confirmMock.mockResolvedValueOnce(undefined);

			const { execute } = useNotificationAction();

			await execute(baseNotification, serviceAction(NotificationsModuleNotificationActionOperation.restart));

			expect(confirmMock).toHaveBeenCalled();
			expect(mockRestartService).toHaveBeenCalledWith(ExtensionKind.plugin, 'devices-shelly-ng-plugin', 'shelly-ng-scanner');
		});

		it('does not stop the service when the confirmation is cancelled', async () => {
			confirmMock.mockRejectedValueOnce(new Error('cancel'));

			const { execute } = useNotificationAction();

			await execute(baseNotification, serviceAction(NotificationsModuleNotificationActionOperation.stop));

			expect(confirmMock).toHaveBeenCalled();
			expect(mockStopService).not.toHaveBeenCalled();
		});
	});

	describe('isExecuting', () => {
		it('is true while an action is in flight and false once it settles', async () => {
			let resolveExecute!: (value: { success: boolean }) => void;
			mockFetchActions.mockImplementation(async () => {
				actionDescriptors.value = [{ id: 'reconnect', label: 'Reconnect' }];
			});
			mockExecuteAction.mockImplementation(
				() =>
					new Promise((resolve) => {
						resolveExecute = resolve;
					})
			);

			const { execute, isExecuting } = useNotificationAction();

			expect(isExecuting.value).toBe(false);

			const pending = execute(baseNotification, extensionAction());

			await vi.waitFor(() => expect(isExecuting.value).toBe(true));

			resolveExecute({ success: true });

			await pending;

			expect(isExecuting.value).toBe(false);
		});
	});
});
