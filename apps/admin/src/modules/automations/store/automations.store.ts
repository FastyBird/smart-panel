import { ref } from 'vue';

import { type Pinia, type Store, defineStore } from 'pinia';

import { get as lodashGet } from 'lodash';

import { MODULES_PREFIX } from '../../../app.constants';
import { getErrorCode, getErrorReason, useBackend, useLogger } from '../../../common';
import type {
	AutomationsModuleDeleteAutomationOperation,
	AutomationsModuleGetAutomationOperation,
	AutomationsModuleGetAutomationsOperation,
	AutomationsModuleUpdateAutomationOperation,
} from '../../../openapi.constants';
import { AUTOMATIONS_MODULE_PREFIX, AUTOMATION_GRAPH_INVALID_ERROR_CODE } from '../automations.constants';
import {
	AutomationsApiException,
	AutomationsException,
	AutomationsGraphInvalidException,
	AutomationsRevisionConflictException,
	AutomationsValidationException,
} from '../automations.exceptions';

import { AutomationSchema, AutomationsAddActionPayloadSchema, AutomationsEditActionPayloadSchema } from './automations.store.schemas';
import type {
	IAutomation,
	IAutomationsAddActionPayload,
	IAutomationsEditActionPayload,
	IAutomationsGetActionPayload,
	IAutomationsOnEventActionPayload,
	IAutomationsRemoveActionPayload,
	IAutomationsSetActionPayload,
	IAutomationsStateSemaphore,
	IAutomationsStoreActions,
	IAutomationsStoreState,
	IAutomationsUnsetActionPayload,
} from './automations.store.types';
import {
	transformAutomationCreateRequest,
	transformAutomationGraphIssues,
	transformAutomationResponse,
	transformAutomationUpdateRequest,
} from './automations.transformers';

export type AutomationsStoreSetup = IAutomationsStoreState & IAutomationsStoreActions;

// Create and update answer a refusal with the same error envelope, so one of them stands for both
type SaveOperation = AutomationsModuleUpdateAutomationOperation;

type ApiErrorEnvelope = Parameters<typeof getErrorReason<SaveOperation>>[0];

// What the engine writes without moving the revision
const ENGINE_FIELDS = ['status', 'lastTriggeredAt', 'lastRunStatus'] as const;

const createDefaultSemaphore = (): IAutomationsStateSemaphore => ({
	fetching: {
		items: false,
		item: [],
	},
	creating: [],
	updating: [],
	deleting: [],
});

/**
 * Anything that is not already one of the module exceptions (a network failure above all) is wrapped,
 * so callers only ever have to tell the module exceptions apart.
 */
const toApiException = (error: unknown, message: string): AutomationsException => {
	return error instanceof AutomationsException ? error : new AutomationsApiException(message, null, error as Error);
};

export const useAutomationsStore = defineStore<'automations_module-automations', AutomationsStoreSetup>(
	'automations_module-automations',
	(): AutomationsStoreSetup => {
		const backend = useBackend();
		const logger = useLogger();

		const semaphore = ref<IAutomationsStateSemaphore>(createDefaultSemaphore());

		const firstLoad = ref<boolean>(false);

		const data = ref<Map<IAutomation['id'], IAutomation>>(new Map());

		const firstLoadFinished = (): boolean => firstLoad.value;

		const getting = (id: IAutomation['id']): boolean => semaphore.value.fetching.item.includes(id);

		const fetching = (): boolean => semaphore.value.fetching.items;

		const findAll = (): IAutomation[] => Array.from(data.value.values());

		const findById = (id: IAutomation['id']): IAutomation | null => data.value.get(id) ?? null;

		const findBySpace = (spaceId: IAutomation['spaceId']): IAutomation[] => {
			return Array.from(data.value.values()).filter((automation) => automation.spaceId === spaceId);
		};

		const pendingGetPromises: Record<string, Promise<IAutomation>> = {};

		const pendingFetchPromises: Record<string, Promise<IAutomation[]>> = {};

		// CONCURRENCY MODEL
		// =================
		// Responses and events reach the store in no particular order. Two things decide what may
		// overwrite what, and nothing else does:
		//
		//  1. The revision. It moves with every save, so the higher one is the newer automation: a lower
		//     one never overwrites a higher one, a higher one always replaces a lower one.
		//  2. A local sequence, for what the revision cannot tell: removals, and the writes of the engine
		//     (status, last run), which keep the revision. Every write and every removal of an id, whatever
		//     it comes from, is numbered in `changedAt` - also for ids that are not held, and a reset of the
		//     module counts as a removal of them all. A request notes the sequence when it STARTS; an id
		//     changed after that was "overtaken", and for it the response is older than what the store
		//     has heard since:
		//       - the automation is not held: it was removed meanwhile, the response is dropped;
		//       - the revision is the same: the engine fields held stay, and the response only adds what
		//         is missing (the graph of a detail read);
		//       - the response says it is gone (404, or a list without it): it stays; if it really is
		//         gone, its removal is announced.
		//     An event is as new as it gets, so nothing has overtaken it.
		//
		// A read that has to be newer than some moment (after a conflict, after a module reset) never
		// joins a request started before it: it waits for that one to finish and reads again.
		let sequence = 0;

		const changedAt = new Map<IAutomation['id'], number>();

		let allRemovedAt = 0;

		const overtaken = (id: IAutomation['id'], startedAt: number): boolean => Math.max(changedAt.get(id) ?? 0, allRemovedAt) > startedAt;

		const onEvent = (payload: IAutomationsOnEventActionPayload): IAutomation => {
			return set({
				id: payload.id,
				data: transformAutomationResponse(payload.data, AutomationSchema),
			});
		};

		/**
		 * The only place an automation is written. `startedAt` is the sequence noted when the request the
		 * data answers was started; an event has none and is taken as of now. Returns null when the
		 * automation was removed since, so the data is about something that is no longer there.
		 */
		const commit = (id: IAutomation['id'], incoming: IAutomationsSetActionPayload['data'], startedAt: number = sequence): IAutomation | null => {
			const held = data.value.get(id);
			const stale = overtaken(id, startedAt);

			if (!held) {
				if (stale) {
					return null;
				}
			} else if (typeof incoming.revision === 'number' && incoming.revision < held.revision) {
				return held;
			}

			const candidate: Record<string, unknown> = held ? { ...held, ...incoming } : { ...incoming, id };

			if (held && stale && candidate.revision === held.revision) {
				for (const field of ENGINE_FIELDS) {
					candidate[field] = held[field];
				}
			}

			// The list comes without graphs. A graph read earlier stays for as long as it is the graph of the
			// revision held; once the revision has moved it is stale and has to be read again.
			if (held && (incoming.graph === null || typeof incoming.graph === 'undefined')) {
				candidate.graph = candidate.revision === held.revision ? held.graph : null;
			}

			const parsed = AutomationSchema.safeParse(candidate);

			if (!parsed.success) {
				logger.error('Schema validation failed with:', parsed.error);

				throw new AutomationsValidationException('Failed to insert automation.');
			}

			data.value.set(parsed.data.id, parsed.data);

			changedAt.set(parsed.data.id, ++sequence);

			return parsed.data;
		};

		const set = (payload: IAutomationsSetActionPayload): IAutomation => {
			return commit(payload.id, payload.data) as IAutomation;
		};

		// Numbered also for an id that is not held: a read of it may be on its way
		const unset = (payload: IAutomationsUnsetActionPayload): void => {
			data.value.delete(payload.id);

			changedAt.set(payload.id, ++sequence);
		};

		// The module was reset: every automation is gone, held or not
		const unsetAll = (): void => {
			data.value.clear();

			allRemovedAt = ++sequence;
		};

		// For a response saying the automation is gone
		const unsetUnlessOvertaken = (id: IAutomation['id'], startedAt: number): void => {
			if (!overtaken(id, startedAt)) {
				unset({ id });
			}
		};

		const get = (payload: IAutomationsGetActionPayload): Promise<IAutomation> => read(payload.id);

		const read = async (id: IAutomation['id'], fresh: boolean = false): Promise<IAutomation> => {
			const existingPromise = pendingGetPromises[id];

			if (existingPromise && fresh) {
				await existingPromise.catch((): void => {});

				// Whatever is on its way by now was started after the one waited for
				return read(id);
			}

			if (existingPromise) {
				return existingPromise;
			}

			const getPromise = (async (): Promise<IAutomation> => {
				const startedAt = sequence;

				semaphore.value.fetching.item.push(id);

				try {
					const {
						data: responseData,
						error,
						response,
					} = await backend.client.GET(`/${MODULES_PREFIX}/${AUTOMATIONS_MODULE_PREFIX}/automations/{id}`, {
						params: { path: { id } },
					});

					if (typeof responseData !== 'undefined') {
						const transformed = transformAutomationResponse(responseData.data, AutomationSchema);

						const automation = commit(transformed.id, transformed, startedAt);

						if (automation === null) {
							throw new AutomationsApiException('Automation was removed.', 404);
						}

						return automation;
					}

					// It is gone on the backend, so it must not stay on screen either
					if (response?.status === 404) {
						unsetUnlessOvertaken(id, startedAt);
					}

					let errorReason: string = 'Failed to get automation.';

					if (error) {
						errorReason = getErrorReason<AutomationsModuleGetAutomationOperation>(error, errorReason);
					}

					throw new AutomationsApiException(errorReason, response?.status ?? null);
				} catch (e) {
					throw toApiException(e, 'Failed to get automation.');
				} finally {
					semaphore.value.fetching.item = semaphore.value.fetching.item.filter((item) => item !== id);
				}
			})().finally((): void => {
				delete pendingGetPromises[id];
			});

			pendingGetPromises[id] = getPromise;

			return getPromise;
		};

		const fetch = (): Promise<IAutomation[]> => list();

		const list = async (fresh: boolean = false): Promise<IAutomation[]> => {
			const cacheKey = 'all';

			const existingPromise = pendingFetchPromises[cacheKey];

			if (existingPromise && fresh) {
				await existingPromise.catch((): void => {});

				return list();
			}

			if (existingPromise) {
				return existingPromise;
			}

			const fetchPromise = (async (): Promise<IAutomation[]> => {
				const startedAt = sequence;

				semaphore.value.fetching.items = true;

				try {
					const { data: responseData, error, response } = await backend.client.GET(`/${MODULES_PREFIX}/${AUTOMATIONS_MODULE_PREFIX}/automations`);

					if (typeof responseData === 'undefined') {
						let errorReason: string = 'Failed to fetch automations.';

						if (error) {
							errorReason = getErrorReason<AutomationsModuleGetAutomationsOperation>(error, errorReason);
						}

						throw new AutomationsApiException(errorReason, response?.status ?? null);
					}

					const automations: IAutomation[] = [];
					const fetched = new Set<IAutomation['id']>();

					for (const automationData of responseData.data) {
						const transformed = transformAutomationResponse(automationData, AutomationSchema);

						fetched.add(transformed.id);

						const automation = commit(transformed.id, transformed, startedAt);

						// Null: removed while the list was on its way, the snapshot is from before
						if (automation !== null) {
							automations.push(automation);
						}
					}

					// The response is the whole collection, so anything missing from it is gone.
					// Merging alone would keep a deleted automation on screen whenever its event was
					// missed - which is exactly the case after the browser has been asleep. What was written
					// while the list was on its way (created meanwhile above all) stays.
					for (const knownId of [...data.value.keys()]) {
						if (!fetched.has(knownId)) {
							unsetUnlessOvertaken(knownId, startedAt);
						}
					}

					firstLoad.value = true;

					return automations;
				} catch (e) {
					throw toApiException(e, 'Failed to fetch automations.');
				} finally {
					semaphore.value.fetching.items = false;
				}
			})().finally((): void => {
				delete pendingFetchPromises[cacheKey];
			});

			pendingFetchPromises[cacheKey] = fetchPromise;

			return fetchPromise;
		};

		/**
		 * Tells apart the two refusals of a save a caller can act on: a graph the backend will not store
		 * and a revision that has moved. Everything else is a plain API failure.
		 */
		const createSaveException = (error: unknown, status: number | null, message: string): AutomationsApiException => {
			const envelope = error as ApiErrorEnvelope;

			const errorReason = error ? getErrorReason<SaveOperation>(envelope, message) : message;

			if (status === 409) {
				return new AutomationsRevisionConflictException(errorReason);
			}

			if (status === 422 && error && getErrorCode<SaveOperation>(envelope) === AUTOMATION_GRAPH_INVALID_ERROR_CODE) {
				return new AutomationsGraphInvalidException(errorReason, transformAutomationGraphIssues(lodashGet(error, 'error.details.issues', [])));
			}

			return new AutomationsApiException(errorReason, status);
		};

		const add = async (payload: IAutomationsAddActionPayload): Promise<IAutomation> => {
			const parsedPayload = AutomationsAddActionPayloadSchema.safeParse(payload);

			if (!parsedPayload.success) {
				logger.error('Schema validation failed with:', parsedPayload.error);

				throw new AutomationsValidationException('Failed to add automation.');
			}

			const { id, data: automationData } = parsedPayload.data;

			semaphore.value.creating.push(id);

			const startedAt = sequence;

			try {
				const createData = transformAutomationCreateRequest({ ...automationData, id });

				const {
					data: responseData,
					error,
					response,
				} = await backend.client.POST(`/${MODULES_PREFIX}/${AUTOMATIONS_MODULE_PREFIX}/automations`, {
					body: { data: createData },
				});

				if (typeof responseData === 'undefined') {
					throw createSaveException(error, response?.status ?? null, 'Failed to create automation.');
				}

				const transformed = transformAutomationResponse(responseData.data, AutomationSchema);

				// Removed again before the answer got here: it was created, it just is not held
				return commit(transformed.id, transformed, startedAt) ?? transformed;
			} catch (e) {
				throw toApiException(e, 'Failed to create automation.');
			} finally {
				semaphore.value.creating = semaphore.value.creating.filter((item) => item !== id);
			}
		};

		/**
		 * Updates an automation. Nothing is written to the store before the backend has accepted the change:
		 * the update is a compare-and-swap on the revision, so there is no optimistic state to roll back when
		 * it is refused. The revision compared is the one the change was based on: a caller that edits a
		 * copy passes the revision it copied, otherwise it is the revision held.
		 */
		const edit = async (payload: IAutomationsEditActionPayload): Promise<IAutomation> => {
			const parsedPayload = AutomationsEditActionPayloadSchema.safeParse(payload);

			if (!parsedPayload.success) {
				logger.error('Schema validation failed with:', parsedPayload.error);

				throw new AutomationsValidationException('Failed to edit automation.');
			}

			const { id, revision, data: automationData } = parsedPayload.data;

			const existingRecord = data.value.get(id);

			if (!existingRecord) {
				throw new AutomationsApiException('Automation not found.');
			}

			semaphore.value.updating.push(id);

			const startedAt = sequence;

			try {
				const updateData = transformAutomationUpdateRequest({ ...automationData, revision: revision ?? existingRecord.revision });

				const {
					data: responseData,
					error,
					response,
				} = await backend.client.PATCH(`/${MODULES_PREFIX}/${AUTOMATIONS_MODULE_PREFIX}/automations/{id}`, {
					params: { path: { id } },
					body: { data: updateData },
				});

				if (typeof responseData === 'undefined') {
					const exception = createSaveException(error, response?.status ?? null, 'Failed to update automation.');

					if (exception instanceof AutomationsRevisionConflictException) {
						// What is held is behind the backend. Read it again, so the next attempt is based on the
						// current revision; when even that fails the conflict is still what the caller hears about.
						// A read already on its way may be from before the other save, so it is not joined.
						await read(id, true).catch((): void => {});
					} else if (exception.code === 404) {
						unsetUnlessOvertaken(id, startedAt);
					}

					throw exception;
				}

				const transformed = transformAutomationResponse(responseData.data, AutomationSchema);

				// Removed before the answer got here: it was saved, it just is not held any more
				return commit(transformed.id, transformed, startedAt) ?? transformed;
			} catch (e) {
				throw toApiException(e, 'Failed to update automation.');
			} finally {
				semaphore.value.updating = semaphore.value.updating.filter((item) => item !== id);
			}
		};

		const remove = async (payload: IAutomationsRemoveActionPayload): Promise<void> => {
			if (!data.value.has(payload.id)) {
				return;
			}

			semaphore.value.deleting.push(payload.id);

			try {
				const { error, response } = await backend.client.DELETE(`/${MODULES_PREFIX}/${AUTOMATIONS_MODULE_PREFIX}/automations/{id}`, {
					params: { path: { id: payload.id } },
				});

				// Already gone on the backend is the outcome that was asked for
				if (typeof error !== 'undefined' && response?.status !== 404) {
					throw new AutomationsApiException(
						getErrorReason<AutomationsModuleDeleteAutomationOperation>(error, 'Failed to remove automation.'),
						response?.status ?? null
					);
				}

				unset({ id: payload.id });
			} catch (e) {
				throw toApiException(e, 'Failed to remove automation.');
			} finally {
				semaphore.value.deleting = semaphore.value.deleting.filter((item) => item !== payload.id);
			}
		};

		// Reconnect refresh contract: the store itself says whether it holds anything worth
		// re-reading, so the caller never has to guess from a flag it does not maintain.
		const isLoaded = (): boolean => firstLoadFinished() || findAll().length > 0;

		// Asked for because events were missed or everything was reset, so a list already on its way,
		// asked for before that, is not the answer
		const refresh = (): Promise<unknown> => list(true);

		// The module was reset. Whether the list is worth reading again has to be asked before the store
		// is emptied: afterwards it holds nothing, and a first list still on its way is discarded as older
		// than the reset, so nothing would ever read what was created since.
		const reset = (): Promise<unknown> => {
			const readAgain = isLoaded() || fetching();

			unsetAll();

			return readAgain ? refresh() : Promise.resolve();
		};

		return {
			isLoaded,
			refresh,
			data,
			semaphore,
			firstLoad,
			firstLoadFinished,
			getting,
			fetching,
			findAll,
			findById,
			findBySpace,
			onEvent,
			set,
			unset,
			unsetAll,
			reset,
			get,
			fetch,
			add,
			edit,
			remove,
		};
	}
);

export const registerAutomationsStore = (pinia: Pinia): Store<string, IAutomationsStoreState, object, IAutomationsStoreActions> => {
	return useAutomationsStore(pinia);
};
