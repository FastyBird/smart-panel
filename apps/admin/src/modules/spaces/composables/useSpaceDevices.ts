import { computed, type ComputedRef, type Ref, ref } from 'vue';

import { storeToRefs } from 'pinia';

import { injectStoresManager } from '../../../common';
import type { IDevice } from '../../devices/store/devices.store.types';
import { devicesStoreKey } from '../../devices/store/keys';
import { SpaceType } from '../spaces.constants';

interface IUseSpaceDevices {
	devices: ComputedRef<IDevice[]>;
	loading: ComputedRef<boolean>;
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

	const { semaphore, firstLoad } = storeToRefs(devicesStore);

	const isOperating = ref<boolean>(false);

	const devices = computed<IDevice[]>(() => {
		if (!spaceId.value || !spaceType.value) return [];

		const allDevices = devicesStore.findAll().filter((device) => !device.draft);

		if (spaceType.value === SpaceType.ROOM) {
			// For rooms: filter devices where roomId matches
			return allDevices.filter((device) => device.roomId === spaceId.value);
		} else {
			// For zones: would need device-zone junction table query
			// Currently not implemented in admin app - return empty for now
			// TODO: Add zone device fetching when backend API integration is added
			return [];
		}
	});

	const loading = computed<boolean>(() => {
		if (isOperating.value) return true;
		if (semaphore.value.fetching.items) return true;
		if (!firstLoad.value) return true;
		return false;
	});

	const fetchDevices = async (): Promise<void> => {
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
				// For zones: would call POST /devices/{id}/zones/{zoneId}
				// TODO: Implement when backend API integration is added
				throw new Error('Zone device assignment not yet implemented');
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
				// For zones: would call DELETE /devices/{id}/zones/{zoneId}
				// TODO: Implement when backend API integration is added
				throw new Error('Zone device removal not yet implemented');
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
		fetchDevices,
		addDevice,
		removeDevice,
		reassignDevice,
	};
};
