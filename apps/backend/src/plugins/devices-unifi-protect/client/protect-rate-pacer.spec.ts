import { readFileSync } from 'fs';
import { join, resolve } from 'path';

import {
	ProtectRatePacer,
	pacingIntervalMs,
	parseRateLimit,
	parseRateLimitPolicy,
	parseRetryAfterMs,
} from './protect-rate-pacer';

const FIXTURES = resolve(__dirname, '../__fixtures__');
const fixture = JSON.parse(readFileSync(join(FIXTURES, 'rate-limit-headers.json'), 'utf8')) as Record<
	'ok' | 'rate_limited',
	Record<string, string>
>;

class VirtualClock {
	private current = 0;
	private timers: { at: number; resolve: () => void; reject: (e: unknown) => void }[] = [];

	now = (): number => this.current;

	sleep = (ms: number, signal?: AbortSignal): Promise<void> =>
		new Promise((resolveFn, reject) => {
			if (signal?.aborted) {
				reject(signal.reason as Error);

				return;
			}

			const timer = { at: this.current + ms, resolve: resolveFn, reject };

			this.timers.push(timer);
			signal?.addEventListener('abort', () => {
				this.timers = this.timers.filter((t) => t !== timer);
				reject(signal.reason as Error);
			});
		});

	/** Drives timers in order until every promise settled. */
	async run<T>(promises: Promise<T>[]): Promise<PromiseSettledResult<T>[]> {
		let done = false;
		const all = Promise.allSettled(promises).then((r) => {
			done = true;

			return r;
		});

		while (!done) {
			await new Promise((r) => setImmediate(r));

			if (done) {
				break;
			}

			this.timers.sort((a, b) => a.at - b.at);

			const next = this.timers.shift();

			if (!next) {
				continue;
			}

			this.current = Math.max(this.current, next.at);
			next.resolve();
		}

		return all;
	}
}

describe('protect-rate-pacer parsing', () => {
	it('parses the console policy header', () => {
		expect(parseRateLimitPolicy(fixture.ok['ratelimit-policy'])).toEqual({ quota: 10, windowSeconds: 1 });
	});

	it('keeps the most restrictive of several policies', () => {
		expect(parseRateLimitPolicy('"10-in-1sec"; q=10; w=1, "100-in-1min"; q=100; w=60')).toEqual({
			quota: 100,
			windowSeconds: 60,
		});
	});

	it.each([undefined, '', 'garbage', '"x"; q=0; w=1', '"x"; q=10'])('ignores the policy %p', (h) => {
		expect(parseRateLimitPolicy(h)).toBeNull();
	});

	it('parses remaining and reset', () => {
		expect(parseRateLimit('"10-in-1sec"; r=0; t=1')).toEqual({ remaining: 0, resetSeconds: 1 });
		expect(parseRateLimit(fixture.ok['ratelimit'])).toEqual({ remaining: 9, resetSeconds: 1 });
		expect(parseRateLimit('nonsense')).toBeNull();
		// Equally exhausted limits: the longer reset wins, whichever comes first.
		expect(parseRateLimit('"short"; r=0; t=1, "long"; r=0; t=60')).toEqual({ remaining: 0, resetSeconds: 60 });
		expect(parseRateLimit('"long"; r=0; t=60, "short"; r=0; t=1')).toEqual({ remaining: 0, resetSeconds: 60 });
		expect(parseRateLimit(undefined)).toBeNull();
	});

	it.each([
		['1', 1000],
		['0', 0],
		['120', 60000],
		['-1', null],
		['soon', null],
	])('Retry-After %p -> %p ms', (h, ms) => {
		expect(parseRetryAfterMs(h, 0)).toBe(ms);
	});

	it('reads the fixture Retry-After', () => {
		expect(parseRetryAfterMs(fixture.rate_limited['retry-after'], 0)).toBe(1000);
		expect(parseRetryAfterMs(undefined, 0)).toBeNull();
	});

	it('accepts an HTTP-date Retry-After', () => {
		expect(parseRetryAfterMs(new Date(Date.UTC(2026, 0, 1, 0, 0, 3)).toUTCString(), Date.UTC(2026, 0, 1))).toBe(3000);
	});

	it.each([
		[{ quota: 10, windowSeconds: 1 }, 125],
		[{ quota: 5, windowSeconds: 1 }, 250],
		[{ quota: 1, windowSeconds: 1 }, 1000],
	])('spaces %j at %d ms', (p, ms) => {
		expect(pacingIntervalMs(p)).toBe(ms);
	});
});

describe('ProtectRatePacer', () => {
	let clock: VirtualClock;
	let pacer: ProtectRatePacer;

	beforeEach(() => {
		clock = new VirtualClock();
		pacer = new ProtectRatePacer({ now: clock.now, sleep: clock.sleep });
	});

	it('starts at the default policy', () => {
		expect(pacer.policy).toEqual({ quota: 10, windowSeconds: 1 });
	});

	it('spaces 20 acquisitions at least 125 ms apart in FIFO order', async () => {
		const starts: number[] = [];
		const order: number[] = [];
		const tasks = Array.from({ length: 20 }, (_, i) =>
			pacer.acquire().then(() => {
				starts.push(clock.now());
				order.push(i);
			}),
		);

		await clock.run(tasks);

		expect(order).toEqual(Array.from({ length: 20 }, (_, i) => i));
		expect(starts).toHaveLength(20);

		for (let i = 1; i < starts.length; i++) {
			expect(starts[i] - starts[i - 1]).toBeGreaterThanOrEqual(125);
		}
	});

	it('waits for the reset after the fixture 429 headers', async () => {
		pacer.observe(fixture.rate_limited);

		await clock.run([pacer.acquire()]);

		expect(clock.now()).toBeGreaterThanOrEqual(1000);
	});

	it('does not pause when requests remain', async () => {
		pacer.observe(fixture.ok);

		await clock.run([pacer.acquire()]);

		expect(clock.now()).toBe(0);
	});

	it('survives malformed headers', async () => {
		pacer.observe({ 'ratelimit-policy': 'x', ratelimit: ['a', 'b'] });
		pacer.observe({});

		await clock.run([pacer.acquire()]);

		expect(pacer.policy).toEqual({ quota: 10, windowSeconds: 1 });
	});

	it('backOff delays waiters that are already queued', async () => {
		const starts: number[] = [];

		await pacer.acquire(); // consumes the immediate slot so the next three really queue

		const tasks = [0, 1, 2].map(() => pacer.acquire().then(() => starts.push(clock.now())));

		pacer.backOff(1000);
		await clock.run(tasks);

		expect(starts).toHaveLength(3);

		for (const start of starts) {
			expect(start).toBeGreaterThanOrEqual(1000);
		}

		expect(starts[1] - starts[0]).toBeGreaterThanOrEqual(125);
		expect(starts[2] - starts[1]).toBeGreaterThanOrEqual(125);
	});

	it('rejects an aborted acquisition and keeps serving the next waiter', async () => {
		const controller = new AbortController();
		const reason = new Error('cancelled');
		const first = pacer.acquire();
		const aborted = pacer.acquire(controller.signal);
		const third = pacer.acquire();

		controller.abort(reason);

		const results = await clock.run([first, aborted, third]);

		expect(results[0].status).toBe('fulfilled');
		expect(results[1]).toEqual({ status: 'rejected', reason });
		expect(results[2].status).toBe('fulfilled');
		await expect(pacer.acquire(controller.signal)).rejects.toBe(reason);
	});

	it('adopts a slower advertised policy', () => {
		pacer.observe({ 'ratelimit-policy': '"5-in-1sec"; q=5; w=1' });

		expect(pacer.policy).toEqual({ quota: 5, windowSeconds: 1 });
	});

	it('keeps FIFO order when sleep timers fire before the pause ends', async () => {
		let sleeps = 0;
		const early = new ProtectRatePacer({
			now: clock.now,
			sleep: (ms, signal) => {
				sleeps += 1;

				// Both pacing timers wake 500 ms early, while the pause is still running; later timers are exact.
				return sleeps > 20
					? Promise.reject(new Error('woken too often'))
					: clock.sleep(sleeps <= 2 ? ms - 500 : ms, signal);
			},
		});
		const released: { name: string; at: number }[] = [];
		const waiter = (name: string): Promise<number> =>
			early.acquire().then(() => released.push({ name, at: clock.now() }));

		early.backOff(1000);

		await clock.run([waiter('a'), waiter('b')]);

		// Neither goes before the pause ends, and they stay in order and spaced.
		expect(released).toEqual([
			{ name: 'a', at: 1000 },
			{ name: 'b', at: 1125 },
		]);
		expect(sleeps).toBe(4);
	});

	it('keeps releases 125 ms apart when the pacing and the spacing timers both resume late', async () => {
		let now = 0;
		const sleeps: { ms: number; resolve: () => void }[] = [];
		const late = new ProtectRatePacer({
			now: () => now,
			sleep: (ms) => new Promise((resolve) => sleeps.push({ ms, resolve })),
		});
		const flush = async (): Promise<void> => {
			for (let i = 0; i < 10; i++) {
				await new Promise((resolve) => setImmediate(resolve));
			}
		};
		const wake = async (at: number): Promise<void> => {
			now = at;
			sleeps.splice(0).forEach((s) => s.resolve());
			await flush();
		};
		const released: { name: string; at: number }[] = [];
		const waiter = (name: string): Promise<void> =>
			late.acquire().then(() => {
				released.push({ name, at: now });
			});

		await late.acquire(); // released at 0

		const waiters = [waiter('a'), waiter('b'), waiter('c')];

		expect(sleeps.map((s) => s.ms)).toEqual([125, 250, 375]);

		// All three pacing timers resume late, together.
		await wake(400);

		expect(released).toEqual([{ name: 'a', at: 400 }]);
		expect(sleeps.map((s) => s.ms)).toEqual([125]);

		// The spacing timer resumes late as well; only one waiter may go.
		await wake(700);

		expect(released.map((r) => r.name)).toEqual(['a', 'b']);
		expect(sleeps.map((s) => s.ms)).toEqual([125]);

		await wake(825);
		await Promise.all(waiters);

		expect(released).toEqual([
			{ name: 'a', at: 400 },
			{ name: 'b', at: 700 },
			{ name: 'c', at: 825 },
		]);
	});

	it('holds a waiter in the release queue when a pause is announced while it waits', async () => {
		let now = 0;
		const sleeps: { ms: number; resolve: () => void }[] = [];
		const paused = new ProtectRatePacer({
			now: () => now,
			sleep: (ms) => new Promise((resolve) => sleeps.push({ ms, resolve })),
		});
		const flush = async (): Promise<void> => {
			for (let i = 0; i < 10; i++) {
				await new Promise((resolve) => setImmediate(resolve));
			}
		};
		const wake = async (at: number): Promise<void> => {
			now = at;
			sleeps.splice(0).forEach((s) => s.resolve());
			await flush();
		};
		const released: { name: string; at: number }[] = [];
		const waiter = (name: string): Promise<void> =>
			paused.acquire().then(() => {
				released.push({ name, at: now });
			});

		await paused.acquire(); // released at 0

		const waiters = [waiter('a'), waiter('b')];

		await wake(400); // both pacing timers resume late: `a` goes, `b` waits in the release queue until 525

		expect(released).toEqual([{ name: 'a', at: 400 }]);
		expect(sleeps.map((s) => s.ms)).toEqual([125]);

		now = 410;
		paused.backOff(1000); // paused until 1410

		await wake(525);

		expect(released).toHaveLength(1);
		expect(sleeps.map((s) => s.ms)).toEqual([885]);

		await wake(1410);
		await Promise.all(waiters);

		expect(released).toEqual([
			{ name: 'a', at: 400 },
			{ name: 'b', at: 1410 },
		]);
	});

	it('rejects an aborted waiter behind a paused release turn at once, without letting others overtake', async () => {
		let now = 0;
		const sleeps: { ms: number; resolve: () => void; reject: (e: unknown) => void }[] = [];
		const paced = new ProtectRatePacer({
			now: () => now,
			sleep: (ms, signal) =>
				new Promise((resolve, reject) => {
					const entry = { ms, resolve, reject };

					sleeps.push(entry);
					signal?.addEventListener('abort', () => {
						const index = sleeps.indexOf(entry);

						// Only a sleep that is still pending is cancelled; one that already woke is left alone.
						if (index >= 0) {
							sleeps.splice(index, 1);
							reject(signal.reason as Error);
						}
					});
				}),
		});
		const flush = async (): Promise<void> => {
			for (let i = 0; i < 10; i++) {
				await new Promise((resolve) => setImmediate(resolve));
			}
		};
		const wake = async (at: number): Promise<void> => {
			now = at;
			sleeps.splice(0).forEach((s) => s.resolve());
			await flush();
		};
		const released: { name: string; at: number }[] = [];
		const waiter = (name: string, signal?: AbortSignal): Promise<void> =>
			paced.acquire(signal).then(() => {
				released.push({ name, at: now });
			});
		const controller = new AbortController();
		const reason = new Error('cancelled');

		await paced.acquire(); // released at 0

		const x = waiter('x');
		const a = waiter('a');
		const b = waiter('b', controller.signal).catch((error: unknown) => error);

		await wake(400); // `x` goes; `a` holds the release turn; `b` waits for it

		now = 410;
		paced.backOff(5000); // `a` is now held until 5410
		await wake(525);

		expect(released.map((r) => r.name)).toEqual(['x']);

		controller.abort(reason);

		await expect(b).resolves.toBe(reason);

		const c = waiter('c');

		await flush();
		await wake(5410);
		await wake(5535);
		await Promise.all([x, a, c]);

		expect(released).toEqual([
			{ name: 'x', at: 400 },
			{ name: 'a', at: 5410 },
			{ name: 'c', at: 5535 },
		]);
	});

	it('re-queues a waiter only when a longer pause was announced after its reservation', async () => {
		const starts: number[] = [];

		pacer.backOff(500);

		const waiter = pacer.acquire().then(() => starts.push(clock.now()));

		pacer.backOff(3000);
		await clock.run([waiter]);

		expect(starts).toHaveLength(1);
		expect(starts[0]).toBeGreaterThanOrEqual(3000);
	});

	it('does not re-queue a waiter whose newer pause already ended when it woke', async () => {
		const starts: number[] = [];

		await pacer.acquire(); // takes the slot at 0; the next waiter sleeps until 125

		const waiter = pacer.acquire().then(() => starts.push(clock.now()));

		pacer.backOff(100); // announced after the reservation, but over by the time the waiter wakes
		await clock.run([waiter]);

		expect(starts).toEqual([125]);
	});

	it('clamps the interval of an advertised policy to 60 seconds', async () => {
		pacer.observe({ 'ratelimit-policy': '"1-in-1h"; q=1; w=3600' });

		expect(pacer.policy).toEqual({ quota: 1, windowSeconds: 3600 });
		expect(pacingIntervalMs(pacer.policy)).toBe(60000);

		await pacer.acquire();
		await clock.run([pacer.acquire()]);

		expect(clock.now()).toBe(60000);
	});

	it('does not let an hour-long policy hide a stricter short one', () => {
		expect(parseRateLimitPolicy('"a"; q=1; w=3600, "b"; q=1; w=7200')).toEqual({ quota: 1, windowSeconds: 7200 });
	});

	it('unrefs its sleep timers so an idle pacer never holds the process open', async () => {
		const spy = jest.spyOn(global, 'setTimeout');

		try {
			const real = new ProtectRatePacer();

			await real.acquire();

			const pending = real.acquire();
			const timer = spy.mock.results[spy.mock.results.length - 1].value as NodeJS.Timeout;

			expect(timer.hasRef()).toBe(false);
			await pending;
		} finally {
			spy.mockRestore();
		}
	});
});
