import { ref } from 'vue';

import { type Pinia, type Store, defineStore } from 'pinia';

import { getErrorReason, useBackend } from '../../../common';
import type { operations } from '../../../openapi';
import { SYSTEM_MODULE_PREFIX } from '../system.constants';
import { SystemApiException, SystemValidationException } from '../system.exceptions';

import {
	type IThrottleStatus,
	type IThrottleStatusSetActionPayload,
	type IThrottleStatusStateSemaphore,
	type IThrottleStatusStoreActions,
	type IThrottleStatusStoreState,
	ThrottleStatusSchema,
	type ThrottleStatusStoreSetup,
} from './throttle-status.store.types';
import { transformThrottleStatusResponse } from './throttle-status.transformers';

const defaultSemaphore: IThrottleStatusStateSemaphore = {
	getting: false,
};

export const useThrottleStatus = defineStore<'system_module-throttle_status', ThrottleStatusStoreSetup>(
	'system_module-throttle_status',
	(): ThrottleStatusStoreSetup => {
		const backend = useBackend();

		const semaphore = ref<IThrottleStatusStateSemaphore>(defaultSemaphore);

		const firstLoad = ref<boolean>(false);

		const data = ref<IThrottleStatus | null>(null);

		const firstLoadFinished = (): boolean => firstLoad.value;

		const getting = (): boolean => semaphore.value.getting;

		let pendingGetPromises: Promise<IThrottleStatus> | null = null;

		const set = (payload: IThrottleStatusSetActionPayload): IThrottleStatus => {
			const parsedThrottleStatus = ThrottleStatusSchema.safeParse(payload.data);

			if (!parsedThrottleStatus.success) {
				throw new SystemValidationException('Failed to insert throttle status.');
			}

			data.value = data.value ?? null;

			return (data.value = parsedThrottleStatus.data);
		};

		const get = async (): Promise<IThrottleStatus> => {
			if (pendingGetPromises) {
				return pendingGetPromises;
			}

			const fetchPromise = (async (): Promise<IThrottleStatus> => {
				if (semaphore.value.getting) {
					throw new SystemApiException('Already getting throttle status.');
				}

				semaphore.value.getting = true;

				const apiResponse = await backend.client.GET(`/${SYSTEM_MODULE_PREFIX}/system/throttle`);

				const { data: responseData, error, response } = apiResponse;

				semaphore.value.getting = false;

				if (typeof responseData !== 'undefined') {
					data.value = transformThrottleStatusResponse(responseData.data);

					return data.value;
				}

				let errorReason: string | null = 'Failed to fetch throttle status.';

				if (error) {
					errorReason = getErrorReason<operations['get-system-module-system-throttle']>(error, errorReason);
				}

				throw new SystemApiException(errorReason, response.status);
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
			set,
			get,
		};
	}
);

export const registerThrottleStatusStore = (pinia: Pinia): Store<string, IThrottleStatusStoreState, object, IThrottleStatusStoreActions> => {
	return useThrottleStatus(pinia);
};
