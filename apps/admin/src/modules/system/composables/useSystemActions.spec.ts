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

describe('useSystemActions', () => {
	beforeEach(() => {
		vi.useFakeTimers();
		vi.clearAllMocks();
	});

	it('onRestart confirm triggers service restart', async () => {
		mocks.confirm.mockResolvedValueOnce('confirm');

		const { onRestart } = useSystemActions();

		onRestart();

		await vi.runAllTimersAsync();

		expect(mocks.confirm).toHaveBeenCalled();
		expect(systemActionsService.serviceRestart).toHaveBeenCalled();
		expect(socketClient.sendCommand).toHaveBeenCalledWith(
			EventType.SYSTEM_SERVICE_RESTART_SET,
			null,
			EventHandlerName.INTERNAL_PLATFORM_ACTION,
		);
	});

	it('onRestart cancel triggers system reboot', async () => {
		mocks.confirm.mockRejectedValueOnce('cancel');

		const { onRestart } = useSystemActions();

		onRestart();

		await vi.runAllTimersAsync();

		expect(mocks.confirm).toHaveBeenCalled();
		expect(systemActionsService.reboot).toHaveBeenCalled();
		expect(socketClient.sendCommand).toHaveBeenCalledWith(EventType.SYSTEM_REBOOT_SET, null, EventHandlerName.INTERNAL_PLATFORM_ACTION);
	});

	it('onRestart close dismisses without action', async () => {
		mocks.confirm.mockRejectedValueOnce('close');

		const { onRestart } = useSystemActions();

		onRestart();

		await vi.runAllTimersAsync();

		expect(mocks.confirm).toHaveBeenCalled();
		expect(socketClient.sendCommand).not.toHaveBeenCalled();
		expect(systemActionsService.reboot).not.toHaveBeenCalled();
		expect(systemActionsService.serviceRestart).not.toHaveBeenCalled();
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
});
