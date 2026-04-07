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
	let closedCallback: (() => void) | undefined;

	return {
		confirm: vi.fn(),
		service: vi.fn((options) => {
			closedCallback = options.closed;
			return {
				close: () => {
					closedCallback?.();
				},
			};
		}),
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

describe('useSystemActions', () => {
	beforeEach(() => {
		vi.useFakeTimers();
		vi.clearAllMocks();
	});

	it('onRestart shows confirm box', async () => {
		mocks.confirm.mockRejectedValueOnce('close');

		const { onRestart } = useSystemActions();

		onRestart();

		await vi.runAllTimersAsync();

		expect(mocks.confirm).toHaveBeenCalled();
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

	it('canceling confirm does nothing', async () => {
		mocks.confirm.mockRejectedValueOnce(new Error('cancel'));

		const { onRestart } = useSystemActions();

		onRestart();

		await vi.runAllTimersAsync();

		expect(mocks.confirm).toHaveBeenCalled();

		expect(socketClient.sendCommand).not.toHaveBeenCalled();
	});
});
