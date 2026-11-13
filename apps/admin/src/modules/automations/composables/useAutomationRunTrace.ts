import { type Ref, computed, onScopeDispose, ref, watch } from 'vue';

import { injectStoresManager } from '../../../common';
import { AutomationRunRecordStatus } from '../automations.constants';
import { findRunAttention, mapTraceToOverlay, newerRunStep } from '../automations.trace';
import type { IAutomation, IAutomationGraph } from '../store/automations.store.types';
import { automationRunsStoreKey } from '../store/keys';
import type { IAutomationRun, IAutomationRunStep, IAutomationTriggerResult } from '../store/runs.store.types';

import type { AutomationRunOverlaySource, IAutomationShownRun, IUseAutomationRunTrace } from './types';
import { useAutomationLiveRun } from './useAutomationLiveRun';

interface IUseAutomationRunTraceProps {
	id: IAutomation['id'];
	// The graph the run is laid over: the working copy of the editor, read and never changed
	graph: Ref<IAutomationGraph>;
}

interface IOverlaySource {
	kind: AutomationRunOverlaySource;
	runId: string;
	// Moves each time a run is picked, so a run picked again is read again
	pick: number;
}

/**
 * The steps of a run as far as they are known: the stored trace and the steps the live view received. Both
 * number their steps the same way, so a step is in it once whichever brought it, as it was last known.
 */
export const mergeRunSteps = (stored: IAutomationRunStep[], live: IAutomationRunStep[]): IAutomationRunStep[] => {
	const bySeq = new Map<number, IAutomationRunStep>();

	for (const step of live) {
		bySeq.set(step.seq, step);
	}

	// What was stored is what the run ended with, or - for a run that is still going - where it waited last
	for (const step of stored) {
		bySeq.set(step.seq, newerRunStep(bySeq.get(step.seq), step));
	}

	return [...bySeq.values()].sort((a, b) => a.seq - b.seq);
};

/**
 * Testing an automation and looking at what its runs did (design § Editor, "Test and trace"): the history
 * of its runs, a manual run followed live on the canvas, and a past run replayed from its trace.
 *
 * What is laid over the canvas is read-only: it is worked out from the trace and the graph, and never
 * written into the graph or its undo history.
 */
export const useAutomationRunTrace = ({ id, graph }: IUseAutomationRunTraceProps): IUseAutomationRunTrace => {
	const storesManager = injectStoresManager();

	const runsStore = storesManager.getStore(automationRunsStoreKey);

	const source = ref<IOverlaySource | null>(null);

	const live = useAutomationLiveRun({ id, keep: (): string | null => source.value?.runId ?? null });

	let picks = 0;

	const runsLoadFailed = ref<boolean>(false);

	// The reads of a trace that failed, by run and the status it was read for: not tried again on their own
	const failedReads = ref<Set<string>>(new Set());

	const runs = computed<IAutomationRun[]>((): IAutomationRun[] => runsStore.findForAutomation(id));

	const runsLoading = computed<boolean>((): boolean => runsStore.fetching(id));

	const runtime = computed(() => runsStore.findRuntime(id));

	const testing = computed<boolean>((): boolean => runsStore.triggering(id));

	const isEnded = (run: IAutomationRun | null): boolean => run !== null && run.status !== AutomationRunRecordStatus.running;

	const shownRecord = computed<IAutomationRun | null>((): IAutomationRun | null => (source.value ? runsStore.findById(source.value.runId) : null));

	// The pick a running run's trace was read again for: once per time it is picked
	let refreshedPick: number | null = null;

	// A read that went well since: the reads that failed for the run are not reported any more
	const clearFailures = (runId: string): void => {
		if ([...failedReads.value].some((key) => key.startsWith(`${runId}:`))) {
			failedReads.value = new Set([...failedReads.value].filter((key) => !key.startsWith(`${runId}:`)));
		}
	};

	// What a run stored so far, read when its events may have been missed; nothing stored yet is not a failure
	const recover = (runId: string): void => {
		void runsStore
			.get({ id: runId, fresh: true })
			.then((): void => clearFailures(runId))
			.catch((): void => {
				// Nothing stored yet, or not readable now: the live steps are what there is
			});
	};

	const readKey = (runId: string, run: IAutomationRun | null): string => `${runId}:${run?.status ?? 'unknown'}`;

	/*
	 * The stored trace is read for a run picked from the history, and for a followed run once it is over: while
	 * it runs, its steps come from the live view. A record whose status moved on since its trace was read has
	 * lost the trace in the store, and it is read again.
	 */
	const readTrace = async (runId: string): Promise<void> => {
		const key = readKey(runId, runsStore.findById(runId));

		try {
			await runsStore.get({ id: runId, fresh: true });

			clearFailures(runId);
		} catch {
			failedReads.value = new Set([...failedReads.value, key]);
		}
	};

	watch(
		(): string | null => {
			if (!source.value) {
				return null;
			}

			const run = shownRecord.value;

			return `${source.value.kind}:${source.value.pick}:${readKey(source.value.runId, run)}:${run?.trace ? 'traced' : 'bare'}`;
		},
		(): void => {
			const current = source.value;

			if (!current) {
				return;
			}

			const run = shownRecord.value;

			// A run still going stores more each time it waits: picked again, what it stored since is read once
			const stale = current.kind === 'replay' && run?.trace && !isEnded(run) && refreshedPick !== current.pick;

			if (run?.trace && !stale) {
				return;
			}

			const wanted = current.kind === 'replay' || isEnded(run);

			if (!wanted || runsStore.getting(current.runId) || failedReads.value.has(readKey(current.runId, run))) {
				return;
			}

			refreshedPick = current.pick;

			void readTrace(current.runId);
		},
		{ immediate: true }
	);

	/*
	 * The runs that sent steps while the run followed was still going, the latest last: the latest of them still
	 * going is followed once that one is over (or the latest of them, when all are over: the end of a run is
	 * announced after it is stored, so the steps of a short run that came next can arrive before it).
	 */
	const waitingRunIds = ref<string[]>([]);

	// The run the step before came from: a run closed or turned down is not taken up again by its next step
	let previousStepRunId: string | null = null;

	// The runs closed or turned down while still going: not taken up on their own again until they end (a test
	// or a replay still shows them)
	const dismissed = new Set<string>();

	const dismiss = (runId: string | undefined): void => {
		if (typeof runId === 'string' && !isEnded(runsStore.findById(runId))) {
			dismissed.add(runId);
		}
	};

	const isDismissed = (runId: string): boolean => {
		for (const item of dismissed) {
			if (isEnded(runsStore.findById(item))) {
				dismissed.delete(item);
			}
		}

		return dismissed.has(runId);
	};

	// A run started while the view is open is followed, unless a past run is being looked at or the run
	// followed is still going. Every step is looked at as it arrives, so no run is missed when several arrive
	// at once or the steps of the runs interleave.
	live.onStep((runId: string): void => {
		const previous = previousStepRunId;

		previousStepRunId = runId;

		if (source.value?.runId === runId) {
			return;
		}

		if (source.value?.kind === 'replay') {
			dismiss(runId);

			return;
		}

		if (isDismissed(runId)) {
			return;
		}

		if (source.value === null ? runId !== previous : isEnded(shownRecord.value)) {
			source.value = { kind: 'live', runId, pick: ++picks };
			waitingRunIds.value = waitingRunIds.value.filter((item) => item !== runId);
		} else if (source.value !== null) {
			// Only the runs whose steps are still held can be followed
			waitingRunIds.value = [...waitingRunIds.value.filter((item) => item !== runId && live.stepsOf(item).length > 0), runId];
		}
	});

	// Watched by the pick that ended, not by whether one did: a run taken up that is over already ends in turn
	watch(
		(): number | null => (source.value?.kind === 'live' && isEnded(shownRecord.value) ? source.value.pick : null),
		(ended: number | null): void => {
			if (ended === null) {
				return;
			}

			const candidates = waitingRunIds.value.filter(
				(runId) => runId !== source.value?.runId && !isDismissed(runId) && live.stepsOf(runId).length > 0
			);
			const runId = [...candidates].reverse().find((item) => !isEnded(runsStore.findById(item))) ?? candidates.at(-1) ?? null;

			// Shown before it stops waiting, so it stays open throughout
			if (runId !== null) {
				source.value = { kind: 'live', runId, pick: ++picks };
			}

			// The others still wait: each is followed in turn once the one before it is over
			waitingRunIds.value = candidates.filter((item) => item !== runId);
		}
	);

	/*
	 * The steps a run took while the socket was down are not sent again: once the automation is watched again,
	 * what a run that is still going stored so far is read, and the live steps go on from there. A run that
	 * has not stored anything yet (it never waited) has nothing to read, and is followed live as it was.
	 */
	watch(
		(): boolean => live.watching.value,
		(watching: boolean, wasWatching: boolean): void => {
			if (!watching || wasWatching) {
				return;
			}

			// The runs waiting may have ended while the socket was down: what they stored says so
			for (const runId of [...(source.value ? [source.value.runId] : []), ...waitingRunIds.value]) {
				if (!isEnded(runsStore.findById(runId))) {
					recover(runId);
				}
			}
		}
	);

	const shown = computed<IAutomationShownRun | null>((): IAutomationShownRun | null => {
		const current = source.value;

		if (!current) {
			return null;
		}

		const run = shownRecord.value;
		const steps = mergeRunSteps(run?.trace?.steps ?? [], live.stepsOf(current.runId));
		const ended = isEnded(run);

		return {
			runId: current.runId,
			source: current.kind,
			run,
			steps,
			overlay: mapTraceToOverlay(graph.value, steps),
			ended,
			attention: run && ended ? findRunAttention(run, steps, graph.value) : null,
			loading: runsStore.getting(current.runId),
			failed: failedReads.value.has(readKey(current.runId, run)),
			truncated: run?.trace?.truncated ?? false,
		};
	});

	const fetchRuns = async (): Promise<void> => {
		runsLoadFailed.value = false;

		try {
			await runsStore.fetch({ automationId: id, fresh: true });
		} catch {
			runsLoadFailed.value = true;
		}
	};

	// Only explains the status of the automation; when it cannot be read the status is still shown
	const fetchRuntime = async (): Promise<void> => {
		try {
			await runsStore.fetchRuntime({ automationId: id });
		} catch {
			// Nothing more to say than the status itself
		}
	};

	const test = async (nodeId?: string): Promise<IAutomationTriggerResult> => {
		const result = await runsStore.trigger({ automationId: id, ...(typeof nodeId === 'string' ? { nodeId } : {}) });

		if (result.started && result.runId !== null) {
			// Shown before the runs waiting are let go of: the run may be one of them, and it stays open throughout
			source.value = { kind: 'live', runId: result.runId, pick: ++picks };
			waitingRunIds.value = [];

			// With no history held, a short run may have ended before the answer named it: what it stored says so
			if (!runsStore.firstLoadFinished(id) && runsStore.findById(result.runId) === null) {
				recover(result.runId);
			}
		}

		return result;
	};

	const replay = (runId: string): void => {
		// Picked again after a read that failed: it is tried again
		failedReads.value = new Set([...failedReads.value].filter((key) => !key.startsWith(`${runId}:`)));

		source.value = { kind: 'replay', runId, pick: ++picks };
		waitingRunIds.value = [];
	};

	const close = (): void => {
		if (source.value?.kind === 'live') {
			dismiss(source.value.runId);
		}

		waitingRunIds.value = [];
		source.value = null;
	};

	/*
	 * The run shown and the runs waiting are open in the store: their records and traces are kept while the view
	 * has them, history read or not. A run that moves from waiting to shown stays open throughout, and what was
	 * opened is what is let go of when the view closes.
	 */
	let opened: string[] = [];

	const hold = (next: string[]): void => {
		for (const runId of next) {
			if (!opened.includes(runId)) {
				runsStore.open({ id: runId });
			}
		}

		for (const runId of opened) {
			if (!next.includes(runId)) {
				runsStore.release({ id: runId });
			}
		}

		opened = next;
	};

	// At once, not on the next tick: an event that comes right after the step that took a run up is kept for it
	watch((): string[] => [...new Set([...(source.value ? [source.value.runId] : []), ...waitingRunIds.value])], hold, {
		immediate: true,
		flush: 'sync',
	});

	onScopeDispose((): void => {
		hold([]);
	});

	return {
		runs,
		runsLoading,
		runsLoadFailed,
		runtime,
		testing,
		watching: live.watching,
		shown,
		fetchRuns,
		fetchRuntime,
		test,
		replay,
		close,
	};
};
