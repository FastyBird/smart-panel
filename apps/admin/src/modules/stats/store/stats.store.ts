import { ref } from 'vue';

import { type Pinia, type Store, defineStore } from 'pinia';

import { getErrorReason, useBackend, useLogger } from '../../../common';
import type { operations } from '../../../openapi';
import { STATS_MODULE_PREFIX } from '../stats.constants';
import { StatsApiException, StatsValidationException } from '../stats.exceptions';

import { StatsSchema } from './stats.store.schemas';
import type {
	IStats,
	IStatsOnEventActionPayload,
	IStatsRes,
	IStatsSetActionPayload,
	IStatsStateSemaphore,
	IStatsStoreActions,
	IStatsStoreState,
	StatsStoreSetup,
} from './stats.store.types';
import { transformStatsResponse } from './stats.transformers';

const defaultSemaphore: IStatsStateSemaphore = {
	getting: false,
};

export const useStats = defineStore<'stats_module-stats', StatsStoreSetup>('stats_module-stats', (): StatsStoreSetup => {
	const backend = useBackend();
	const logger = useLogger();

	const semaphore = ref<IStatsStateSemaphore>(defaultSemaphore);

	const firstLoad = ref<boolean>(false);

	const data = ref<IStats | null>(null);

	const firstLoadFinished = (): boolean => firstLoad.value;

	const getting = (): boolean => semaphore.value.getting;

	let pendingGetPromises: Promise<IStats> | null = null;

	const onEvent = (payload: IStatsOnEventActionPayload): IStats => {
		return set({
			data: transformStatsResponse(payload.data as unknown as IStatsRes),
		});
	};

	const set = (payload: IStatsSetActionPayload): IStats => {
		const parsedStats = StatsSchema.safeParse(payload.data);

		if (!parsedStats.success) {
			logger.error('Schema validation failed with:', parsedStats.error);

			throw new StatsValidationException('Failed to insert stats.');
		}

		data.value = data.value ?? null;

		return (data.value = parsedStats.data);
	};

	const get = async (): Promise<IStats> => {
		if (pendingGetPromises) {
			return pendingGetPromises;
		}

		const fetchPromise = (async (): Promise<IStats> => {
			if (semaphore.value.getting) {
				throw new StatsApiException('Already getting stats.');
			}

			semaphore.value.getting = true;

			try {
				const apiResponse = await backend.client.GET(`/${STATS_MODULE_PREFIX}/stats`);

				const { data: responseData, error, response } = apiResponse;

				if (typeof responseData !== 'undefined') {
					data.value = transformStatsResponse(responseData.data);

					return data.value;
				}

				let errorReason: string | null = 'Failed to fetch stats.';

				if (error) {
					errorReason = getErrorReason<operations['get-stats-module-stats']>(error, errorReason);
				}

				throw new StatsApiException(errorReason, response.status);
			} finally {
				semaphore.value.getting = false;
			}
		})();

		pendingGetPromises = fetchPromise;

		try {
			return await fetchPromise;
		} finally {
			pendingGetPromises = null;
		}
	};

	return {
		semaphore,
		firstLoad,
		data,
		firstLoadFinished,
		getting,
		onEvent,
		set,
		get,
	};
});

export const registerStatsStore = (pinia: Pinia): Store<string, IStatsStoreState, object, IStatsStoreActions> => {
	return useStats(pinia);
};
