import { injectStoresManager } from '../../../common';
import { channelsPropertiesStoreKey, channelsStoreKey, devicesStoreKey } from '../../devices/store/keys';
import { scenesStoreKey } from '../../scenes/store/keys';
import { automationsStoreKey } from '../store/keys';

import type { IUseAutomationNodeLookups } from './types';

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

	// Every card of a canvas asks; the stores share one request between them, and a failed read only
	// leaves the names unknown
	const ensureDevices = async (): Promise<void> => {
		if (devicesStore.firstLoadFinished() || devicesStore.fetching()) {
			return;
		}

		try {
			await devicesStore.fetch();
		} catch {
			// The summaries say "unknown device" and the picker tries again
		}
	};

	const ensureScenes = async (): Promise<void> => {
		if (scenesStore.firstLoadFinished() || scenesStore.fetching()) {
			return;
		}

		try {
			await scenesStore.fetch();
		} catch {
			// The summaries say "unknown scene" and the scene picker tries again
		}
	};

	const ensureAutomations = async (): Promise<void> => {
		if (automationsStore.firstLoadFinished() || automationsStore.fetching()) {
			return;
		}

		try {
			await automationsStore.fetch();
		} catch {
			// The summaries say "unknown automation" and the automation picker tries again
		}
	};

	return {
		device,
		channel,
		property,
		scene,
		automation,
		ensureDevices,
		ensureScenes,
		ensureAutomations,
	};
};
