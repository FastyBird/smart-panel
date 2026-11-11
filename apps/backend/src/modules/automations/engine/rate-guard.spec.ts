import { DEFAULT_RUN_RATE_WINDOWS, RunRateGuard, describeRunRateWindow } from './rate-guard';

describe('RunRateGuard', () => {
	const start = (guard: RunRateGuard, now: number): boolean => {
		if (guard.exceeded(now)) return false;

		guard.record(now);

		return true;
	};

	it('watches two windows: 30 runs per minute and 200 per hour', () => {
		expect(DEFAULT_RUN_RATE_WINDOWS).toEqual([
			{ windowMs: 60_000, maxRuns: 30, label: 'minute' },
			{ windowMs: 3_600_000, maxRuns: 200, label: 'hour' },
		]);
	});

	it('lets 30 runs start within a minute and stops the 31st', () => {
		const guard = new RunRateGuard();

		for (let run = 0; run < 30; run += 1) {
			expect(start(guard, run * 1000)).toBe(true);
		}

		const exceeded = guard.exceeded(30_000);

		expect(exceeded).toMatchObject({ label: 'minute', maxRuns: 30 });
		expect(describeRunRateWindow(exceeded)).toBe('more than 30 runs per minute');
	});

	it('slides: a run exactly one window old no longer counts', () => {
		const guard = new RunRateGuard();

		for (let run = 0; run < 30; run += 1) start(guard, 0);

		expect(guard.exceeded(59_999)).toBeDefined();
		expect(guard.exceeded(60_000)).toBeUndefined();
		expect(guard.count(60_000, 60_000)).toBe(0);
	});

	it('30 runs, a pause of a minute, 30 more runs is fine', () => {
		const guard = new RunRateGuard();

		for (let run = 0; run < 30; run += 1) expect(start(guard, run * 100)).toBe(true);
		for (let run = 0; run < 30; run += 1) expect(start(guard, 70_000 + run * 100)).toBe(true);
	});

	it('catches a slow loop in the hourly window: one run every 3 s passes the minute window and is stopped at the 201st', () => {
		const guard = new RunRateGuard();
		let started = 0;
		let now = 0;

		while (start(guard, now)) {
			started += 1;
			now += 3000;
		}

		expect(started).toBe(200);
		expect(guard.exceeded(now)).toMatchObject({ label: 'hour' });
	});

	it('forgets everything on reset', () => {
		const guard = new RunRateGuard();

		for (let run = 0; run < 30; run += 1) start(guard, 0);

		guard.reset();

		expect(guard.exceeded(0)).toBeUndefined();
	});

	it('takes other windows', () => {
		const guard = new RunRateGuard([{ windowMs: 1000, maxRuns: 2, label: 'second' }]);

		expect(start(guard, 0)).toBe(true);
		expect(start(guard, 1)).toBe(true);
		expect(start(guard, 2)).toBe(false);
		expect(start(guard, 1001)).toBe(true);
	});
});
