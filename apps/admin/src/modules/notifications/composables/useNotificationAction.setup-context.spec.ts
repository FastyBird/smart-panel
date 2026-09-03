import { type App, defineComponent } from 'vue';
import { createI18n } from 'vue-i18n';

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { mount } from '@vue/test-utils';

import { StoresManager, provideStoresManager } from '../../../common';
import {
	ExtensionKind,
	ExtensionsModuleServiceState,
	NotificationsModuleNotificationActionOperation,
	NotificationsModuleNotificationActionType,
} from '../../../openapi.constants';
import { servicesStoreKey } from '../../extensions/store/keys';
import { locales as notificationsLocales } from '../locales';
import type { INotification, INotificationAction } from '../store/notifications.store.schemas';

import { useNotificationAction } from './useNotificationAction';

// Unlike `useNotificationAction.spec.ts`, `vue-i18n` is left real here on purpose: the bug this
// file guards against (finding 4) is specifically that `useServiceActions()`'s first operation,
// `useI18n()`, throws when there is no active component instance - a mock that ignores setup
// context could never catch a regression back to calling it lazily inside `executeService`.

const mockPush = vi.fn();

vi.mock('vue-router', async () => {
	const actual = await vi.importActual('vue-router');

	return {
		...actual,
		useRouter: () => ({ push: mockPush }),
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

// `useActions()` is mocked - the extension_action test below only cares about the real `t()`
// interpolation (finding 3), not about `useActions`'s own setup-context needs.
vi.mock('../../extensions/composables/useActions', () => ({
	useActions: () => ({
		actions: { value: [{ id: 'reconnect', label: 'Reconnect', dangerous: true }] },
		isLoading: { value: false },
		executingActions: { value: new Map() },
		fetchActions: vi.fn().mockResolvedValue(undefined),
		executeAction: vi.fn().mockResolvedValue({ success: true }),
		fetchActionHistory: vi.fn(),
	}),
}));

const mockStartService = vi.fn();

// `useServiceActions` itself is left real (unlike the rest of the file's dependencies) - its own
// `injectStoresManager()` call still needs a provided stores manager, stubbed via the real
// `provideStoresManager`/`StoresManager` below.
vi.mock('../../../common', async () => {
	const actual = await vi.importActual<typeof import('../../../common')>('../../../common');

	return {
		...actual,
		useFlashMessage: () => ({ success: vi.fn(), error: vi.fn(), info: vi.fn(), warning: vi.fn() }),
	};
});

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

/**
 * Mounts a throwaway component whose `setup()` calls `useNotificationAction()` - matching how
 * `notification-popover.vue`/`notification-actions.vue` do it - then hands back the result once
 * `mount()` has returned. Everything the caller does with it from there on runs with no active
 * component instance, exactly like a real `@click`/`@action` handler firing well after mount.
 */
const mountNotificationAction = (): ReturnType<typeof useNotificationAction> => {
	let result!: ReturnType<typeof useNotificationAction>;

	const TestComponent = defineComponent({
		setup() {
			result = useNotificationAction();

			return () => null;
		},
	});

	const i18n = createI18n({
		legacy: false,
		locale: 'en-US',
		messages: {
			'en-US': { notificationsModule: notificationsLocales['en-US'] },
		},
	});

	const storesManager = new StoresManager();
	storesManager.addStore(servicesStoreKey, {
		start: mockStartService,
		stop: vi.fn(),
		restart: vi.fn(),
		acting: vi.fn(),
	} as unknown as ReturnType<StoresManager['getStore']>);

	const storesManagerPlugin = {
		install(app: App): void {
			provideStoresManager(app, storesManager);
		},
	};

	mount(TestComponent, {
		global: {
			plugins: [i18n, storesManagerPlugin],
		},
	});

	return result;
};

describe('useNotificationAction used outside a component setup', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mockStartService.mockResolvedValue({ state: ExtensionsModuleServiceState.started });
	});

	// Reproduces the actual bug: `notification-popover.vue`/`notification-actions.vue` call
	// `useNotificationAction()` during their own `setup()`, but `execute()` itself only runs later
	// from a `@click`/`@action` handler - by which point `mount()` has already returned and no
	// component instance is active.
	it('executes a service action after the owning component has finished mounting', async () => {
		const { execute } = mountNotificationAction();

		const action: INotificationAction = {
			type: NotificationsModuleNotificationActionType.service,
			label: 'Start scanner',
			extensionKind: ExtensionKind.plugin,
			extensionType: 'devices-shelly-ng-plugin',
			serviceId: 'shelly-ng-scanner',
			operation: NotificationsModuleNotificationActionOperation.start,
		};

		await expect(execute(baseNotification, action)).resolves.toBeUndefined();

		expect(mockStartService).toHaveBeenCalledWith({
			extensionKind: ExtensionKind.plugin,
			extensionType: 'devices-shelly-ng-plugin',
			serviceId: 'shelly-ng-scanner',
		});
	});

	// Finding 3: the confirmation copy interpolates both `{title}` and `{label}` - this exercises
	// the real vue-i18n interpolation (not a `t: (key) => key` stand-in) so a missing `label` shows
	// up as a literal, untranslated placeholder in the assembled message rather than passing silently.
	it('interpolates both the notification title and the action label into a dangerous confirmation', async () => {
		confirmMock.mockResolvedValueOnce(undefined);

		const { execute } = mountNotificationAction();

		const action: INotificationAction = {
			type: NotificationsModuleNotificationActionType.extension_action,
			label: 'Run action',
			extensionType: 'devices-home-assistant-plugin',
			actionId: 'reconnect',
		};

		await execute({ ...baseNotification, title: 'Bridge offline' }, action);

		expect(confirmMock).toHaveBeenCalled();

		const [message] = confirmMock.mock.calls[0] as [string, string];

		expect(message).toContain('Bridge offline');
		expect(message).toContain('Reconnect');
		expect(message).not.toContain('{label}');
	});
});
