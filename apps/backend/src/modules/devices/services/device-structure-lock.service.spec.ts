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

	// BEGIN release-aware entry drafts (unexecuted; all original cases remain byte-exact)
	describe('runExclusiveReleased', () => {
		it('preserves the callback value and deactivates its captured original context before settlement', async () => {
			const resume = deferred();
			const value = Object.freeze({ result: 'original' });
			let inherited: Promise<string> | undefined;

			const result = await lock.runExclusiveReleased(() => {
				// Promise registration captures the REAL active ALS context, unlike a plain saved closure.
				inherited = resume.promise.then(() =>
					lock.runExclusiveReleased(() => Promise.resolve('fresh top-level owner')),
				);
				return Promise.resolve(value);
			});

			expect(result).toBe(value);
			if (inherited === undefined) throw new Error('Original-context continuation was not registered');
			resume.resolve();
			await expect(inherited).resolves.toBe('fresh top-level owner');
		});

		it.each([
			{ label: 'Error', reason: new Error('original callback rejection') },
			{ label: 'object', reason: Object.freeze({ original: 'opaque rejection' }) },
			{ label: 'undefined', reason: undefined },
		])('preserves original $label rejection identity after releasing its context', async ({ reason }) => {
			const started = deferred();
			const resume = deferred();
			let inherited: Promise<string> | undefined;
			let rejectCallback: (cause: unknown) => void = () => {
				throw new Error('Callback rejection was not initialized');
			};
			const callback = new Promise<string>((_resolve, reject) => {
				rejectCallback = reject;
			});
			const result = lock.runExclusiveReleased(() => {
				inherited = resume.promise.then(() =>
					lock.runExclusiveReleased(() => Promise.resolve('after original rejection')),
				);
				started.resolve();
				return callback;
			});
			const rejected = expect(result).rejects.toBe(reason);
			await started.promise;
			rejectCallback(reason);
			await rejected;

			if (inherited === undefined) throw new Error('Original-context continuation was not registered');
			resume.resolve();
			await expect(inherited).resolves.toBe('after original rejection');
		});

		it.each(['exclusive', 'shared'])(
			'refuses entry inside an active %s parent without invoking the callback or borrowing the parent',
			async (mode) => {
				let calls = 0;
				const parent = async (): Promise<string> => {
					await expect(
						lock.runExclusiveReleased(() => {
							calls++;
							return Promise.resolve('must not run');
						}),
					).rejects.toThrow('requires a top-level caller');
					expect(calls).toBe(0);
					await expect(lock.runShared(() => Promise.resolve('ordinary nested reader'))).resolves.toBe(
						'ordinary nested reader',
					);
					if (mode === 'exclusive') {
						await expect(lock.runExclusive(() => Promise.resolve('ordinary nested writer'))).resolves.toBe(
							'ordinary nested writer',
						);
					} else {
						await expect(lock.runExclusive(() => Promise.resolve())).rejects.toThrow('cannot be upgraded');
					}
					return 'parent remains intact';
				};

				await expect(mode === 'exclusive' ? lock.runExclusive(parent) : lock.runShared(parent)).resolves.toBe(
					'parent remains intact',
				);
				await expect(lock.runExclusiveReleased(() => Promise.resolve('next owner'))).resolves.toBe('next owner');
				expect(calls).toBe(0);
			},
		);

		it('drains held nested work and a later descendant wave before settling or admitting a queued owner', async () => {
			const firstGate = deferred();
			const secondGate = deferred();
			const firstStarted = deferred();
			const firstSettled = deferred();
			const secondStarted = deferred();
			const rootReturned = deferred();
			const followingStarted = deferred();
			const value = Object.freeze({ result: 'after both waves' });
			const trace: string[] = [];
			const errors: unknown[] = [];
			let settled = false;

			const root = lock.runExclusiveReleased(async () => {
				const first = lock.runShared(async () => {
					trace.push('first:start');
					firstStarted.resolve();
					await firstGate.promise;
					const second = lock.runExclusive(async () => {
						trace.push('second:start');
						secondStarted.resolve();
						await secondGate.promise;
						trace.push('second:end');
					});
					void second.catch((cause: unknown) => errors.push(cause));
					trace.push('first:end');
				});
				void first.then(
					() => firstSettled.resolve(),
					(cause: unknown) => {
						errors.push(cause);
						firstSettled.resolve();
					},
				);
				await firstStarted.promise;
				trace.push('root:return');
				rootReturned.resolve();
				return value;
			});
			void root.then(
				() => {
					settled = true;
				},
				(cause: unknown) => {
					settled = true;
					errors.push(cause);
				},
			);
			await rootReturned.promise;
			const following = lock.runExclusive(() => {
				trace.push('following');
				followingStarted.resolve();
				return Promise.resolve();
			});
			expect(settled).toBe(false);
			expect(trace).toEqual(['first:start', 'root:return']);

			firstGate.resolve();
			await secondStarted.promise;
			await firstSettled.promise;
			expect(settled).toBe(false);
			expect(trace).toEqual(['first:start', 'root:return', 'second:start', 'first:end']);

			secondGate.resolve();
			await expect(root).resolves.toBe(value);
			await followingStarted.promise;
			await following;
			expect(errors).toEqual([]);
			expect(trace).toEqual(['first:start', 'root:return', 'second:start', 'first:end', 'second:end', 'following']);
		});

		it.each(['resolve', 'reject'])(
			'drains a handled nested rejection and preserves the root %s outcome without a new failure policy',
			async (outcome) => {
				const childGate = deferred();
				const childStarted = deferred();
				const rootReturned = deferred();
				const childObserved = deferred();
				const childFailure = new Error('handled nested failure');
				const rootFailure = new Error('original root failure');
				const value = Object.freeze({ root: 'success despite handled nested rejection' });
				let observed: unknown;
				let rootSettled = false;
				const root = lock.runExclusiveReleased(async () => {
					const child = lock.runShared(async () => {
						childStarted.resolve();
						await childGate.promise;
					});
					void child.catch((cause: unknown) => {
						observed = cause;
						childObserved.resolve();
					});
					await childStarted.promise;
					rootReturned.resolve();
					if (outcome === 'reject') throw rootFailure;
					return value;
				});
				const observation = root.then(
					(result) => {
						rootSettled = true;
						expect(outcome).toBe('resolve');
						expect(result).toBe(value);
					},
					(cause: unknown) => {
						rootSettled = true;
						expect(outcome).toBe('reject');
						expect(cause).toBe(rootFailure);
					},
				);
				await rootReturned.promise;
				expect(rootSettled).toBe(false);
				childGate.reject(childFailure);
				await childObserved.promise;
				await observation;
				expect(observed).toBe(childFailure);
				await expect(lock.runExclusiveReleased(() => Promise.resolve('recovered'))).resolves.toBe('recovered');
			},
		);

		it('queues a genuinely inherited inactive context behind a held successor instead of bypassing it', async () => {
			const resume = deferred();
			const attempted = deferred();
			const successorStarted = deferred();
			const successorGate = deferred();
			const trace: string[] = [];
			let inherited: Promise<void> | undefined;

			await lock.runExclusiveReleased(() => {
				inherited = resume.promise.then(() => {
					attempted.resolve();
					return lock.runShared(() => {
						trace.push('inherited reader');
						return Promise.resolve();
					});
				});
				return Promise.resolve();
			});
			if (inherited === undefined) throw new Error('Original-context continuation was not registered');
			const successor = lock.runExclusive(async () => {
				trace.push('successor:start');
				successorStarted.resolve();
				await successorGate.promise;
				trace.push('successor:end');
			});
			await successorStarted.promise;
			resume.resolve();
			await attempted.promise;
			expect(trace).toEqual(['successor:start']);

			successorGate.resolve();
			await Promise.all([successor, inherited]);
			expect(trace).toEqual(['successor:start', 'successor:end', 'inherited reader']);
		});

		it('releases its owner before a queued successor and keeps both new continuations outside that successor', async () => {
			const rootStarted = deferred();
			const rootGate = deferred();
			const successorStarted = deferred();
			const successorGate = deferred();
			const resumeInherited = deferred();
			const inheritedAttempted = deferred();
			const trace: string[] = [];
			let inherited: Promise<string> | undefined;
			const root = lock.runExclusiveReleased(async () => {
				inherited = resumeInherited.promise.then(() => {
					inheritedAttempted.resolve();
					return lock.runExclusiveReleased(() => {
						trace.push('inherited:fresh');
						return Promise.resolve('inherited result');
					});
				});
				rootStarted.resolve();
				await rootGate.promise;
				trace.push('root:end');
				return 'original result';
			});
			await rootStarted.promise;
			const successor = lock.runExclusive(async () => {
				trace.push('successor:start');
				successorStarted.resolve();
				await successorGate.promise;
				trace.push('successor:end');
			});
			rootGate.resolve();
			await expect(root).resolves.toBe('original result');
			await successorStarted.promise;
			if (inherited === undefined) throw new Error('Original-context continuation was not registered');

			resumeInherited.resolve();
			await inheritedAttempted.promise;
			const outside = lock.runExclusiveReleased(() => {
				trace.push('outside:fresh');
				return Promise.resolve('outside result');
			});
			expect(trace).toEqual(['root:end', 'successor:start']);

			successorGate.resolve();
			await expect(inherited).resolves.toBe('inherited result');
			await expect(outside).resolves.toBe('outside result');
			await successor;
			expect(trace).toEqual(['root:end', 'successor:start', 'successor:end', 'inherited:fresh', 'outside:fresh']);
		});

		it('preserves FIFO shared fairness and ordinary nesting around the additive exclusive request', async () => {
			const firstStarted = deferred();
			const firstGate = deferred();
			const releasedStarted = deferred();
			const releasedGate = deferred();
			const sharedStarted = deferred();
			const sharedGate = deferred();
			const trace: string[] = [];
			const first = lock.runShared(async () => {
				trace.push('reader:first');
				firstStarted.resolve();
				await firstGate.promise;
				trace.push('reader:first:end');
			});
			await firstStarted.promise;
			const released = lock.runExclusiveReleased(async () => {
				trace.push('released:start');
				await lock.runShared(() => {
					trace.push('ordinary:nested:shared');
					return Promise.resolve();
				});
				await lock.runExclusive(() => {
					trace.push('ordinary:nested:exclusive');
					return Promise.resolve();
				});
				releasedStarted.resolve();
				await releasedGate.promise;
				trace.push('released:end');
			});
			const shared = lock.runShared(async () => {
				trace.push('reader:after');
				sharedStarted.resolve();
				await sharedGate.promise;
				trace.push('reader:after:end');
			});
			const writer = lock.runExclusive(() => {
				trace.push('ordinary:writer');
				return Promise.resolve();
			});
			const lateShared = lock.runShared(() => {
				trace.push('reader:last');
				return Promise.resolve();
			});
			expect(trace).toEqual(['reader:first']);

			firstGate.resolve();
			await releasedStarted.promise;
			expect(trace).toEqual([
				'reader:first',
				'reader:first:end',
				'released:start',
				'ordinary:nested:shared',
				'ordinary:nested:exclusive',
			]);
			releasedGate.resolve();
			await sharedStarted.promise;
			expect(trace.at(-1)).toBe('reader:after');
			sharedGate.resolve();
			await Promise.all([first, released, shared, writer, lateShared]);
			expect(trace).toEqual([
				'reader:first',
				'reader:first:end',
				'released:start',
				'ordinary:nested:shared',
				'ordinary:nested:exclusive',
				'released:end',
				'reader:after',
				'reader:after:end',
				'ordinary:writer',
				'reader:last',
			]);
		});
	});
	// END release-aware entry drafts
});
