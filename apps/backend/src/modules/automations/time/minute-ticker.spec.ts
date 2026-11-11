import { FakeWallClock } from '../testing/fake-wall-clock';

import { MINUTE_TICK_MAX_CATCH_UP_MINUTES, MinuteTicker } from './minute-ticker';

const iso = (minutes: number[]): string[] => minutes.map((minute) => new Date(minute).toISOString());

describe('MinuteTicker', () => {
	let clock: FakeWallClock;
	let ticker: MinuteTicker;
	let seen: number[];

	const listen = (): (() => void) => ticker.subscribe((minute) => seen.push(minute));

	beforeEach(() => {
		clock = FakeWallClock.at('2026-03-02T06:59:20Z');
		ticker = new MinuteTicker(clock);
		seen = [];
	});

	it('holds no timer until somebody listens, and one timer whatever the number of listeners', () => {
		expect(clock.pending()).toBe(0);
		expect(ticker.isRunning()).toBe(false);

		const releases = Array.from({ length: 25 }, () => listen());

		expect(clock.pending()).toBe(1);
		expect(ticker.listenerCount()).toBe(25);

		clock.advanceMinutes(3);

		expect(clock.pending()).toBe(1);

		for (const release of releases) release();

		expect(clock.pending()).toBe(0);
		expect(ticker.isRunning()).toBe(false);
	});

	it('hands out each minute once, at its boundary', () => {
		listen();

		clock.advance(39_999);
		expect(seen).toEqual([]);

		clock.advance(1);
		expect(iso(seen)).toEqual(['2026-03-02T07:00:00.000Z']);

		clock.advanceMinutes(2);
		expect(iso(seen)).toEqual(['2026-03-02T07:00:00.000Z', '2026-03-02T07:01:00.000Z', '2026-03-02T07:02:00.000Z']);
	});

	it('never hands out the minute it started in', () => {
		clock = FakeWallClock.at('2026-03-02T07:00:00Z');
		ticker = new MinuteTicker(clock);

		listen();
		clock.advance(59_999);

		expect(seen).toEqual([]);
	});

	it('does not call a listener from inside subscribe, and stops calling it once released', () => {
		const release = listen();

		expect(seen).toEqual([]);

		clock.advanceMinutes(1);
		release();
		release();
		clock.advanceMinutes(5);

		expect(seen).toHaveLength(1);
	});

	it('catches up a short stall minute by minute', () => {
		listen();

		// The process was held for three minutes: the wall clock moved, the timer did not run
		clock.step(3 * 60_000);
		clock.advance(40_000);

		expect(iso(seen)).toEqual([
			'2026-03-02T07:00:00.000Z',
			'2026-03-02T07:01:00.000Z',
			'2026-03-02T07:02:00.000Z',
			'2026-03-02T07:03:00.000Z',
		]);
	});

	it('does not replay what a large jump forward skipped', () => {
		listen();

		clock.step((MINUTE_TICK_MAX_CATCH_UP_MINUTES + 60) * 60_000);
		clock.advance(40_000);

		expect(iso(seen)).toEqual(['2026-03-02T08:05:00.000Z']);

		clock.advanceMinutes(1);

		expect(iso(seen)).toEqual(['2026-03-02T08:05:00.000Z', '2026-03-02T08:06:00.000Z']);
	});

	it('carries on from the new time when the wall clock is set back', () => {
		listen();
		clock.advanceMinutes(2);

		expect(iso(seen).at(-1)).toBe('2026-03-02T07:01:00.000Z');

		// The timer that was already set still runs a minute after the last tick: 40 seconds from here
		clock.setTo('2026-03-01T12:00:10Z');
		clock.advance(40_000);

		expect(iso(seen).slice(-1)).toEqual(['2026-03-01T12:00:00.000Z']);

		// ... and from then on the tick is back on the minute boundary of the new time
		clock.advance(9_999);
		expect(seen).toHaveLength(3);

		clock.advance(1);
		expect(iso(seen).slice(-1)).toEqual(['2026-03-01T12:01:00.000Z']);
	});

	it('keeps ticking when a listener throws, and tells the hook', () => {
		const onError = jest.fn();

		ticker = new MinuteTicker(clock, { onError });
		ticker.subscribe(() => {
			throw new Error('broken listener');
		});
		listen();

		clock.advanceMinutes(2);

		expect(seen).toHaveLength(2);
		expect(onError).toHaveBeenCalledTimes(2);
	});

	it('lets a listener release itself, or another one, during a tick', () => {
		const releaseSelf: (() => void)[] = [];

		releaseSelf.push(
			ticker.subscribe((minute) => {
				seen.push(minute);
				releaseSelf[0]();
			}),
		);

		clock.advanceMinutes(3);

		expect(seen).toHaveLength(1);
		expect(clock.pending()).toBe(0);
	});

	it('drops everything on dispose', () => {
		listen();
		ticker.dispose();
		clock.advanceMinutes(2);

		expect(seen).toEqual([]);
		expect(clock.pending()).toBe(0);
	});
});
