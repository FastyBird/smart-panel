import { type MaybeRefOrGetter, type Ref, onScopeDispose, ref, toValue, watch } from 'vue';

import type { ModbusPoint, ModbusPointBinding } from '../lib/points';

import type { IModbusProbeError, IModbusProbePointResult, IModbusProbePointsResult } from './useModbusProbe';

export interface IModbusLiveReadInput {
	key: string;
	read: ModbusPointBinding;
}

export interface IUseModbusLiveValues {
	/** The latest result of each point, by point key. */
	results: Ref<Record<string, IModbusProbePointResult>>;
	/** Set when the whole read failed (connection, timeout, busy, ...). */
	error: Ref<IModbusProbeError | null>;
	reading: Ref<boolean>;
	autoRefresh: Ref<boolean>;
	readNow: () => Promise<void>;
	/**
	 * Runs `work` (e.g. a test write and its read-back) with the timer paused, once any read in flight has finished, so
	 * the work never collides with an automatic read.
	 */
	whilePaused: <T>(work: () => Promise<T>) => Promise<T>;
}

/**
 * Reads the points that have a read binding. Never has two requests in flight: a timer tick is skipped while a read
 * runs, and an explicit `readNow` waits for it and then reads again (so it also sees a value written in between).
 * The timer ends with the surrounding component or effect scope.
 */
export const useModbusLiveValues = (
	points: MaybeRefOrGetter<ModbusPoint[]>,
	readFn: (inputs: IModbusLiveReadInput[]) => Promise<IModbusProbePointsResult>,
	intervalMs = 2000
): IUseModbusLiveValues => {
	const results = ref<Record<string, IModbusProbePointResult>>({});
	const error = ref<IModbusProbeError | null>(null);
	const reading = ref<boolean>(false);
	const autoRefresh = ref<boolean>(false);

	let inFlight: Promise<void> | null = null;
	let timer: ReturnType<typeof setInterval> | null = null;
	let disposed = false;
	let pauseDepth = 0;
	// The binding each shown result was read with. Editing a point keeps its key, so a result is only valid while the
	// point still has that binding.
	let readWith = new Map<string, string>();

	const signatureOf = (read: ModbusPointBinding): string => JSON.stringify(read);

	const currentSignatures = (): Map<string, string> =>
		new Map(toValue(points).flatMap((point) => (point.read === null ? [] : [[point.key, signatureOf(point.read)] as const])));

	const show = (shown: IModbusProbePointResult[], signatures: Map<string, string>): void => {
		results.value = Object.fromEntries(shown.map((result) => [result.key, result]));
		readWith = new Map(shown.map((result) => [result.key, signatures.get(result.key) ?? '']));
	};

	const run = async (): Promise<void> => {
		const inputs = toValue(points).flatMap((point) => (point.read === null ? [] : [{ key: point.key, read: point.read }]));

		if (inputs.length === 0) {
			show([], new Map());
			error.value = null;

			return;
		}

		const sent = new Map(inputs.map((input) => [input.key, signatureOf(input.read)]));

		reading.value = true;

		try {
			const response = await readFn(inputs);

			if (disposed) {
				return;
			}

			// Per-point raw values and errors are kept even when nothing decoded (illegal address, value map miss);
			// only a top-level error (the whole read failed) is an alert.
			// A point edited while the read was in flight gets no result: it was read with its old binding.
			const current = currentSignatures();

			error.value = response.error;
			show(
				response.points.filter((result) => sent.get(result.key) === current.get(result.key)),
				sent
			);
		} catch (caught: unknown) {
			if (!disposed) {
				show([], new Map());
				error.value = { kind: 'request', exceptionCode: null, message: caught instanceof Error ? caught.message : String(caught) };
			}
		} finally {
			reading.value = false;
		}
	};

	const readNow = async (): Promise<void> => {
		while (inFlight !== null) {
			await inFlight;
		}

		if (disposed) {
			return;
		}

		inFlight = run();

		try {
			await inFlight;
		} finally {
			inFlight = null;
		}
	};

	const whilePaused = async <T>(work: () => Promise<T>): Promise<T> => {
		pauseDepth++;

		try {
			while (inFlight !== null) {
				await inFlight;
			}

			return await work();
		} finally {
			pauseDepth--;
		}
	};

	// Drops the shown result of every point whose binding changed (or that lost its read binding).
	watch(
		() => [...currentSignatures()].map(([key, signature]) => `${key}\u0000${signature}`).join('\u0001'),
		() => {
			const current = currentSignatures();
			const kept = Object.values(results.value).filter((result) => readWith.get(result.key) === current.get(result.key));

			if (kept.length !== Object.keys(results.value).length) {
				show(kept, readWith);
			}
		}
	);

	const stopTimer = (): void => {
		if (timer !== null) {
			clearInterval(timer);
			timer = null;
		}
	};

	watch(
		autoRefresh,
		(enabled) => {
			stopTimer();

			if (!enabled || disposed) {
				return;
			}

			// Paused work (a test write) does its own read-back; the first automatic read must not overlap it.
			if (pauseDepth === 0) {
				void readNow();
			}

			timer = setInterval(() => {
				if (inFlight === null && pauseDepth === 0) {
					void readNow();
				}
			}, intervalMs);
		},
		{ flush: 'sync' }
	);

	onScopeDispose(() => {
		disposed = true;
		stopTimer();
	});

	return { results, error, reading, autoRefresh, readNow, whilePaused };
};
