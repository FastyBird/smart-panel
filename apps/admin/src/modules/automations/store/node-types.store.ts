import { ref } from 'vue';

import { type Pinia, type Store, defineStore } from 'pinia';

import { MODULES_PREFIX } from '../../../app.constants';
import { getErrorReason, useBackend } from '../../../common';
import type { AutomationsModuleGetNodeTypesOperation } from '../../../openapi.constants';
import { AUTOMATIONS_MODULE_PREFIX } from '../automations.constants';
import { AutomationsApiException, AutomationsException } from '../automations.exceptions';

import type {
	IAutomationNodeType,
	IAutomationNodeTypesStateSemaphore,
	IAutomationNodeTypesStoreActions,
	IAutomationNodeTypesStoreState,
} from './node-types.store.types';
import { transformAutomationNodeTypeResponse } from './node-types.transformers';

export type AutomationNodeTypesStoreSetup = IAutomationNodeTypesStoreState & IAutomationNodeTypesStoreActions;

/**
 * The catalogue of cards an automation can be built from, as the backend and its plugins register them.
 * It is read as a whole and never changed from here.
 */
export const useAutomationNodeTypesStore = defineStore<'automations_module-node_types', AutomationNodeTypesStoreSetup>(
	'automations_module-node_types',
	(): AutomationNodeTypesStoreSetup => {
		const backend = useBackend();

		const semaphore = ref<IAutomationNodeTypesStateSemaphore>({ fetching: false });

		const firstLoad = ref<boolean>(false);

		const data = ref<Map<IAutomationNodeType['type'], IAutomationNodeType>>(new Map());

		const firstLoadFinished = (): boolean => firstLoad.value;

		const fetching = (): boolean => semaphore.value.fetching;

		const findAll = (): IAutomationNodeType[] => Array.from(data.value.values());

		const findByType = (type: IAutomationNodeType['type']): IAutomationNodeType | null => data.value.get(type) ?? null;

		let pendingFetchPromise: Promise<IAutomationNodeType[]> | null = null;

		const fetch = (): Promise<IAutomationNodeType[]> => read();

		// `fresh`: asked for because something may have changed since a read already on its way was started
		// (a reconnect), so that read is not the answer - it is waited for and the catalogue read again
		const read = async (fresh: boolean = false): Promise<IAutomationNodeType[]> => {
			if (pendingFetchPromise && fresh) {
				await pendingFetchPromise.catch((): void => {});

				return read();
			}

			if (pendingFetchPromise) {
				return pendingFetchPromise;
			}

			const fetchPromise = (async (): Promise<IAutomationNodeType[]> => {
				semaphore.value.fetching = true;

				try {
					const { data: responseData, error, response } = await backend.client.GET(`/${MODULES_PREFIX}/${AUTOMATIONS_MODULE_PREFIX}/node-types`);

					if (typeof responseData === 'undefined') {
						let errorReason: string = 'Failed to fetch automation node types.';

						if (error) {
							errorReason = getErrorReason<AutomationsModuleGetNodeTypesOperation>(error, errorReason);
						}

						throw new AutomationsApiException(errorReason, response?.status ?? null);
					}

					// The response is the whole catalogue: a card of a plugin that is gone must not stay offered
					const nodeTypes = new Map<IAutomationNodeType['type'], IAutomationNodeType>();

					for (const nodeTypeData of responseData.data) {
						const transformed = transformAutomationNodeTypeResponse(nodeTypeData);

						nodeTypes.set(transformed.type, transformed);
					}

					data.value = nodeTypes;

					firstLoad.value = true;

					return Array.from(nodeTypes.values());
				} catch (e) {
					throw e instanceof AutomationsException ? e : new AutomationsApiException('Failed to fetch automation node types.', null, e as Error);
				} finally {
					semaphore.value.fetching = false;
				}
			})().finally((): void => {
				// Let go of before anyone waiting for it goes on, so a fresh read never joins it again
				pendingFetchPromise = null;
			});

			pendingFetchPromise = fetchPromise;

			return fetchPromise;
		};

		// Reconnect refresh contract: a first read still on its way counts, its answer may be from before the gap
		const isLoaded = (): boolean => firstLoadFinished() || fetching();

		const refresh = (): Promise<unknown> => read(true);

		return {
			isLoaded,
			refresh,
			data,
			semaphore,
			firstLoad,
			firstLoadFinished,
			fetching,
			findAll,
			findByType,
			fetch,
		};
	}
);

export const registerAutomationNodeTypesStore = (
	pinia: Pinia
): Store<string, IAutomationNodeTypesStoreState, object, IAutomationNodeTypesStoreActions> => {
	return useAutomationNodeTypesStore(pinia);
};
