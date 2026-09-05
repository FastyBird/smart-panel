import { ref } from 'vue';

import { type Pinia, defineStore } from 'pinia';

import { PLUGINS_PREFIX } from '../../../app.constants';
import { getErrorReason, useBackend } from '../../../common';
import type {
	DevicesHomeKitPluginGetBridgeStatusOperation,
	DevicesHomeKitPluginGetCandidatesOperation,
	DevicesHomeKitPluginMapCandidatesOperation,
	DevicesHomeKitPluginResetPairingOperation,
} from '../../../openapi.constants';
import { DEVICES_HOMEKIT_PLUGIN_PREFIX, EventType } from '../devices-homekit.constants';
import { DevicesHomeKitApiException } from '../devices-homekit.exceptions';

import type { IHomeKitBridgeStatus, IHomeKitDeviceCandidate } from './homekit-bridge.store.types';
import { transformHomeKitBridgeStatus, transformHomeKitCandidates } from './homekit-bridge.transformers';

/**
 * Pinia store managing the Apple HomeKit bridge lifecycle, status, candidate devices, and pairings.
 *
 * Provides reactive status updates, real-time WebSocket event synchronization,
 * candidate device queries, mapping updates, and destructive pairing reset operations.
 */
export const useHomeKitBridge = defineStore('devices_homekit_plugin-bridge', () => {
	const backend = useBackend();
	const status = ref<IHomeKitBridgeStatus | null>(null);
	const candidates = ref<IHomeKitDeviceCandidate[]>([]);
	const fetchingStatus = ref(false);
	const fetchingCandidates = ref(false);
	const savingMapping = ref(false);
	const resettingPairing = ref(false);

	let statusSequence = 0;

	const fetchStatus = async (): Promise<IHomeKitBridgeStatus> => {
		fetchingStatus.value = true;
		const currentSequence = ++statusSequence;

		try {
			const { data, error, response } = await backend.client.GET(`/${PLUGINS_PREFIX}/${DEVICES_HOMEKIT_PLUGIN_PREFIX}/bridge/status`);

			if (data) {
				const transformed = transformHomeKitBridgeStatus(data.data);
				if (currentSequence === statusSequence) {
					status.value = transformed;
				}
				return status.value ?? transformed;
			}

			throw new DevicesHomeKitApiException(
				getErrorReason<DevicesHomeKitPluginGetBridgeStatusOperation>(error, 'Failed to load HomeKit Bridge status.'),
				response.status
			);
		} finally {
			fetchingStatus.value = false;
		}
	};

	const fetchCandidates = async (): Promise<IHomeKitDeviceCandidate[]> => {
		fetchingCandidates.value = true;

		try {
			const { data, error, response } = await backend.client.GET(`/${PLUGINS_PREFIX}/${DEVICES_HOMEKIT_PLUGIN_PREFIX}/bridge/candidates`);

			if (data) {
				return (candidates.value = transformHomeKitCandidates(data.data));
			}

			throw new DevicesHomeKitApiException(
				getErrorReason<DevicesHomeKitPluginGetCandidatesOperation>(error, 'Failed to load HomeKit device candidates.'),
				response.status
			);
		} finally {
			fetchingCandidates.value = false;
		}
	};

	const mapDevices = async (deviceIds: string[]): Promise<IHomeKitDeviceCandidate[]> => {
		savingMapping.value = true;

		try {
			const { data, error, response } = await backend.client.POST(`/${PLUGINS_PREFIX}/${DEVICES_HOMEKIT_PLUGIN_PREFIX}/bridge/candidates/map`, {
				body: {
					data: {
						device_ids: deviceIds,
					},
				},
			});

			if (data) {
				candidates.value = transformHomeKitCandidates(data.data);
				if (status.value) {
					status.value.exposedDevicesCount = deviceIds.length;
				}
				return candidates.value;
			}

			throw new DevicesHomeKitApiException(
				getErrorReason<DevicesHomeKitPluginMapCandidatesOperation>(error, 'Failed to update HomeKit device mappings.'),
				response.status
			);
		} finally {
			savingMapping.value = false;
		}
	};

	const resetPairing = async (): Promise<IHomeKitBridgeStatus> => {
		resettingPairing.value = true;

		try {
			const { data, error, response } = await backend.client.POST(`/${PLUGINS_PREFIX}/${DEVICES_HOMEKIT_PLUGIN_PREFIX}/bridge/reset-pairing`);

			if (data) {
				const transformed = transformHomeKitBridgeStatus(data.data);
				statusSequence++;
				return (status.value = transformed);
			}

			throw new DevicesHomeKitApiException(
				getErrorReason<DevicesHomeKitPluginResetPairingOperation>(error, 'Failed to reset HomeKit pairing.'),
				response.status
			);
		} finally {
			resettingPairing.value = false;
		}
	};

	const onEvent = (payload: { event: string; data: unknown }): void => {
		switch (payload.event) {
			case EventType.BRIDGE_STATUS_CHANGED:
				statusSequence++;
				status.value = transformHomeKitBridgeStatus(payload.data);
				return;
		}
	};

	const isLoaded = (): boolean => status.value !== null;

	const refresh = (): Promise<IHomeKitBridgeStatus> => fetchStatus();

	return {
		status,
		candidates,
		fetchingStatus,
		fetchingCandidates,
		savingMapping,
		resettingPairing,
		fetchStatus,
		fetchCandidates,
		mapDevices,
		resetPairing,
		onEvent,
		isLoaded,
		refresh,
	};
});

/**
 * Registers and initializes the HomeKit bridge store with the active Pinia root.
 *
 * @param pinia - Pinia root instance.
 * @returns The initialized `useHomeKitBridge` store instance.
 */
export const registerHomeKitBridgeStore = (pinia: Pinia): ReturnType<typeof useHomeKitBridge> => useHomeKitBridge(pinia);
