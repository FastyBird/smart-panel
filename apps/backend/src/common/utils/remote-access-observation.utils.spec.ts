import { RemoteAccessObservation } from './remote-access-observation.utils';

describe('RemoteAccessObservation', () => {
	afterEach(() => jest.useRealTimers());

	it('joins all callers to one live read, and starts a new read after completion', async () => {
		const observations = new RemoteAccessObservation<number>();
		let resolve!: (value: number) => void;
		const work = jest.fn(
			() =>
				new Promise<number>((done) => {
					resolve = done;
				}),
		);
		const first = observations.run(work);
		const second = observations.run(work);
		await Promise.resolve();
		expect(work).toHaveBeenCalledTimes(1);
		resolve(4);
		await expect(first).resolves.toBe(4);
		await expect(second).resolves.toBe(4);
		await expect(observations.run(() => Promise.resolve(5))).resolves.toBe(5);
	});

	it('aborts at the deadline and retains the read slot until cancelled work settles', async () => {
		jest.useFakeTimers();
		const observations = new RemoteAccessObservation<number>(50);
		let signal!: AbortSignal;
		let resolve!: (value: number) => void;
		const work = jest.fn((readSignal: AbortSignal) => {
			signal = readSignal;
			return new Promise<number>((done) => {
				resolve = done;
			});
		});
		const pending = observations.run(work);
		const failed = expect(pending).rejects.toThrow('timed out');
		await jest.advanceTimersByTimeAsync(50);
		await failed;
		expect(signal.aborted).toBe(true);
		for (let index = 0; index < 20; index++) {
			const retry = expect(observations.run(work)).rejects.toThrow('timed out');
			await jest.advanceTimersByTimeAsync(50);
			await retry;
		}
		expect(work).toHaveBeenCalledTimes(1);
		expect(jest.getTimerCount()).toBe(0);
		resolve(1);
		await jest.advanceTimersByTimeAsync(0);
		expect(work).toHaveBeenCalledTimes(1);
		await expect(observations.run(() => Promise.resolve(2))).resolves.toBe(2);
	});

	it('waits for invalidated work to settle and coalesces callers into one fresh read', async () => {
		jest.useFakeTimers();
		const observations = new RemoteAccessObservation<number>(50);
		let resolveActual!: (value: number) => void;
		const pending = observations.run(
			() =>
				new Promise<number>((resolve) => {
					resolveActual = resolve;
				}),
		);
		await Promise.resolve();
		observations.invalidate();
		await expect(pending).rejects.toThrow('superseded');
		const freshWork = jest.fn(() => Promise.resolve(2));
		const first = observations.run(freshWork);
		const second = observations.run(freshWork);
		await jest.advanceTimersByTimeAsync(25);
		expect(freshWork).not.toHaveBeenCalled();
		resolveActual(1);
		await expect(first).resolves.toBe(2);
		await expect(second).resolves.toBe(2);
		expect(freshWork).toHaveBeenCalledTimes(1);
		expect(jest.getTimerCount()).toBe(0);
	});

	it('cancels an idle waiter without retrying or preventing another caller from recovering', async () => {
		jest.useFakeTimers();
		const observations = new RemoteAccessObservation<number>(50);
		let resolveActual!: (value: number) => void;
		const pending = observations.run(
			() =>
				new Promise<number>((resolve) => {
					resolveActual = resolve;
				}),
		);
		await Promise.resolve();
		observations.invalidate();
		await expect(pending).rejects.toThrow('superseded');
		const abort = new AbortController();
		const cancelledWork = jest.fn(() => Promise.resolve(2));
		const cancelled = observations.run(cancelledWork, abort.signal);
		const freshWork = jest.fn(() => Promise.resolve(3));
		const fresh = observations.run(freshWork);
		abort.abort(new Error('cancelled'));
		await expect(cancelled).rejects.toThrow('cancelled');
		resolveActual(1);
		await expect(fresh).resolves.toBe(3);
		expect(cancelledWork).not.toHaveBeenCalled();
		expect(freshWork).toHaveBeenCalledTimes(1);
		expect(jest.getTimerCount()).toBe(0);
	});

	it('exposes actual idle completion after its aborted result has already rejected', async () => {
		const observations = new RemoteAccessObservation<number>();
		let resolveActual!: (value: number) => void;
		const pending = observations.run(
			() =>
				new Promise<number>((resolve) => {
					resolveActual = resolve;
				}),
		);
		await Promise.resolve();
		observations.invalidate();
		await expect(pending).rejects.toThrow('superseded');
		let idle = false;
		const cleanup = observations.awaitIdle().then(() => {
			idle = true;
		});
		await Promise.resolve();
		expect(idle).toBe(false);
		resolveActual(1);
		await cleanup;
		await expect(observations.run(() => Promise.resolve(2))).resolves.toBe(2);
	});

	it('propagates caller cancellation to the actual shared work', async () => {
		const observations = new RemoteAccessObservation<number>();
		const abort = new AbortController();
		const pending = observations.run(
			(signal) =>
				new Promise((_, reject) => {
					signal.addEventListener('abort', () => reject(signal.reason as Error), { once: true });
				}),
			abort.signal,
		);
		await Promise.resolve();
		abort.abort(new Error('cancelled'));
		await expect(pending).rejects.toThrow('cancelled');
	});
});
