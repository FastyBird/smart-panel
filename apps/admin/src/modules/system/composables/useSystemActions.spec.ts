import { beforeEach, describe, expect, it, vi } from 'vitest';

import { SystemActionsService, injectSystemActionsService } from '../services/system-actions-service.ts';
import { EventHandlerName, EventType } from '../system.constants';

import { useSystemActions } from './useSystemActions';

vi.mock('vue-i18n', () => ({
	useI18n: () => ({
		t: (key: string) => key,
	}),
}));

const mocks = vi.hoisted(() => {
	let closedCallback: (() => void) | undefined;

	return {
		confirm: vi.fn(),
		routerPush: vi.fn(),
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

vi.mock('vue-router', () => ({
	useRouter: () => ({
		push: mocks.routerPush,
	}),
}));

vi.mock('element-plus', async () => {
	const actual = await vi.importActual('element-plus');

	return {
		...actual,
		ElMessageBox: {
			confirm: mocks.confirm,
		},
		ElLoading: {
			service: mocks.service,
		},
	};
});

vi.mock('../services/system-actions-service', () => ({
	injectSystemActionsService: vi.fn(() => SystemActionsService),
}));

const backendClient = {
	GET: vi.fn(),
};

const socketClient = {
	sendCommand: vi.fn(),
};

vi.mock('../../../common', () => ({
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
}));

describe('useSystemActions', () => {
	beforeEach(() => {
		vi.useFakeTimers();
		vi.clearAllMocks();
	});

	it('onRestart shows confirm box and navigates', async () => {
		mocks.confirm.mockResolvedValueOnce(true);

		const { onRestart } = useSystemActions();

		onRestart();

		await vi.runAllTimersAsync();

		expect(mocks.confirm).toHaveBeenCalled();
		expect(mocks.service).toHaveBeenCalled();

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

		expect(socketClient.sendCommand).toHaveBeenCalledWith(EventType.SYSTEM_FACTORY_RESET_SET, null, EventHandlerName.INTERNAL_PLATFORM_ACTION);
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
