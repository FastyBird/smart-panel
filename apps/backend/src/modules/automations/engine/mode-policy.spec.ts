import { PARALLEL_RUNS_MAX, RunMode, decideRunStart } from './mode-policy';

describe('decideRunStart', () => {
	it('single: starts when nothing runs and ignores the trigger while a run is active', () => {
		expect(decideRunStart({ mode: 'single', activeRuns: 0 })).toEqual({ type: 'start', cancelActive: false });
		expect(decideRunStart({ mode: 'single', activeRuns: 1 })).toMatchObject({ type: 'ignore' });
	});

	it('restart: always starts, and cancels what is active', () => {
		expect(decideRunStart({ mode: 'restart', activeRuns: 0 })).toEqual({ type: 'start', cancelActive: false });
		expect(decideRunStart({ mode: 'restart', activeRuns: 3 })).toEqual({ type: 'start', cancelActive: true });
	});

	it('parallel: runs overlap up to the cap of 10, the next trigger is dropped', () => {
		expect(PARALLEL_RUNS_MAX).toBe(10);
		expect(decideRunStart({ mode: 'parallel', activeRuns: 9 })).toEqual({ type: 'start', cancelActive: false });
		expect(decideRunStart({ mode: 'parallel', activeRuns: 10 })).toMatchObject({ type: 'drop' });
	});

	it('parallel: the cap can be lowered', () => {
		expect(decideRunStart({ mode: 'parallel', activeRuns: 2, maxParallelRuns: 2 })).toMatchObject({ type: 'drop' });
	});

	it('a mode that is not known starts nothing', () => {
		expect(decideRunStart({ mode: 'queued' as RunMode, activeRuns: 0 })).toMatchObject({ type: 'drop' });
	});
});
