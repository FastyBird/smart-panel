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
			await expect(observations.run(work)).rejects.toThrow('timed out');
		}
		expect(work).toHaveBeenCalledTimes(1);
		resolve(1);
		await Promise.resolve();
		await Promise.resolve();
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
