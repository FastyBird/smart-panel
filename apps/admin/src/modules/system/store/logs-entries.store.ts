import { ref } from 'vue';

import { type Pinia, type Store, defineStore } from 'pinia';

import { z } from 'zod';

import { getErrorReason, useBackend, useLogger } from '../../../common';
import type { operations } from '../../../openapi.constants';
import { SYSTEM_MODULE_PREFIX } from '../system.constants';
import { SystemApiException, SystemValidationException } from '../system.exceptions';

import { LogEntrySchema, LogsEntriesAddActionPayloadSchema } from './logs-entries.store.schemas';
import type {
	IAddLogEntry,
	ILogEntry,
	ILogEntryRes,
	ILogsEntriesAddActionPayload,
	ILogsEntriesFetchActionPayload,
	ILogsEntriesOnEventActionPayload,
	ILogsEntriesSetActionPayload,
	ILogsEntriesStateSemaphore,
	ILogsEntriesStoreActions,
	ILogsEntriesStoreState,
	ILogsEntriesUnsetActionPayload,
	LogsEntriesStoreSetup,
} from './logs-entries.store.types';
import { transformLogEntryCreateRequest, transformLogEntryResponse } from './logs-entries.transformers';

const defaultSemaphore: ILogsEntriesStateSemaphore = {
	fetching: {
		items: false,
	},
	creating: [],
	deleting: [],
};

export const useLogsEntries = defineStore<'system_module-logs', LogsEntriesStoreSetup>('system_module-logs', (): LogsEntriesStoreSetup => {
	const backend = useBackend();
	const logger = useLogger();

	const semaphore = ref<ILogsEntriesStateSemaphore>(defaultSemaphore);

	const firstLoad = ref<boolean>(false);

	const nextCursor = ref<string | undefined>(undefined);
	const hasMore = ref<boolean>(false);

	const data = ref<{ [key: ILogEntry['id']]: ILogEntry }>({});

	const firstLoadFinished = (): boolean => firstLoad.value;

	const fetching = (): boolean => semaphore.value.fetching.items;

	const findAll = (): ILogEntry[] => Object.values(data.value);

	const findById = (id: ILogEntry['id']): ILogEntry | null => (id in data.value ? data.value[id] : null);

	const pendingFetchPromises: Record<string, Promise<ILogEntry[]>> = {};

	const onEvent = (payload: ILogsEntriesOnEventActionPayload): ILogEntry => {
		return set({
			id: payload.id,
			data: transformLogEntryResponse(payload.data as unknown as ILogEntryRes),
		});
	};

	const set = (payload: ILogsEntriesSetActionPayload): ILogEntry => {
		if (payload.id && data.value && payload.id in data.value) {
			const parsed = LogEntrySchema.safeParse({ ...data.value[payload.id], ...payload.data });

			if (!parsed.success) {
				logger.error('Schema validation failed with:', parsed.error);

				throw new SystemValidationException('Failed to insert log entry.');
			}

			return (data.value[parsed.data.id] = parsed.data);
		}

		const parsed = LogEntrySchema.safeParse({ ...payload.data, id: payload.id });

		if (!parsed.success) {
			logger.error('Schema validation failed with:', parsed.error);

			throw new SystemValidationException('Failed to insert log entry.');
		}

		data.value = data.value ?? {};

		return (data.value[parsed.data.id] = parsed.data);
	};

	const unset = (payload: ILogsEntriesUnsetActionPayload): void => {
		if (!data.value) {
			return;
		}

		delete data.value[payload.id];

		return;
	};

	const fetch = async (payload?: ILogsEntriesFetchActionPayload): Promise<ILogEntry[]> => {
		if ((payload?.afterId ? payload.afterId : 'first') in pendingFetchPromises) {
			return pendingFetchPromises[payload?.afterId ? payload.afterId : 'first'];
		}

		const fetchPromise = (async (): Promise<ILogEntry[]> => {
			if (semaphore.value.fetching.items) {
				throw new SystemApiException('Already fetching logs entries.');
			}

			semaphore.value.fetching.items = true;

			try {
				const {
					data: responseData,
					error,
					response,
				} = await backend.client.GET(`/${SYSTEM_MODULE_PREFIX}/logs`, {
					params: {
						query: {
							after_id: payload?.afterId,
							limit: payload?.limit,
						},
					},
				});

				if (typeof responseData !== 'undefined') {
					const transformed = Object.fromEntries(
						responseData.data.map((logEntry) => {
							const transformedLogEntry = transformLogEntryResponse(logEntry);

							return [transformedLogEntry.id, transformedLogEntry];
						})
					);

					data.value = payload?.append ? { ...data.value, ...transformed } : transformed;

					firstLoad.value = true;

					hasMore.value = responseData.metadata.has_more;
					nextCursor.value = responseData.metadata.next_cursor;

					return Object.values(data.value);
				}

				let errorReason: string | null = 'Failed to fetch logs entries.';

				if (error) {
					errorReason = getErrorReason<operations['get-system-module-logs']>(error, errorReason);
				}

				throw new SystemApiException(errorReason, response.status);
			} finally {
				semaphore.value.fetching.items = false;
			}
		})();

		pendingFetchPromises[payload?.afterId ? payload.afterId : 'first'] = fetchPromise;

		try {
			return await fetchPromise;
		} finally {
			delete pendingFetchPromises[payload?.afterId ? payload.afterId : 'first'];
		}
	};

	const add = async (payload: ILogsEntriesAddActionPayload): Promise<{ failed?: { entry: IAddLogEntry; reason: string }[] }> => {
		const parsedPayload = LogsEntriesAddActionPayloadSchema.safeParse(payload);

		if (!parsedPayload.success) {
			logger.error('Schema validation failed with:', parsedPayload.error);

			throw new SystemValidationException('Failed to add logs entries.');
		}

		const parsedNewLogsEntries = z.array(LogEntrySchema).safeParse(parsedPayload.data.data);

		if (!parsedNewLogsEntries.success) {
			logger.error('Schema validation failed with:', parsedNewLogsEntries.error);

			throw new SystemValidationException('Failed to add logs entries.');
		}

		const {
			data: responseData,
			error,
			response,
		} = await backend.client.POST(`/${SYSTEM_MODULE_PREFIX}/logs`, {
			body: {
				data: transformLogEntryCreateRequest(parsedNewLogsEntries.data),
			},
		});

		if (typeof responseData !== 'undefined') {
			const failed = [];

			if (responseData.data.rejected > 0) {
				(responseData.data.errors || []).forEach((error) => {
					failed.push({
						entry: parsedNewLogsEntries.data[error.index],
						reason: error.reason,
					});
				});
			}

			return {};
		}

		let errorReason: string | null = 'Failed to create log entry.';

		if (error) {
			errorReason = getErrorReason<operations['create-system-module-logs']>(error, errorReason);
		}

		throw new SystemApiException(errorReason, response.status);
	};

	return {
		semaphore,
		firstLoad,
		hasMore,
		nextCursor,
		data,
		firstLoadFinished,
		fetching,
		findAll,
		findById,
		onEvent,
		set,
		unset,
		fetch,
		add,
	};
});

export const registerLogsEntriesStore = (pinia: Pinia): Store<string, ILogsEntriesStoreState, object, ILogsEntriesStoreActions> => {
	return useLogsEntries(pinia);
};
