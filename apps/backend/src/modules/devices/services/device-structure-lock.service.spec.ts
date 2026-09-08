import { DeviceStructureLockService } from './device-structure-lock.service';

describe('DeviceStructureLockService', () => {
	let lock: DeviceStructureLockService;

	const deferred = (): { promise: Promise<void>; resolve: () => void; reject: (reason: Error) => void } => {
		let resolve!: () => void;
		let reject!: (reason: Error) => void;

		const promise = new Promise<void>((res, rej) => {
			resolve = res;
			reject = rej;
		});

		return { promise, resolve, reject };
	};

	beforeEach(() => {
		lock = new DeviceStructureLockService();
	});

	// The whole point: the second caller's *first* statement must not run until the first caller's last
	// one has. A check-then-write pair that interleaves is exactly what this exists to prevent.
	it('does not start queued work until the work before it has finished', async () => {
		const order: string[] = [];
		const first = deferred();

		const a = lock.runExclusive(async (): Promise<void> => {
			order.push('a:enter');

			await first.promise;

			order.push('a:exit');
		});

		const b = lock.runExclusive((): Promise<void> => {
			order.push('b:enter');

			return Promise.resolve();
		});

		// `a` is parked mid-flight. Nothing of `b` may have run.
		await Promise.resolve();

		expect(order).toEqual(['a:enter']);

		first.resolve();

		await Promise.all([a, b]);

		expect(order).toEqual(['a:enter', 'a:exit', 'b:enter']);
	});

	// Creating a device creates its channels, and creating a channel creates its properties, so these
	// windows nest. A nested call that took a fresh ticket would wait for one only its own caller can
	// release — a deadlock that no timeout would ever break.
	it('lets a nested call through instead of queueing it behind its own caller', async () => {
		const result = await lock.runExclusive(
			async (): Promise<string> => lock.runExclusive((): Promise<string> => Promise.resolve('nested')),
		);

		expect(result).toBe('nested');
	});

	// The re-entrancy above must be per call chain, not a global "somebody holds it" flag: an unrelated
	// request arriving while a nested one is in flight has to wait, or the lock is no lock at all.
	it('still queues a concurrent caller while a nested call is in flight', async () => {
		const order: string[] = [];
		const inner = deferred();

		const holder = lock.runExclusive(
			async (): Promise<void> =>
				lock.runExclusive(async (): Promise<void> => {
					order.push('nested:enter');

					await inner.promise;

					order.push('nested:exit');
				}),
		);

		const other = lock.runExclusive((): Promise<void> => {
			order.push('other:enter');

			return Promise.resolve();
		});

		await Promise.resolve();

		expect(order).toEqual(['nested:enter']);

		inner.resolve();

		await Promise.all([holder, other]);

		expect(order).toEqual(['nested:enter', 'nested:exit', 'other:enter']);
	});

	// A refused structural write is the common case, not the exceptional one — every validation hook
	// throws. A queue that closed behind the first rejection would hang the next request forever.
	it('keeps the queue moving after work that rejects', async () => {
		const failing = lock.runExclusive((): Promise<void> => Promise.reject(new Error('refused')));

		await expect(failing).rejects.toThrow('refused');

		await expect(lock.runExclusive((): Promise<string> => Promise.resolve('after'))).resolves.toBe('after');
	});

	it('propagates the rejection to its own caller rather than to the next one', async () => {
		const failing = lock.runExclusive((): Promise<void> => Promise.reject(new Error('refused')));
		const following = lock.runExclusive((): Promise<string> => Promise.resolve('unaffected'));

		await expect(failing).rejects.toThrow('refused');
		await expect(following).resolves.toBe('unaffected');
	});

	it('admits independent shared work concurrently', async () => {
		const first = deferred();
		const order: string[] = [];

		const a = lock.runShared(async (): Promise<void> => {
			order.push('a:start');
			await first.promise;
			order.push('a:end');
		});
		const b = lock.runShared((): Promise<void> => {
			order.push('b');

			return Promise.resolve();
		});

		await Promise.resolve();
		await Promise.resolve();
		expect(order).toEqual(['a:start', 'b']);

		first.resolve();
		await Promise.all([a, b]);
	});

	it('blocks later readers behind a queued writer until that writer completes', async () => {
		const releaseReader = deferred();
		const releaseWriter = deferred();
		let writerStarted!: () => void;
		const writerStartedPromise = new Promise<void>((resolve) => {
			writerStarted = resolve;
		});
		const order: string[] = [];

		const reader = lock.runShared(async (): Promise<void> => {
			order.push('reader:start');
			await releaseReader.promise;
			order.push('reader:end');
		});
		const writer = lock.runExclusive(async (): Promise<void> => {
			order.push('writer:start');
			writerStarted();
			await releaseWriter.promise;
			order.push('writer:end');
		});
		const lateReader = lock.runShared((): Promise<void> => {
			order.push('late-reader');

			return Promise.resolve();
		});

		await Promise.resolve();
		await Promise.resolve();
		expect(order).toEqual(['reader:start']);

		releaseReader.resolve();
		await writerStartedPromise;
		expect(order).toEqual(['reader:start', 'reader:end', 'writer:start']);

		releaseWriter.resolve();
		await Promise.all([reader, writer, lateReader]);
		expect(order).toEqual(['reader:start', 'reader:end', 'writer:start', 'writer:end', 'late-reader']);
	});

	it('rejects a shared-to-exclusive upgrade instead of deadlocking', async () => {
		await expect(lock.runShared(() => lock.runExclusive(() => Promise.resolve()))).rejects.toThrow(
			'cannot be upgraded',
		);
	});

	it('does not let a detached inherited context bypass a writer after its lease releases', async () => {
		let runDetached!: () => Promise<void>;
		await lock.runExclusive((): Promise<void> => {
			runDetached = () => lock.runShared(() => Promise.resolve());

			return Promise.resolve();
		});

		const gate = deferred();
		const writer = lock.runExclusive(async (): Promise<void> => gate.promise);
		await Promise.resolve();

		const detached = runDetached();
		let detachedDone = false;
		void detached.then(() => {
			detachedDone = true;
		});
		await Promise.resolve();
		expect(detachedDone).toBe(false);

		gate.resolve();
		await Promise.all([writer, detached]);
	});

	it('keeps an exclusive lease through fire-and-forget nested work', async () => {
		const nestedGate = deferred();
		let nestedStarted!: () => void;
		const nestedStartedPromise = new Promise<void>((resolve) => {
			nestedStarted = resolve;
		});
		let writerEntered = false;

		const parent = lock.runExclusive(async (): Promise<void> => {
			void lock.runShared(async (): Promise<void> => {
				nestedStarted();
				await nestedGate.promise;
			});
			await nestedStartedPromise;
		});
		await nestedStartedPromise;
		const writer = lock.runExclusive((): Promise<void> => {
			writerEntered = true;

			return Promise.resolve();
		});

		await Promise.resolve();
		expect(writerEntered).toBe(false);

		nestedGate.resolve();
		await Promise.all([parent, writer]);
		expect(writerEntered).toBe(true);
	});
});
