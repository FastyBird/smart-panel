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
 * The steps are kept per run, for the last few runs: a step can arrive before the answer to the request
 * that started the run says which run it is.
 */
export const useAutomationLiveRun = ({ id }: IUseAutomationLiveRunProps): IUseAutomationLiveRun => {
	const { sockets, sendCommand } = useSockets();
	const logger = useLogger();

	const watching = ref<boolean>(false);

	// Replaced as a whole on every step, so whoever reads the steps of a run is told
	const runs = shallowRef<Map<string, IAutomationRunStep[]>>(new Map());

	// The run a step arrived for last
	const latestRunId = ref<string | null>(null);

	let disposed = false;

	const watch = async (): Promise<void> => {
		try {
			const result = await sendCommand(CommandType.WATCH_AUTOMATION, { automation_id: id }, CommandHandlerName.WATCH_AUTOMATION);

			// The view may have been left while the answer was on its way
			if (disposed) {
				void unwatch();

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

		// The oldest runs are let go of
		while (next.size > AUTOMATION_LIVE_RUNS_BUFFERED) {
			const oldest = next.keys().next().value;

			if (typeof oldest !== 'string') {
				break;
			}

			next.delete(oldest);
		}

		runs.value = next;
		latestRunId.value = payload.run_id;
	};

	const onConnect = (): void => {
		void watch();
	};

	const onDisconnect = (): void => {
		watching.value = false;
	};

	const stepsOf = (runId: string): IAutomationRunStep[] => runs.value.get(runId) ?? [];

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

		if (watching.value) {
			void unwatch();
		}
	});

	return {
		watching,
		latestRunId,
		stepsOf,
	};
};
