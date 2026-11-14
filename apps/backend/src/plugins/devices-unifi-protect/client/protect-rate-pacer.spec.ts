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
			sleep: () => {
				sleeps += 1;

				// Resolves at once and never advances the clock, like a timer that wakes early.
				return sleeps > 20 ? Promise.reject(new Error('woken too often')) : Promise.resolve();
			},
		});
		const order: string[] = [];

		early.backOff(1000);

		await Promise.all([early.acquire().then(() => order.push('a')), early.acquire().then(() => order.push('b'))]);

		expect(order).toEqual(['a', 'b']);
		expect(sleeps).toBe(2);
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
