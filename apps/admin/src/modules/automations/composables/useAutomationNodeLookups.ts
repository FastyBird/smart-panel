import { type ComputedRef, computed, ref, watch } from 'vue';

import { injectStoresManager } from '../../../common';
import { channelsPropertiesStoreKey, channelsStoreKey, devicesStoreKey } from '../../devices/store/keys';
import { scenesStoreKey } from '../../scenes/store/keys';
import { automationsStoreKey } from '../store/keys';

import type { IUseAutomationNodeLookups } from './types';

interface ICollectionStore {
	firstLoadFinished: () => boolean;
	fetching: () => boolean;
	fetch: () => Promise<unknown>;
}

interface ICollectionRead {
	fetching: ComputedRef<boolean>;
	loadFailed: ComputedRef<boolean>;
	ensure: () => Promise<void>;
	retry: () => Promise<void>;
}

/*
 * A collection read once for the whole admin, possibly by another part of it (the summaries of the canvas,
 * the device picker), whose store keeps no error. It has failed when a read of it has ended since the lookups
 * were set up and it is still not loaded. The failure is said until the collection is loaded, by anyone, so
 * a read under way after it (a retry) shows as loading beside it.
 */
const collectionRead = (store: ICollectionStore): ICollectionRead => {
	const failed = ref<boolean>(false);

	const fetching = computed<boolean>((): boolean => store.fetching());

	const loadFailed = computed<boolean>((): boolean => failed.value && !store.firstLoadFinished());

	const settle = (): void => {
		failed.value = !store.firstLoadFinished();
	};

	watch(fetching, (now: boolean, before: boolean): void => {
		if (before && !now) settle();
	});

	const read = async (): Promise<void> => {
		try {
			await store.fetch();
		} catch {
			// Shown through `loadFailed`, where the forms offer to read again
		} finally {
			settle();
		}
	};

	const ensure = async (): Promise<void> => {
		if (store.firstLoadFinished() || store.fetching()) {
			return;
		}

		await read();
	};

	const retry = async (): Promise<void> => {
		if (store.fetching()) {
			return;
		}

		await read();
	};

	return { fetching, loadFailed, ensure, retry };
};

/**
 * What the cards need to know of the devices, channels, properties, scenes and automations they name, read from the
 * stores of the devices and scenes modules. A device is read with its channels and properties, so reading
 * the devices once is enough for every device card of a canvas.
 */
export const useAutomationNodeLookups = (): IUseAutomationNodeLookups => {
	const storesManager = injectStoresManager();

	const devicesStore = storesManager.getStore(devicesStoreKey);
	const channelsStore = storesManager.getStore(channelsStoreKey);
	const propertiesStore = storesManager.getStore(channelsPropertiesStoreKey);
	const scenesStore = storesManager.getStore(scenesStoreKey);
	const automationsStore = storesManager.getStore(automationsStoreKey);

	const device: IUseAutomationNodeLookups['device'] = (id) => devicesStore.findById(id);

	const channel: IUseAutomationNodeLookups['channel'] = (id) => channelsStore.findById(id);

	const property: IUseAutomationNodeLookups['property'] = (id) => propertiesStore.findById(id);

	const scene: IUseAutomationNodeLookups['scene'] = (id) => scenesStore.findById(id);

	const automation: IUseAutomationNodeLookups['automation'] = (id) => automationsStore.findById(id);

	// Every card of a canvas asks; the stores share one request between them. A failed read leaves the
	// names unknown in the summaries, and is said in the pickers of the forms, with a way to read again
	const devicesRead = collectionRead({
		firstLoadFinished: (): boolean => devicesStore.firstLoadFinished(),
		fetching: (): boolean => devicesStore.fetching(),
		fetch: () => devicesStore.fetch(),
	});

	const scenesRead = collectionRead({
		firstLoadFinished: (): boolean => scenesStore.firstLoadFinished(),
		fetching: (): boolean => scenesStore.fetching(),
		fetch: () => scenesStore.fetch(),
	});

	const automationsRead = collectionRead({
		firstLoadFinished: (): boolean => automationsStore.firstLoadFinished(),
		fetching: (): boolean => automationsStore.fetching(),
		fetch: () => automationsStore.fetch(),
	});

	return {
		device,
		channel,
		property,
		scene,
		automation,
		ensureDevices: devicesRead.ensure,
		ensureScenes: scenesRead.ensure,
		ensureAutomations: automationsRead.ensure,
		devicesLoadFailed: devicesRead.loadFailed,
		scenesLoadFailed: scenesRead.loadFailed,
		automationsLoadFailed: automationsRead.loadFailed,
		fetchingDevices: devicesRead.fetching,
		fetchingScenes: scenesRead.fetching,
		fetchingAutomations: automationsRead.fetching,
		retryDevices: devicesRead.retry,
		retryScenes: scenesRead.retry,
		retryAutomations: automationsRead.retry,
	};
};
