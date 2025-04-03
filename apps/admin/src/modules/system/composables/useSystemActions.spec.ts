import { beforeEach, describe, expect, it, vi } from 'vitest';

import { RouteNames } from '../../../app.constants';

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

		expect(mocks.routerPush).toHaveBeenCalledWith({ name: RouteNames.ROOT });
	});

	it('onPowerOff shows confirm and navigates', async () => {
		mocks.confirm.mockResolvedValueOnce(true);

		const { onPowerOff } = useSystemActions();

		onPowerOff();

		await vi.runAllTimersAsync();

		expect(mocks.confirm).toHaveBeenCalled();
		expect(mocks.routerPush).toHaveBeenCalledWith({ name: RouteNames.ROOT });
	});

	it('onFactoryReset shows confirm and navigates', async () => {
		mocks.confirm.mockResolvedValueOnce(true);

		const { onFactoryReset } = useSystemActions();

		onFactoryReset();

		await vi.runAllTimersAsync();

		expect(mocks.confirm).toHaveBeenCalled();
		expect(mocks.routerPush).toHaveBeenCalledWith({ name: RouteNames.ROOT });
	});

	it('canceling confirm does nothing', async () => {
		mocks.confirm.mockRejectedValueOnce(new Error('cancel'));

		const { onRestart } = useSystemActions();

		onRestart();

		await vi.runAllTimersAsync();

		expect(mocks.confirm).toHaveBeenCalled();
		expect(mocks.routerPush).not.toHaveBeenCalled();
	});
});
