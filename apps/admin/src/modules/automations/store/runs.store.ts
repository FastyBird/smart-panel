import { ref } from 'vue';

import { type Pinia, type Store, defineStore } from 'pinia';

import { MODULES_PREFIX } from '../../../app.constants';
import { getErrorCode, getErrorReason, snakeToCamel, useBackend } from '../../../common';
import type { operations } from '../../../openapi';
import {
	AUTOMATIONS_MODULE_PREFIX,
	AUTOMATION_RUNS_KEPT_PER_AUTOMATION,
	AUTOMATION_TRIGGER_REFUSALS,
	AutomationRunRecordStatus,
	type AutomationTriggerRefusal,
} from '../automations.constants';
import { AutomationsApiException, AutomationsException, AutomationsTriggerRefusedException } from '../automations.exceptions';

import { AutomationRunSchema } from './runs.store.schemas';
import type {
	IAutomationRun,
	IAutomationRunsFetchActionPayload,
	IAutomationRunsGetActionPayload,
	IAutomationRunsOnEventActionPayload,
	IAutomationRunsStateSemaphore,
	IAutomationRunsStoreActions,
	IAutomationRunsStoreState,
	IAutomationRunsTriggerActionPayload,
	IAutomationRunsUnsetActionPayload,
	IAutomationRuntime,
	IAutomationTriggerResult,
} from './runs.store.types';
import { transformAutomationRunResponse, transformAutomationRuntimeResponse, transformAutomationTriggerResultResponse } from './runs.transformers';

export type AutomationRunsStoreSetup = IAutomationRunsStoreState & IAutomationRunsStoreActions;

type GetRunsOperation = operations['get-automations-module-automation-runs'];
type GetRunOperation = operations['get-automations-module-run'];
type TriggerOperation = operations['trigger-automations-module-automation'];
type GetRuntimeOperation = operations['get-automations-module-automation-runtime'];

const toApiException = (error: unknown, message: string): AutomationsException => {
	return error instanceof AutomationsException ? error : new AutomationsApiException(message, null, error as Error);
};

const isRunning = (run: Pick<IAutomationRun, 'status'>): boolean => run.status === AutomationRunRecordStatus.running;

/**
 * Of two records of the same run, the one that knows more. A run only ever moves from `running` to how it
 * ended, so an ended run is never taken back to `running` by a record that was on its way for longer.
 * The trace held stays when the other record has none and is about the same moment of the run.
 */
export const mergeAutomationRun = (held: IAutomationRun | undefined, incoming: IAutomationRun): IAutomationRun => {
	if (!held) {
		return incoming;
	}

	if (!isRunning(held) && isRunning(incoming)) {
		return held;
	}

	const sameMoment = held.status === incoming.status;

	return incoming.trace === null && held.trace !== null && sameMoment ? { ...incoming, trace: held.trace } : incoming;
};

// Newest first, as the backend lists them, and no more than it keeps
const sortRuns = (runs: IAutomationRun[]): IAutomationRun[] =>
	[...runs].sort((a, b) => b.startedAt.getTime() - a.startedAt.getTime()).slice(0, AUTOMATION_RUNS_KEPT_PER_AUTOMATION);

const withoutTrace = (run: IAutomationRun): IAutomationRun => (run.trace === null ? run : { ...run, trace: null });

/**
 * The runs of the automations: the history of each automation, the trace of a run, and starting a run by
 * hand. A run is never changed from here: it is what the backend recorded.
 *
 * Responses and events reach the store in no particular order. A run only moves forward (from `running` to
 * how it ended), so of two records of the same run the one that ended wins (`mergeAutomationRun`). A list
 * is the whole history at the moment it was served: a run an event brought after the list was asked for
 * is kept even when the list does not name it yet.
 */
export const useAutomationRunsStore = defineStore<'automations_module-runs', AutomationRunsStoreSetup>(
	'automations_module-runs',
	(): AutomationRunsStoreSetup => {
		const backend = useBackend();

		const semaphore = ref<IAutomationRunsStateSemaphore>({ fetching: [], getting: [], triggering: [] });

		const loaded = ref<Set<IAutomationRun['automationId']>>(new Set());

		const data = ref<Map<IAutomationRun['automationId'], IAutomationRun[]>>(new Map());

		const traces = ref<Map<IAutomationRun['id'], IAutomationRun>>(new Map());

		const runtimes = ref<Map<IAutomationRun['automationId'], IAutomationRuntime>>(new Map());

		// Every change of a run is numbered, every request takes a number when it starts: what changed after a
		// list was asked for is newer than the list
		let sequence = 0;

		const changedAt = new Map<IAutomationRun['id'], number>();

		// A reset or a removed automation ends what was on its way for it
		const removedAt = new Map<IAutomationRun['automationId'], number>();

		let allRemovedAt = 0;

		const dropped = (automationId: IAutomationRun['automationId'], startedAt: number): boolean =>
			Math.max(removedAt.get(automationId) ?? 0, allRemovedAt) > startedAt;

		const firstLoadFinished = (automationId: IAutomationRun['automationId']): boolean => loaded.value.has(automationId);

		const fetching = (automationId: IAutomationRun['automationId']): boolean => semaphore.value.fetching.includes(automationId);

		const getting = (id: IAutomationRun['id']): boolean => semaphore.value.getting.includes(id);

		const triggering = (automationId: IAutomationRun['automationId']): boolean => semaphore.value.triggering.includes(automationId);

		const findForAutomation = (automationId: IAutomationRun['automationId']): IAutomationRun[] => data.value.get(automationId) ?? [];

		const findById = (id: IAutomationRun['id']): IAutomationRun | null => {
			const traced = traces.value.get(id);

			if (traced) {
				return traced;
			}

			for (const runs of data.value.values()) {
				const run = runs.find((item) => item.id === id);

				if (run) {
					return run;
				}
			}

			return null;
		};

		const findRuntime = (automationId: IAutomationRun['automationId']): IAutomationRuntime | null => runtimes.value.get(automationId) ?? null;

		/**
		 * The only place a run is written. A trace held for a run that has moved on since is let go of: it is
		 * read again when it is wanted.
		 */
		const commit = (incoming: IAutomationRun): IAutomationRun => {
			const runs = data.value.get(incoming.automationId);
			const listed = runs?.find((run) => run.id === incoming.id);
			const tracedHeld = traces.value.get(incoming.id);

			const held = listed && tracedHeld ? mergeAutomationRun(listed, tracedHeld) : (listed ?? tracedHeld);

			const merged = mergeAutomationRun(held, incoming);

			// A history that was not read is not started here: it would look read while it holds one run
			if (runs) {
				const others = runs.filter((run) => run.id !== merged.id);

				data.value.set(incoming.automationId, sortRuns([withoutTrace(merged), ...others]));
			}

			if (merged.trace !== null) {
				traces.value.set(merged.id, merged);
			} else if (tracedHeld && tracedHeld.status !== merged.status) {
				traces.value.delete(merged.id);
			}

			changedAt.set(merged.id, ++sequence);

			return merged;
		};

		const onEvent = (payload: IAutomationRunsOnEventActionPayload): IAutomationRun | null => {
			// The payload of `AutomationsModule.Run.Started|Completed` is the run without its trace
			const parsed = AutomationRunSchema.safeParse({ ...snakeToCamel(payload.data), trace: null });

			if (!parsed.success) {
				return null;
			}

			// The history of an automation that was never looked at is not started by an event: it would look
			// read while it holds only the runs since
			if (!data.value.has(parsed.data.automationId) && !traces.value.has(parsed.data.id)) {
				changedAt.set(parsed.data.id, ++sequence);

				return null;
			}

			return commit(parsed.data);
		};

		const pendingFetchPromises: Record<string, Promise<IAutomationRun[]>> = {};

		const fetch = async (payload: IAutomationRunsFetchActionPayload): Promise<IAutomationRun[]> => {
			const { automationId } = payload;

			const existingPromise = pendingFetchPromises[automationId];

			if (existingPromise && payload.fresh === true) {
				await existingPromise.catch((): void => {});

				return fetch({ automationId });
			}

			if (existingPromise) {
				return existingPromise;
			}

			const fetchPromise = (async (): Promise<IAutomationRun[]> => {
				const startedAt = ++sequence;

				semaphore.value.fetching.push(automationId);

				try {
					const {
						data: responseData,
						error,
						response,
					} = await backend.client.GET(`/${MODULES_PREFIX}/${AUTOMATIONS_MODULE_PREFIX}/automations/{id}/runs`, {
						params: { path: { id: automationId } },
					});

					if (typeof responseData === 'undefined') {
						let errorReason: string = 'Failed to fetch automation runs.';

						if (error) {
							errorReason = getErrorReason<GetRunsOperation>(error, errorReason);
						}

						throw new AutomationsApiException(errorReason, response?.status ?? null);
					}

					if (dropped(automationId, startedAt)) {
						return findForAutomation(automationId);
					}

					const fetched = responseData.data.map((run) => transformAutomationRunResponse(run as unknown as Record<string, unknown>));
					const fetchedIds = new Set(fetched.map((run) => run.id));

					const held = data.value.get(automationId) ?? [];

					// What an event brought while the list was on its way is newer than the list
					const newer = held.filter((run) => (changedAt.get(run.id) ?? 0) > startedAt);

					const merged = fetched.map((run) => {
						const recent = newer.find((item) => item.id === run.id);

						return recent ? mergeAutomationRun(run, recent) : mergeAutomationRun(traces.value.get(run.id), run);
					});

					const runs = sortRuns([...merged.map(withoutTrace), ...newer.filter((run) => !fetchedIds.has(run.id))]);

					data.value.set(automationId, runs);

					for (const run of runs) {
						changedAt.set(run.id, Math.max(changedAt.get(run.id) ?? 0, startedAt));
					}

					loaded.value.add(automationId);

					return runs;
				} catch (e) {
					throw toApiException(e, 'Failed to fetch automation runs.');
				} finally {
					semaphore.value.fetching = semaphore.value.fetching.filter((item) => item !== automationId);
				}
			})().finally((): void => {
				delete pendingFetchPromises[automationId];
			});

			pendingFetchPromises[automationId] = fetchPromise;

			return fetchPromise;
		};

		const pendingGetPromises: Record<string, Promise<IAutomationRun>> = {};

		const get = async (payload: IAutomationRunsGetActionPayload): Promise<IAutomationRun> => {
			const { id } = payload;

			const existingPromise = pendingGetPromises[id];

			if (existingPromise && payload.fresh === true) {
				await existingPromise.catch((): void => {});

				return get({ id });
			}

			if (existingPromise) {
				return existingPromise;
			}

			const getPromise = (async (): Promise<IAutomationRun> => {
				const startedAt = ++sequence;

				semaphore.value.getting.push(id);

				try {
					const {
						data: responseData,
						error,
						response,
					} = await backend.client.GET(`/${MODULES_PREFIX}/${AUTOMATIONS_MODULE_PREFIX}/runs/{runId}`, {
						params: { path: { runId: id } },
					});

					if (typeof responseData === 'undefined') {
						let errorReason: string = 'Failed to get automation run.';

						if (error) {
							errorReason = getErrorReason<GetRunOperation>(error, errorReason);
						}

						throw new AutomationsApiException(errorReason, response?.status ?? null);
					}

					const run = transformAutomationRunResponse(responseData.data as unknown as Record<string, unknown>);

					if (dropped(run.automationId, startedAt)) {
						throw new AutomationsApiException('Automation run was removed.', 404);
					}

					const merged = commit(run);

					// An event that ended the run while the read was on its way left the trace behind: it is read again
					return merged.trace !== null ? merged : run;
				} catch (e) {
					throw toApiException(e, 'Failed to get automation run.');
				} finally {
					semaphore.value.getting = semaphore.value.getting.filter((item) => item !== id);
				}
			})().finally((): void => {
				delete pendingGetPromises[id];
			});

			pendingGetPromises[id] = getPromise;

			return getPromise;
		};

		const trigger = async (payload: IAutomationRunsTriggerActionPayload): Promise<IAutomationTriggerResult> => {
			const { automationId, nodeId } = payload;

			if (triggering(automationId)) {
				throw new AutomationsApiException('The automation is being started already.');
			}

			semaphore.value.triggering.push(automationId);

			try {
				const {
					data: responseData,
					error,
					response,
				} = await backend.client.POST(`/${MODULES_PREFIX}/${AUTOMATIONS_MODULE_PREFIX}/automations/{id}/trigger`, {
					params: { path: { id: automationId } },
					body: typeof nodeId === 'string' ? { data: { node_id: nodeId } } : {},
				});

				if (typeof responseData !== 'undefined') {
					return transformAutomationTriggerResultResponse(responseData.data as unknown as Record<string, unknown>);
				}

				let errorReason: string = 'Failed to start automation.';

				if (error) {
					errorReason = getErrorReason<TriggerOperation>(error, errorReason);
				}

				if (response?.status === 422) {
					const code = error ? getErrorCode<TriggerOperation>(error) : null;

					throw new AutomationsTriggerRefusedException(
						errorReason,
						AUTOMATION_TRIGGER_REFUSALS.includes(code as AutomationTriggerRefusal) ? (code as AutomationTriggerRefusal) : null
					);
				}

				throw new AutomationsApiException(errorReason, response?.status ?? null);
			} catch (e) {
				throw toApiException(e, 'Failed to start automation.');
			} finally {
				semaphore.value.triggering = semaphore.value.triggering.filter((item) => item !== automationId);
			}
		};

		const fetchRuntime = async (payload: IAutomationRunsFetchActionPayload): Promise<IAutomationRuntime> => {
			const { automationId } = payload;

			const startedAt = ++sequence;

			try {
				const {
					data: responseData,
					error,
					response,
				} = await backend.client.GET(`/${MODULES_PREFIX}/${AUTOMATIONS_MODULE_PREFIX}/automations/{id}/runtime`, {
					params: { path: { id: automationId } },
				});

				if (typeof responseData === 'undefined') {
					let errorReason: string = 'Failed to fetch automation runtime.';

					if (error) {
						errorReason = getErrorReason<GetRuntimeOperation>(error, errorReason);
					}

					throw new AutomationsApiException(errorReason, response?.status ?? null);
				}

				const runtime = transformAutomationRuntimeResponse(responseData.data as unknown as Record<string, unknown>);

				if (!dropped(automationId, startedAt)) {
					runtimes.value.set(automationId, runtime);
				}

				return runtime;
			} catch (e) {
				throw toApiException(e, 'Failed to fetch automation runtime.');
			}
		};

		// The automation is gone, and its history with it
		const unset = (payload: IAutomationRunsUnsetActionPayload): void => {
			data.value.delete(payload.automationId);
			runtimes.value.delete(payload.automationId);
			loaded.value.delete(payload.automationId);

			for (const [id, run] of traces.value) {
				if (run.automationId === payload.automationId) {
					traces.value.delete(id);
				}
			}

			removedAt.set(payload.automationId, ++sequence);
		};

		// The module was reset: every automation is gone, and every run
		const reset = (): void => {
			data.value.clear();
			traces.value.clear();
			runtimes.value.clear();
			loaded.value.clear();

			allRemovedAt = ++sequence;
		};

		// Reconnect refresh contract: the histories read so far may have missed runs while the socket was down
		const isLoaded = (): boolean => loaded.value.size > 0 || semaphore.value.fetching.length > 0;

		const refresh = (): Promise<unknown> =>
			Promise.allSettled([...new Set([...loaded.value, ...semaphore.value.fetching])].map((automationId) => fetch({ automationId, fresh: true })));

		return {
			data,
			traces,
			runtimes,
			semaphore,
			firstLoadFinished,
			fetching,
			getting,
			triggering,
			findForAutomation,
			findById,
			findRuntime,
			fetch,
			get,
			trigger,
			fetchRuntime,
			onEvent,
			unset,
			reset,
			isLoaded,
			refresh,
		};
	}
);

export const registerAutomationRunsStore = (pinia: Pinia): Store<string, IAutomationRunsStoreState, object, IAutomationRunsStoreActions> => {
	return useAutomationRunsStore(pinia);
};
