import { type EffectScope, effectScope, nextTick, ref } from 'vue';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useTailscaleSetup } from './useTailscaleSetup';

const install = vi.fn();
const get = vi.fn();
const data = ref<{ epoch?: string; setup?: { jobId: string; state: string; step: string | null; message: string | null } | null } | null>(null);
const setupProgress = ref<{ type: string; job: string; state: string; step?: string } | null>(null);
const semaphore = ref({ installing: false });
const store = { install, get, data, setupProgress, semaphore };
const scopes: EffectScope[] = [];

vi.mock('../../../common', async () => ({
	...(await vi.importActual('../../../common')),
	injectStoresManager: () => ({ getStore: () => store }),
}));

const useSetup = () => {
	const scope = effectScope();
	scopes.push(scope);
	return scope.run(() => useTailscaleSetup())!;
};
const job = (jobId: string, state: string) => ({ jobId, state, step: null, message: null });

describe('useTailscaleSetup reconciliation', () => {
	beforeEach(() => {
		vi.useFakeTimers();
		install.mockReset().mockResolvedValue({ job: 'job-new' });
		get.mockReset().mockResolvedValue({});
		data.value = null;
		setupProgress.value = null;
		semaphore.value = { installing: false };
	});
	afterEach(() => {
		for (const scope of scopes.splice(0)) scope.stop();
		vi.useRealTimers();
	});

	it('starts immediate and recurring REST reconciliation on acceptance when every event is lost', async () => {
		const setup = useSetup();
		await setup.install();
		expect(get).toHaveBeenCalledTimes(1);
		expect(setup.isPolling.value).toBe(true);
		await vi.advanceTimersByTimeAsync(3_000);
		expect(get).toHaveBeenCalledTimes(2);
		data.value = { setup: job('job-new', 'complete') };
		await nextTick();
		expect(setup.isPolling.value).toBe(false);
		await vi.advanceTimersByTimeAsync(6_000);
		expect(get).toHaveBeenCalledTimes(2);
	});

	it('ignores terminal status and late events from an older install', async () => {
		data.value = { setup: job('job-old', 'failed') };
		setupProgress.value = { type: 'provider', job: 'job-old', state: 'failed' };
		const setup = useSetup();
		await setup.install();
		expect(setup.progress.value).toMatchObject({ job: 'job-new', state: 'running' });
		setupProgress.value = { type: 'provider', job: 'job-old', state: 'complete' };
		await nextTick();
		expect(setup.progress.value).toMatchObject({ job: 'job-new', state: 'running' });
		expect(setup.isPolling.value).toBe(true);
	});

	it('recovers a missed final event using terminal REST for the same job', async () => {
		const setup = useSetup();
		await setup.install();
		setupProgress.value = { type: 'provider', job: 'job-new', state: 'running', step: 'installing' };
		data.value = { setup: job('job-new', 'complete') };
		await nextTick();
		expect(setup.progress.value).toMatchObject({ job: 'job-new', state: 'complete' });
		expect(setup.isPolling.value).toBe(false);
	});

	it('resumes a running job after reload', async () => {
		data.value = { setup: job('job-running', 'running') };
		const setup = useSetup();
		expect(setup.progress.value).toMatchObject({ job: 'job-running', state: 'running' });
		expect(setup.isPolling.value).toBe(true);
		await vi.advanceTimersByTimeAsync(3_000);
		expect(get).toHaveBeenCalled();
	});

	it('retries transient failures without failing an accepted install', async () => {
		get.mockRejectedValueOnce(new Error('offline')).mockResolvedValue({});
		const setup = useSetup();
		await expect(setup.install()).resolves.toBe('job-new');
		await vi.advanceTimersByTimeAsync(3_000);
		expect(get).toHaveBeenCalledTimes(2);
		expect(setup.isPolling.value).toBe(true);
	});

	it('coalesces callers and waits for an in-flight read before scheduling another', async () => {
		let resolveRead!: () => void;
		get.mockImplementationOnce(
			() =>
				new Promise<void>((resolve) => {
					resolveRead = resolve;
				})
		);
		const first = useSetup();
		const second = useSetup();
		await first.install();
		await vi.advanceTimersByTimeAsync(30_000);
		expect(get).toHaveBeenCalledTimes(1);
		first.stopPolling();
		expect(second.isPolling.value).toBe(true);
		resolveRead();
		await vi.advanceTimersByTimeAsync(3_000);
		expect(get).toHaveBeenCalledTimes(2);
		scopes[1]!.stop();
		await vi.advanceTimersByTimeAsync(9_000);
		expect(get).toHaveBeenCalledTimes(2);
	});

	it('does not restart a paused caller on a later running event', async () => {
		const setup = useSetup();
		setup.stopPolling();
		data.value = { setup: job('job-new', 'running') };
		await nextTick();
		await vi.advanceTimersByTimeAsync(6_000);
		expect(get).not.toHaveBeenCalled();
	});

	it('settles an accepted job when a backend restart loses the job record', async () => {
		data.value = { epoch: 'before', setup: null };
		const setup = useSetup();
		await setup.install();
		data.value = { epoch: 'after', setup: null };
		await nextTick();
		expect(setup.progress.value).toMatchObject({ job: 'job-new', state: 'timeout' });
		expect(setup.isPolling.value).toBe(false);
	});

	it('bounds reconciliation when no terminal status can be recovered', async () => {
		const setup = useSetup();
		await setup.install();
		await vi.advanceTimersByTimeAsync(12 * 60 * 1_000);
		expect(setup.progress.value?.state).toBe('timeout');
		expect(setup.isPolling.value).toBe(false);
	});

	it('does not start reads after a late accepted POST outlives the last caller', async () => {
		let resolveInstall!: (result: { job: string }) => void;
		install.mockImplementationOnce(
			() =>
				new Promise((resolve) => {
					resolveInstall = resolve;
				})
		);
		const setup = useSetup();
		const pendingInstall = setup.install();
		scopes[0]!.stop();
		resolveInstall({ job: 'job-new' });
		await pendingInstall;
		await vi.advanceTimersByTimeAsync(6_000);
		expect(get).not.toHaveBeenCalled();
	});

	it('leaves no poll after a rejected install', async () => {
		install.mockRejectedValue(new Error('busy'));
		const setup = useSetup();
		await expect(setup.install()).rejects.toThrow('busy');
		expect(setup.isPolling.value).toBe(false);
		await vi.advanceTimersByTimeAsync(6_000);
		expect(get).not.toHaveBeenCalled();
	});
});
