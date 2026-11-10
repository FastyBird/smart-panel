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

	const run = async (): Promise<void> => {
		const inputs = toValue(points).flatMap((point) => (point.read === null ? [] : [{ key: point.key, read: point.read }]));

		if (inputs.length === 0) {
			results.value = {};
			error.value = null;

			return;
		}

		reading.value = true;

		try {
			const response = await readFn(inputs);

			if (disposed) {
				return;
			}

			// Per-point raw values and errors are kept even when nothing decoded (illegal address, value map miss);
			// only a top-level error (the whole read failed) is an alert.
			error.value = response.error;
			results.value = Object.fromEntries(response.points.map((result) => [result.key, result]));
		} catch (caught: unknown) {
			if (!disposed) {
				results.value = {};
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

			void readNow();

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
