/**
 * Decides what a trigger does while runs of its automation are active (ADR 0003, decision 2).
 *
 * Framework-free (ADR 0003, decision 15).
 *
 * - `single`: the trigger is ignored while a run is active.
 * - `restart`: every active run of the automation is cancelled, whichever trigger started it, and a new
 *   run starts. Cancelling only the runs of the same trigger is deliberately not offered: with it "becomes
 *   clear → Delay → off" switches the light off in an occupied room.
 * - `parallel`: runs overlap up to a cap; a trigger beyond the cap is dropped.
 *
 * A "for" duration belongs to the trigger subscription, not to a run, so no mode affects it.
 */
export type RunMode = 'single' | 'restart' | 'parallel';

export const RUN_MODES: readonly RunMode[] = ['single', 'restart', 'parallel'];

/** The most runs of one `parallel` automation that may be active at once */
export const PARALLEL_RUNS_MAX = 10;

export interface RunStartRequest {
	mode: RunMode;
	/** Runs of the automation that are active right now */
	activeRuns: number;
	/** Overrides PARALLEL_RUNS_MAX */
	maxParallelRuns?: number;
}

export type RunStartDecision =
	| { type: 'start'; cancelActive: boolean }
	/** The trigger is skipped because the mode says a running automation is not to be disturbed */
	| { type: 'ignore'; reason: string }
	/** The trigger is skipped because a limit was reached */
	| { type: 'drop'; reason: string };

export const decideRunStart = (request: RunStartRequest): RunStartDecision => {
	const maxParallelRuns = request.maxParallelRuns ?? PARALLEL_RUNS_MAX;

	switch (request.mode) {
		case 'single':
			return request.activeRuns > 0
				? { type: 'ignore', reason: 'A run is already active and the mode is single.' }
				: { type: 'start', cancelActive: false };
		case 'parallel':
			return request.activeRuns >= maxParallelRuns
				? { type: 'drop', reason: `The limit of ${maxParallelRuns} parallel runs is reached.` }
				: { type: 'start', cancelActive: false };
		case 'restart':
			return { type: 'start', cancelActive: request.activeRuns > 0 };
		default:
			// A mode this code does not know must not start anything
			return { type: 'drop', reason: 'The run mode is not known.' };
	}
};
