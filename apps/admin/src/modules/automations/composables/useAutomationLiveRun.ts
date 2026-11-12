import { ref, shallowRef } from 'vue';

import { tryOnScopeDispose } from '@vueuse/core';

import { useLogger, useSockets } from '../../../common';
import { AUTOMATION_LIVE_RUNS_BUFFERED, CommandHandlerName, CommandType, EventType } from '../automations.constants';
import { newerRunStep } from '../automations.trace';
import type { IAutomation } from '../store/automations.store.types';
import type { IAutomationRunStep } from '../store/runs.store.types';
import { transformAutomationRunStep } from '../store/runs.transformers';

import type { IUseAutomationLiveRun } from './types';

interface IUseAutomationLiveRunProps {
	id: IAutomation['id'];
	// The run whose steps are never let go of: the one shown, however many other runs send theirs
	keep?: () => string | null;
}

interface ISocketEvent {
	event?: string;
	payload?: unknown;
}

/**
 * The steps of the runs of one automation as they happen. The backend sends them only to the clients that
 * watch the automation (`AutomationsModule.WatchAutomation`), so the view watches it for as long as it is
 * open - and again after every reconnect, as a new socket is in no room - and stops when it is left.
 *
 * The steps are kept per run, for the last few runs and the run shown: a step can arrive before the answer
 * to the request that started the run says which run it is.
 */
export const useAutomationLiveRun = ({ id, keep }: IUseAutomationLiveRunProps): IUseAutomationLiveRun => {
	const { sockets, sendCommand } = useSockets();
	const logger = useLogger();

	const watching = ref<boolean>(false);

	// Replaced as a whole on every step, so whoever reads the steps of a run is told
	const runs = shallowRef<Map<string, IAutomationRunStep[]>>(new Map());

	// Told of every step, as it arrives: several can arrive before anything that reads them runs
	const stepListeners: ((runId: string) => void)[] = [];

	let disposed = false;

	// A watch was asked for on this socket: the backend may join the room even when no answer came in time, so
	// it is unwatched when the view is left whatever the answer was
	let attempted = false;

	const watch = async (): Promise<void> => {
		attempted = true;

		try {
			const result = await sendCommand(CommandType.WATCH_AUTOMATION, { automation_id: id }, CommandHandlerName.WATCH_AUTOMATION);

			// The view was left while the answer was on its way, and the watch was stopped then
			if (disposed) {
				return;
			}

			watching.value = result === true;

			if (result !== true) {
				logger.warn(`Failed to watch the runs of automation ${id}: ${result}`);
			}
		} catch (error) {
			watching.value = false;

			logger.warn(`Failed to watch the runs of automation ${id}:`, error);
		}
	};

	const unwatch = async (): Promise<void> => {
		watching.value = false;
		attempted = false;

		try {
			await sendCommand(CommandType.UNWATCH_AUTOMATION, { automation_id: id }, CommandHandlerName.UNWATCH_AUTOMATION);
		} catch {
			// A socket that is gone has left every room already
		}
	};

	const onEvent = (data: ISocketEvent): void => {
		if (data?.event !== EventType.RUN_STEP || typeof data.payload !== 'object' || data.payload === null) {
			return;
		}

		const payload = data.payload as Record<string, unknown>;

		if (payload.automation_id !== id || typeof payload.run_id !== 'string') {
			return;
		}

		const step = transformAutomationRunStep(payload.step);

		if (step === null) {
			return;
		}

		const next = new Map(runs.value);
		const steps = next.get(payload.run_id) ?? [];

		// A step that arrives twice (a reconnect in the middle of a run, a Delay that let the run go on) is
		// not shown twice: the newer report of it is kept
		const held = steps.find((item) => item.seq === step.seq);
		const kept = newerRunStep(held, step);

		if (kept !== held) {
			next.delete(payload.run_id);
			next.set(
				payload.run_id,
				[...steps.filter((item) => item.seq !== step.seq), kept].sort((a, b) => a.seq - b.seq)
			);
		}

		// The runs that sent nothing for longest are let go of, but never the run shown
		const shownRunId = keep?.() ?? null;
		const evictable = [...next.keys()].filter((runId) => runId !== shownRunId);

		while (next.size > AUTOMATION_LIVE_RUNS_BUFFERED + (shownRunId !== null && next.has(shownRunId) ? 1 : 0) && evictable.length > 0) {
			next.delete(evictable.shift() as string);
		}

		runs.value = next;

		for (const listener of stepListeners) {
			listener(payload.run_id);
		}
	};

	const onConnect = (): void => {
		void watch();
	};

	const onDisconnect = (): void => {
		// A socket that is gone has left every room
		watching.value = false;
		attempted = false;
	};

	const stepsOf = (runId: string): IAutomationRunStep[] => runs.value.get(runId) ?? [];

	const onStep = (listener: (runId: string) => void): void => {
		stepListeners.push(listener);
	};

	sockets.on('event', onEvent);
	sockets.on('connect', onConnect);
	sockets.on('disconnect', onDisconnect);

	if (sockets.connected) {
		void watch();
	}

	tryOnScopeDispose((): void => {
		disposed = true;

		sockets.off('event', onEvent);
		sockets.off('connect', onConnect);
		sockets.off('disconnect', onDisconnect);

		if (attempted) {
			void unwatch();
		}
	});

	return {
		watching,
		stepsOf,
		onStep,
	};
};
