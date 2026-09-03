import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useTailscaleLogin } from './useTailscaleLogin';

const login = vi.fn();
const get = vi.fn();

vi.mock('../../../common', async () => {
	const actual = await vi.importActual('../../../common');

	return {
		...actual,
		injectStoresManager: () => ({
			getStore: () => ({ login, get }),
		}),
	};
});

describe('useTailscaleLogin', () => {
	beforeEach(() => {
		login.mockReset();
		get.mockReset();
	});

	afterEach(() => {
		// The poll handle is a module-level singleton (mirrors `useUpdateStatus.ts`) - stop it and
		// restore real timers so a poll left running by one test can never bleed into the next.
		useTailscaleLogin().stopPolling();
		vi.useRealTimers();
	});

	it('does not poll when a keyed login resolves connected immediately', async () => {
		login.mockResolvedValue({ state: 'connected' });
		const { login: doLogin, isPolling } = useTailscaleLogin();

		const result = await doLogin('tskey-auth-secret');

		expect(result.state).toBe('connected');
		expect(isPolling.value).toBe(false);
	});

	it('starts polling when the result is pending-auth', async () => {
		login.mockResolvedValue({ state: 'pending-auth', authUrl: 'https://login.tailscale.com/a/x', qr: 'data:image/png;base64,x' });
		const { login: doLogin, isPolling } = useTailscaleLogin();

		await doLogin();

		expect(isPolling.value).toBe(true);
	});

	it('polls GET /status every 3 seconds while pending-auth', async () => {
		vi.useFakeTimers();
		login.mockResolvedValue({ state: 'pending-auth' });
		get.mockResolvedValue({ state: 'pending-auth' });
		const { login: doLogin } = useTailscaleLogin();

		await doLogin();

		await vi.advanceTimersByTimeAsync(3_000);
		expect(get).toHaveBeenCalledTimes(1);

		await vi.advanceTimersByTimeAsync(3_000);
		expect(get).toHaveBeenCalledTimes(2);
	});

	it('stops polling once the node reports connected', async () => {
		vi.useFakeTimers();
		login.mockResolvedValue({ state: 'pending-auth' });
		get.mockResolvedValueOnce({ state: 'pending-auth' }).mockResolvedValueOnce({ state: 'connected' });
		const { login: doLogin, isPolling } = useTailscaleLogin();

		await doLogin();

		await vi.advanceTimersByTimeAsync(3_000);
		expect(isPolling.value).toBe(true);

		await vi.advanceTimersByTimeAsync(3_000);
		expect(isPolling.value).toBe(false);

		const calls = get.mock.calls.length;
		await vi.advanceTimersByTimeAsync(3_000);
		expect(get.mock.calls.length).toBe(calls);
	});

	it('stops polling once the node reports an error', async () => {
		vi.useFakeTimers();
		login.mockResolvedValue({ state: 'pending-auth' });
		get.mockResolvedValue({ state: 'error' });
		const { login: doLogin, isPolling } = useTailscaleLogin();

		await doLogin();
		await vi.advanceTimersByTimeAsync(3_000);

		expect(isPolling.value).toBe(false);
	});

	it('gives up after the ten-minute absolute deadline even if still pending-auth', async () => {
		vi.useFakeTimers();
		login.mockResolvedValue({ state: 'pending-auth' });
		get.mockResolvedValue({ state: 'pending-auth' });
		const { login: doLogin, isPolling } = useTailscaleLogin();

		await doLogin();

		await vi.advanceTimersByTimeAsync(10 * 60 * 1000 + 1_000);

		expect(isPolling.value).toBe(false);

		const calls = get.mock.calls.length;
		await vi.advanceTimersByTimeAsync(10_000);
		expect(get.mock.calls.length).toBe(calls);
	});

	it('stops polling when the caller closes the wizard', async () => {
		vi.useFakeTimers();
		login.mockResolvedValue({ state: 'pending-auth' });
		get.mockResolvedValue({ state: 'pending-auth' });
		const { login: doLogin, isPolling, stopPolling } = useTailscaleLogin();

		await doLogin();
		expect(isPolling.value).toBe(true);

		stopPolling();

		expect(isPolling.value).toBe(false);

		const calls = get.mock.calls.length;
		await vi.advanceTimersByTimeAsync(10_000);
		expect(get.mock.calls.length).toBe(calls);
	});

	it('a transient poll failure does not stop the poll', async () => {
		vi.useFakeTimers();
		login.mockResolvedValue({ state: 'pending-auth' });
		get.mockRejectedValueOnce(new Error('network blip')).mockResolvedValueOnce({ state: 'pending-auth' });
		const { login: doLogin, isPolling } = useTailscaleLogin();

		await doLogin();

		await vi.advanceTimersByTimeAsync(3_000);
		expect(isPolling.value).toBe(true);

		await vi.advanceTimersByTimeAsync(3_000);
		expect(get).toHaveBeenCalledTimes(2);
		expect(isPolling.value).toBe(true);
	});

	it('exposes isLoggingIn only while the login request is in flight', async () => {
		let resolveLogin: ((value: { state: string }) => void) | undefined;
		login.mockReturnValue(
			new Promise((resolve) => {
				resolveLogin = resolve;
			})
		);
		const { login: doLogin, isLoggingIn } = useTailscaleLogin();

		const request = doLogin();

		expect(isLoggingIn.value).toBe(true);

		resolveLogin?.({ state: 'connected' });
		await request;

		expect(isLoggingIn.value).toBe(false);
	});
});
