import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { RemoteAccessTailscaleException } from '../remote-access-tailscale.exceptions';

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

	describe('overlapping attempts', () => {
		it('rejects a second login() call while the first is still in flight', async () => {
			let resolveFirst: ((value: { state: string }) => void) | undefined;
			login.mockReturnValueOnce(
				new Promise((resolve) => {
					resolveFirst = resolve;
				})
			);
			const { login: doLogin, isLoggingIn } = useTailscaleLogin();

			const first = doLogin();

			expect(isLoggingIn.value).toBe(true);
			await expect(doLogin()).rejects.toBeInstanceOf(RemoteAccessTailscaleException);
			// The rejected call never touched the backend.
			expect(login).toHaveBeenCalledTimes(1);

			resolveFirst?.({ state: 'connected' });
			await expect(first).resolves.toEqual({ state: 'connected' });
			expect(isLoggingIn.value).toBe(false);
		});

		it.each([['connected'], ['error']])(
			'discards a stale poll tick that resolves to %s after a newer attempt has already taken over the poll',
			async (staleState) => {
				vi.useFakeTimers();
				login.mockResolvedValueOnce({ state: 'pending-auth' });
				const { login: doLogin, isPolling } = useTailscaleLogin();

				await doLogin();
				expect(isPolling.value).toBe(true);

				// The first attempt's poll ticks and calls get(), but that call is left pending -
				// it will resolve only after a newer attempt has already superseded it below.
				let resolveStaleGet: ((value: { state: string }) => void) | undefined;
				get.mockReturnValueOnce(
					new Promise((resolve) => {
						resolveStaleGet = resolve;
					})
				);
				await vi.advanceTimersByTimeAsync(3_000);
				expect(get).toHaveBeenCalledTimes(1);

				// A second, newer attempt starts and takes over the poll while the first tick is
				// still awaiting its response.
				login.mockResolvedValueOnce({ state: 'pending-auth' });
				await doLogin();
				expect(isPolling.value).toBe(true);

				// The stale tick now resolves - even to a terminal status - after being
				// superseded; it must not touch the newer attempt's poll.
				resolveStaleGet?.({ state: staleState });
				await vi.advanceTimersByTimeAsync(0);

				expect(isPolling.value).toBe(true);

				// The newer attempt's own poll is still the one ticking.
				get.mockResolvedValue({ state: 'pending-auth' });
				const callsBeforeNextTick = get.mock.calls.length;
				await vi.advanceTimersByTimeAsync(3_000);
				expect(get.mock.calls.length).toBe(callsBeforeNextTick + 1);
			}
		);

		it('a newer attempt still stops its own poll normally once the node connects', async () => {
			vi.useFakeTimers();
			login.mockResolvedValueOnce({ state: 'pending-auth' });
			const { login: doLogin, isPolling } = useTailscaleLogin();

			await doLogin();

			let resolveStaleGet: ((value: { state: string }) => void) | undefined;
			get.mockReturnValueOnce(
				new Promise((resolve) => {
					resolveStaleGet = resolve;
				})
			);
			await vi.advanceTimersByTimeAsync(3_000);

			login.mockResolvedValueOnce({ state: 'pending-auth' });
			await doLogin();

			// The stale first-attempt tick finally resolves as pending, a no-op either way since
			// it belongs to the superseded attempt.
			resolveStaleGet?.({ state: 'pending-auth' });

			// The second attempt's own poll then genuinely finds the node connected and stops.
			get.mockResolvedValue({ state: 'connected' });
			await vi.advanceTimersByTimeAsync(3_000);

			expect(isPolling.value).toBe(false);
		});
	});
});
