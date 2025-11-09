import { ref } from 'vue';

import { type Pinia, type Store, defineStore } from 'pinia';

import { getErrorReason, useBackend, useLogger } from '../../../common';
import type { operations } from '../../../openapi';
import { SYSTEM_MODULE_PREFIX } from '../system.constants';
import { SystemApiException, SystemValidationException } from '../system.exceptions';

import { SystemInfoSchema } from './system-info.store.schemas';
import type {
	ISystemInfo,
	ISystemInfoOnEventActionPayload,
	ISystemInfoRes,
	ISystemInfoSetActionPayload,
	ISystemInfoStateSemaphore,
	ISystemInfoStoreActions,
	ISystemInfoStoreState,
	SystemInfoStoreSetup,
} from './system-info.store.types';
import { transformSystemInfoResponse } from './system-info.transformers';

const defaultSemaphore: ISystemInfoStateSemaphore = {
	getting: false,
};

export const useSystemInfo = defineStore<'system_module-system_info', SystemInfoStoreSetup>('system_module-system_info', (): SystemInfoStoreSetup => {
	const backend = useBackend();
	const logger = useLogger();

	const semaphore = ref<ISystemInfoStateSemaphore>(defaultSemaphore);

	const firstLoad = ref<boolean>(false);

	const data = ref<ISystemInfo | null>(null);

	const firstLoadFinished = (): boolean => firstLoad.value;

	const getting = (): boolean => semaphore.value.getting;

	let pendingGetPromises: Promise<ISystemInfo> | null = null;

	const onEvent = (payload: ISystemInfoOnEventActionPayload): ISystemInfo => {
		return set({
			data: transformSystemInfoResponse(payload.data as unknown as ISystemInfoRes),
		});
	};

	const set = (payload: ISystemInfoSetActionPayload): ISystemInfo => {
		const parsedSystemInfo = SystemInfoSchema.safeParse(payload.data);

		if (!parsedSystemInfo.success) {
			logger.error('Schema validation failed with:', parsedSystemInfo.error);

			throw new SystemValidationException('Failed to insert system info.');
		}

		data.value = data.value ?? null;

		return (data.value = parsedSystemInfo.data);
	};

	const get = async (): Promise<ISystemInfo> => {
		if (pendingGetPromises) {
			return pendingGetPromises;
		}

		const fetchPromise = (async (): Promise<ISystemInfo> => {
			if (semaphore.value.getting) {
				throw new SystemApiException('Already getting system info.');
			}

			semaphore.value.getting = true;

			const apiResponse = await backend.client.GET(`/${SYSTEM_MODULE_PREFIX}/system/info`);

			try {
				const { data: responseData, error, response } = apiResponse;

				if (typeof responseData !== 'undefined') {
					data.value = transformSystemInfoResponse(responseData.data);

					return data.value;
				}

				let errorReason: string | null = 'Failed to fetch system info.';

				if (error) {
					errorReason = getErrorReason<operations['get-system-module-system-info']>(error, errorReason);
				}

				throw new SystemApiException(errorReason, response.status);
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

export const registerSystemInfoStore = (pinia: Pinia): Store<string, ISystemInfoStoreState, object, ISystemInfoStoreActions> => {
	return useSystemInfo(pinia);
};
