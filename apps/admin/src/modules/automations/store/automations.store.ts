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

		// What was written or removed while the list was being read (null when it is not). The list is a
		// snapshot of the moment the backend answered, so it must not undo what happened here since.
		let changedWhileFetching: Map<IAutomation['id'], 'set' | 'unset'> | null = null;

		const onEvent = (payload: IAutomationsOnEventActionPayload): IAutomation => {
			return set({
				id: payload.id,
				data: transformAutomationResponse(payload.data, AutomationSchema),
			});
		};

		const set = (payload: IAutomationsSetActionPayload): IAutomation => {
			const existingRecord = data.value.get(payload.id);

			// Responses and events race each other: the answer to a read may arrive after the event of a
			// later save, and the answer to our own save after the event announcing it. The revision moves
			// with every save, so whatever is older than what is held must not overwrite it. Writes of the
			// engine (status, last run) keep the revision and are let through.
			if (existingRecord && typeof payload.data.revision === 'number' && payload.data.revision < existingRecord.revision) {
				return existingRecord;
			}

			const candidate: Record<string, unknown> = existingRecord ? { ...existingRecord, ...payload.data } : { ...payload.data, id: payload.id };

			// The list comes without graphs. A graph read earlier stays for as long as it is the graph of the
			// revision held; once the revision has moved it is stale and has to be read again.
			if (existingRecord && existingRecord.graph !== null && (payload.data.graph === null || typeof payload.data.graph === 'undefined')) {
				candidate.graph = candidate.revision === existingRecord.revision ? existingRecord.graph : null;
			}

			const parsed = AutomationSchema.safeParse(candidate);

			if (!parsed.success) {
				logger.error('Schema validation failed with:', parsed.error);

				throw new AutomationsValidationException('Failed to insert automation.');
			}

			data.value.set(parsed.data.id, parsed.data);

			changedWhileFetching?.set(parsed.data.id, 'set');

			return parsed.data;
		};

		const unset = (payload: IAutomationsUnsetActionPayload): void => {
			data.value.delete(payload.id);

			changedWhileFetching?.set(payload.id, 'unset');
		};

		const get = async (payload: IAutomationsGetActionPayload): Promise<IAutomation> => {
			const existingPromise = pendingGetPromises[payload.id];

			if (existingPromise) {
				return existingPromise;
			}

			const getPromise = (async (): Promise<IAutomation> => {
				semaphore.value.fetching.item.push(payload.id);

				try {
					const {
						data: responseData,
						error,
						response,
					} = await backend.client.GET(`/${MODULES_PREFIX}/${AUTOMATIONS_MODULE_PREFIX}/automations/{id}`, {
						params: { path: { id: payload.id } },
					});

					if (typeof responseData !== 'undefined') {
						const transformed = transformAutomationResponse(responseData.data, AutomationSchema);

						return set({
							id: transformed.id,
							data: transformed,
						});
					}

					// It is gone on the backend, so it must not stay on screen either
					if (response?.status === 404) {
						unset({ id: payload.id });
					}

					let errorReason: string = 'Failed to get automation.';

					if (error) {
						errorReason = getErrorReason<AutomationsModuleGetAutomationOperation>(error, errorReason);
					}

					throw new AutomationsApiException(errorReason, response?.status ?? null);
				} catch (e) {
					throw toApiException(e, 'Failed to get automation.');
				} finally {
					semaphore.value.fetching.item = semaphore.value.fetching.item.filter((id) => id !== payload.id);
				}
			})();

			pendingGetPromises[payload.id] = getPromise;

			try {
				return await getPromise;
			} finally {
				delete pendingGetPromises[payload.id];
			}
		};

		const fetch = async (): Promise<IAutomation[]> => {
			const cacheKey = 'all';

			const existingPromise = pendingFetchPromises[cacheKey];

			if (existingPromise) {
				return existingPromise;
			}

			const fetchPromise = (async (): Promise<IAutomation[]> => {
				semaphore.value.fetching.items = true;

				const changedMeanwhile = new Map<IAutomation['id'], 'set' | 'unset'>();

				changedWhileFetching = changedMeanwhile;

				try {
					const { data: responseData, error, response } = await backend.client.GET(`/${MODULES_PREFIX}/${AUTOMATIONS_MODULE_PREFIX}/automations`);

					// Only what happened while the request was on its way is of interest
					changedWhileFetching = null;

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

						// Removed while the list was on its way: the snapshot is from before
						if (changedMeanwhile.get(transformed.id) === 'unset') {
							continue;
						}

						automations.push(
							set({
								id: transformed.id,
								data: transformed,
							})
						);
					}

					// The response is the whole collection, so anything missing from it is gone.
					// Merging alone would keep a deleted automation on screen whenever its event was
					// missed - which is exactly the case after the browser has been asleep. What was created
					// while the list was on its way is not in it either and stays.
					for (const knownId of [...data.value.keys()]) {
						if (!fetched.has(knownId) && !changedMeanwhile.has(knownId)) {
							data.value.delete(knownId);
						}
					}

					firstLoad.value = true;

					return automations;
				} catch (e) {
					throw toApiException(e, 'Failed to fetch automations.');
				} finally {
					changedWhileFetching = null;

					semaphore.value.fetching.items = false;
				}
			})();

			pendingFetchPromises[cacheKey] = fetchPromise;

			try {
				return await fetchPromise;
			} finally {
				delete pendingFetchPromises[cacheKey];
			}
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

				return set({
					id: transformed.id,
					data: transformed,
				});
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
						await get({ id }).catch((): void => {});
					} else if (exception.code === 404) {
						unset({ id });
					}

					throw exception;
				}

				const transformed = transformAutomationResponse(responseData.data, AutomationSchema);

				return set({
					id: transformed.id,
					data: transformed,
				});
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

		const refresh = (): Promise<unknown> => fetch();

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
