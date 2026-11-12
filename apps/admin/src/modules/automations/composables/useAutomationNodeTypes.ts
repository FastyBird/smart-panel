import { computed } from 'vue';

import { storeToRefs } from 'pinia';

import { injectStoresManager } from '../../../common';
import { automationNodeTypesStoreKey } from '../store/keys';
import type { IAutomationNodeType } from '../store/node-types.store.types';

import type { IUseAutomationNodeTypes } from './types';

/**
 * The catalogue of cards the backend offers (`GET /node-types`): what the palette is built from and what
 * tells the canvas the kind and the ports of a node.
 */
export const useAutomationNodeTypes = (): IUseAutomationNodeTypes => {
	const storesManager = injectStoresManager();

	const nodeTypesStore = storesManager.getStore(automationNodeTypesStoreKey);

	const { data, semaphore, firstLoad } = storeToRefs(nodeTypesStore);

	const nodeTypes = computed<IAutomationNodeType[]>((): IAutomationNodeType[] => Array.from(data.value.values()));

	const areLoading = computed<boolean>((): boolean => semaphore.value.fetching);

	const loaded = computed<boolean>((): boolean => firstLoad.value);

	const fetchNodeTypes = async (): Promise<void> => {
		await nodeTypesStore.fetch();
	};

	const getNodeType = (type: IAutomationNodeType['type']): IAutomationNodeType | null => data.value.get(type) ?? null;

	return {
		nodeTypes,
		areLoading,
		loaded,
		fetchNodeTypes,
		getNodeType,
	};
};
