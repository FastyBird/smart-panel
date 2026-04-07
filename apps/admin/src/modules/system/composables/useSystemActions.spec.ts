import { type VNode } from 'vue';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { EventHandlerName, EventType } from '../system.constants';

import { useSystemActions } from './useSystemActions';

vi.mock('vue-i18n', () => ({
	createI18n: () => ({ global: { locale: { value: 'en-US' }, getLocaleMessage: () => ({}), setLocaleMessage: () => {} } }),
	useI18n: () => ({
		t: (key: string) => key,
	}),
}));

const mocks = vi.hoisted(() => {
	return {
		confirm: vi.fn(),
	};
});

vi.mock('element-plus', async () => {
	const actual = await vi.importActual('element-plus');

	return {
		...actual,
		ElMessageBox: {
			confirm: mocks.confirm,
			close: vi.fn(),
		},
	};
});

const systemActionsService = {
	reboot: vi.fn(),
	serviceRestart: vi.fn(),
	powerOff: vi.fn(),
	factoryReset: vi.fn(),
};

vi.mock('../services/system-actions.service', () => ({
	injectSystemActionsService: vi.fn(() => systemActionsService),
}));

vi.mock('../../config/composables/composables', () => ({
	useConfigModule: () => ({
		configModule: { value: null },
	}),
}));

const backendClient = {
	GET: vi.fn(),
};

const socketClient = {
	sendCommand: vi.fn(),
};

vi.mock('../../../common', async () => {
	const actual = await vi.importActual('../../../common');

	return {
		...actual,
		useBackend: () => ({
			client: backendClient,
		}),
		useFlashMessage: () => ({
			success: vi.fn(),
			error: vi.fn(),
		}),
		useSockets: () => socketClient,
		injectAccountManager: () => ({
			signOut: vi.fn(),
			routes: {
				signIn: 'signIn',
			},
		}),
	};
});

/**
 * Extracts VNode button onClick handlers from the ElMessageBox.confirm call.
 * The first argument is a VNode tree: div > [p, div > [ElButton(service), ElButton(system)]]
 */
const getRestartButtonHandlers = (): { serviceRestart: () => void; systemReboot: () => void } => {
	const messageVNode = mocks.confirm.mock.calls[0][0] as VNode;
	const children = messageVNode.children as VNode[];
	const buttonContainer = children[1];
	const buttons = buttonContainer.children as VNode[];

	return {
		serviceRestart: (buttons[0].props as Record<string, () => void>).onClick,
		systemReboot: (buttons[1].props as Record<string, () => void>).onClick,
	};
};

describe('useSystemActions', () => {
	beforeEach(() => {
		vi.useFakeTimers();
		vi.clearAllMocks();
	});

	it('onRestart shows confirm dialog with restart options', async () => {
		mocks.confirm.mockRejectedValueOnce('close');

		const { onRestart } = useSystemActions();

		onRestart();

		await vi.runAllTimersAsync();

		expect(mocks.confirm).toHaveBeenCalled();
	});

	it('onRestart service restart button navigates and sends command', async () => {
		mocks.confirm.mockRejectedValueOnce('close');

		const { onRestart } = useSystemActions();

		onRestart();

		await vi.runAllTimersAsync();

		const { serviceRestart } = getRestartButtonHandlers();

		serviceRestart();

		await vi.runAllTimersAsync();

		expect(systemActionsService.serviceRestart).toHaveBeenCalled();
		expect(socketClient.sendCommand).toHaveBeenCalledWith(
			EventType.SYSTEM_SERVICE_RESTART_SET,
			null,
			EventHandlerName.INTERNAL_PLATFORM_ACTION,
		);
	});

	it('onRestart system reboot button navigates and sends command', async () => {
		mocks.confirm.mockRejectedValueOnce('close');

		const { onRestart } = useSystemActions();

		onRestart();

		await vi.runAllTimersAsync();

		const { systemReboot } = getRestartButtonHandlers();

		systemReboot();

		await vi.runAllTimersAsync();

		expect(systemActionsService.reboot).toHaveBeenCalled();
		expect(socketClient.sendCommand).toHaveBeenCalledWith(EventType.SYSTEM_REBOOT_SET, null, EventHandlerName.INTERNAL_PLATFORM_ACTION);
	});

	it('onPowerOff shows confirm and navigates', async () => {
		mocks.confirm.mockResolvedValueOnce(true);

		const { onPowerOff } = useSystemActions();

		onPowerOff();

		await vi.runAllTimersAsync();

		expect(mocks.confirm).toHaveBeenCalled();

		expect(socketClient.sendCommand).toHaveBeenCalledWith(EventType.SYSTEM_POWER_OFF_SET, null, EventHandlerName.INTERNAL_PLATFORM_ACTION);
	});

	it('onFactoryReset shows confirm and navigates', async () => {
		mocks.confirm.mockResolvedValueOnce(true);

		const { onFactoryReset } = useSystemActions();

		onFactoryReset();

		await vi.runAllTimersAsync();

		expect(mocks.confirm).toHaveBeenCalled();

		expect(socketClient.sendCommand).toHaveBeenCalledWith(EventType.SYSTEM_FACTORY_RESET_SET, null, EventHandlerName.INTERNAL_PLATFORM_ACTION, 30000);
	});

	it('closing restart dialog does nothing', async () => {
		mocks.confirm.mockRejectedValueOnce('close');

		const { onRestart } = useSystemActions();

		onRestart();

		await vi.runAllTimersAsync();

		expect(mocks.confirm).toHaveBeenCalled();

		expect(socketClient.sendCommand).not.toHaveBeenCalled();
		expect(systemActionsService.reboot).not.toHaveBeenCalled();
		expect(systemActionsService.serviceRestart).not.toHaveBeenCalled();
	});
});
