import { nextTick, ref } from 'vue';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useTailscaleSetup } from './useTailscaleSetup';

const install = vi.fn();
const get = vi.fn();

const data = ref<{ setup?: { state: string } | null } | null>(null);
const setupProgress = ref<{ state: string } | null>(null);
const semaphore = ref<{ installing: boolean }>({ installing: false });

vi.mock('../../../common', async () => {
	const actual = await vi.importActual('../../../common');

	return {
		...actual,
		injectStoresManager: () => ({
			getStore: () => ({ install, get, data, setupProgress, semaphore }),
		}),
	};
});

describe('useTailscaleSetup', () => {
	beforeEach(() => {
		install.mockReset();
		get.mockReset();
		data.value = null;
		setupProgress.value = null;
		semaphore.value = { installing: false };
	});

	afterEach(() => {
		// The poll handle is a module-level singleton (mirrors `useTailscaleLogin.ts`) - stop it and
		// restore real timers so a poll left running by one test can never bleed into the next.
		useTailscaleSetup().stopPolling();
		vi.useRealTimers();
	});

	it('does not poll when no status has been loaded yet', () => {
		const { isPolling } = useTailscaleSetup();

		expect(isPolling.value).toBe(false);
	});

	it('does not poll when the loaded status carries no setup job', () => {
		data.value = { setup: null };

		const { isPolling } = useTailscaleSetup();

		expect(isPolling.value).toBe(false);
	});

	it('starts polling immediately when the loaded status already reports a running job (resuming after a reload)', () => {
		// Simulates a page reload: the composable is created fresh, but `data.setup.state` is
		// already `running` from the very first `GET /status` this page made - no `install()` call
		// happened in this session at all.
		data.value = { setup: { state: 'running' } };

		const { isPolling } = useTailscaleSetup();

		expect(isPolling.value).toBe(true);
	});

	it('starts polling once install() resolves and the store status turns running', async () => {
		install.mockResolvedValue({ job: 'job-123' });
		const { install: doInstall, isPolling } = useTailscaleSetup();

		expect(isPolling.value).toBe(false);

		await doInstall();
		// `install()` itself never updates `data.setup` (that only ever comes from `GET /status`
		// or a `Setup.Progress` websocket event) - simulate the next status read/event doing so.
		data.value = { setup: { state: 'running' } };
		await nextTick();

		expect(isPolling.value).toBe(true);
	});

	it('polls GET /status every 3 seconds while the job is running', async () => {
		vi.useFakeTimers();
		get.mockResolvedValue({});
		data.value = { setup: { state: 'running' } };
		useTailscaleSetup();

		await vi.advanceTimersByTimeAsync(3_000);
		expect(get).toHaveBeenCalledTimes(1);

		await vi.advanceTimersByTimeAsync(3_000);
		expect(get).toHaveBeenCalledTimes(2);
	});

	it.each(['complete', 'failed', 'timeout'])('stops polling once the job reaches a terminal state (%s)', async (state) => {
		data.value = { setup: { state: 'running' } };
		const { isPolling } = useTailscaleSetup();
		expect(isPolling.value).toBe(true);

		data.value = { setup: { state } };
		await nextTick();

		expect(isPolling.value).toBe(false);
	});

	it('a transient poll failure does not stop the poll', async () => {
		vi.useFakeTimers();
		get.mockRejectedValueOnce(new Error('network blip')).mockResolvedValueOnce({});
		data.value = { setup: { state: 'running' } };
		const { isPolling } = useTailscaleSetup();

		await vi.advanceTimersByTimeAsync(3_000);
		expect(isPolling.value).toBe(true);

		await vi.advanceTimersByTimeAsync(3_000);
		expect(get).toHaveBeenCalledTimes(2);
		expect(isPolling.value).toBe(true);
	});

	it('stops polling when the caller stops it explicitly (mirrors the wizard unmounting)', () => {
		data.value = { setup: { state: 'running' } };
		const { isPolling, stopPolling } = useTailscaleSetup();

		expect(isPolling.value).toBe(true);

		stopPolling();

		expect(isPolling.value).toBe(false);
	});

	it('does not start a second interval when polling is already running', async () => {
		vi.useFakeTimers();
		get.mockResolvedValue({});
		data.value = { setup: { state: 'running' } };
		useTailscaleSetup();
		// A second composable instance (e.g. a second render) must not double the poll rate.
		useTailscaleSetup();

		await vi.advanceTimersByTimeAsync(3_000);
		expect(get).toHaveBeenCalledTimes(1);
	});

	it('exposes progress from the store `Setup.Progress` websocket event', () => {
		setupProgress.value = { state: 'running' };

		const { progress } = useTailscaleSetup();

		expect(progress.value).toEqual({ state: 'running' });
	});

	it('exposes isInstalling from the store semaphore', () => {
		semaphore.value = { installing: true };

		const { isInstalling } = useTailscaleSetup();

		expect(isInstalling.value).toBe(true);
	});
});
