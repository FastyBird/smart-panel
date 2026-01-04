import { computed, type ComputedRef, type Ref, ref } from 'vue';

import { storeToRefs } from 'pinia';

import { injectStoresManager } from '../../../common';
import type { IDevice } from '../../devices/store/devices.store.types';
import { devicesStoreKey } from '../../devices/store/keys';
import { isFloorZoneCategory, SpaceType } from '../spaces.constants';
import { spacesStoreKey } from '../store';

interface IUseSpaceDevices {
	devices: ComputedRef<IDevice[]>;
	loading: ComputedRef<boolean>;
	firstLoadFinished: ComputedRef<boolean>;
	fetchDevices: () => Promise<void>;
	addDevice: (deviceId: string) => Promise<void>;
	removeDevice: (deviceId: string) => Promise<void>;
	reassignDevice: (deviceId: string, targetSpaceId: string | null) => Promise<void>;
}

export const useSpaceDevices = (
	spaceId: Ref<string | undefined>,
	spaceType: Ref<SpaceType | undefined>
): IUseSpaceDevices => {
	const storesManager = injectStoresManager();
	const devicesStore = storesManager.getStore(devicesStoreKey);
	const spacesStore = storesManager.getStore(spacesStoreKey);

	const { semaphore, firstLoad } = storeToRefs(devicesStore);

	const isOperating = ref<boolean>(false);

	const devices = computed<IDevice[]>(() => {
		if (!spaceId.value || !spaceType.value) return [];

		const allDevices = devicesStore.findAll().filter((device) => !device.draft);

		let filtered: IDevice[];
		if (spaceType.value === SpaceType.ROOM) {
			// For rooms: filter devices where roomId matches
			filtered = allDevices.filter((device) => device.roomId === spaceId.value);
		} else {
			// For zones: filter devices where zoneIds includes this zone
			filtered = allDevices.filter((device) => device.zoneIds.includes(spaceId.value!));
		}

		// Sort alphabetically by name
		return filtered.sort((a, b) => a.name.localeCompare(b.name));
	});

	const loading = computed<boolean>(() => {
		if (isOperating.value) return true;
		if (semaphore.value.fetching.items) return true;
		if (!firstLoad.value) return true;
		return false;
	});

	const firstLoadFinished = computed<boolean>(() => firstLoad.value);

	const fetchDevices = async (): Promise<void> => {
		// Fetch all devices - zoneIds are now included in the device response
		await devicesStore.fetch();
	};

	const addDevice = async (deviceId: string): Promise<void> => {
		if (!spaceId.value || !spaceType.value) {
			throw new Error('Space ID and type are required');
		}

		isOperating.value = true;

		try {
			if (spaceType.value === SpaceType.ROOM) {
				// For rooms: update device's roomId
				const device = devicesStore.findById(deviceId);
				if (!device) {
					throw new Error('Device not found');
				}

				await devicesStore.edit({
					id: deviceId,
					data: {
						type: device.type,
						roomId: spaceId.value,
					},
				});
			} else {
				// For zones: check if it's a floor zone (not allowed)
				const space = spacesStore.findById(spaceId.value);
				if (space && isFloorZoneCategory(space.category)) {
					throw new Error('Cannot assign devices to floor zones. Floor membership is derived from room assignment.');
				}

				// Add device to zone using the store method
				await devicesStore.addZone({
					id: deviceId,
					zoneId: spaceId.value,
				});
			}
		} finally {
			isOperating.value = false;
		}
	};

	const removeDevice = async (deviceId: string): Promise<void> => {
		if (!spaceId.value || !spaceType.value) {
			throw new Error('Space ID and type are required');
		}

		isOperating.value = true;

		try {
			if (spaceType.value === SpaceType.ROOM) {
				// For rooms: set device's roomId to null
				const device = devicesStore.findById(deviceId);
				if (!device) {
					throw new Error('Device not found');
				}

				await devicesStore.edit({
					id: deviceId,
					data: {
						type: device.type,
						roomId: null,
					},
				});
			} else {
				// Remove device from zone using the store method
				await devicesStore.removeZone({
					id: deviceId,
					zoneId: spaceId.value,
				});
			}
		} finally {
			isOperating.value = false;
		}
	};

	const reassignDevice = async (deviceId: string, targetSpaceId: string | null): Promise<void> => {
		isOperating.value = true;

		try {
			const device = devicesStore.findById(deviceId);
			if (!device) {
				throw new Error('Device not found');
			}

			// Reassign always updates roomId (devices can only be owned by rooms)
			await devicesStore.edit({
				id: deviceId,
				data: {
					type: device.type,
					roomId: targetSpaceId,
				},
			});
		} finally {
			isOperating.value = false;
		}
	};

	return {
		devices,
		loading,
		firstLoadFinished,
		fetchDevices,
		addDevice,
		removeDevice,
		reassignDevice,
	};
};
