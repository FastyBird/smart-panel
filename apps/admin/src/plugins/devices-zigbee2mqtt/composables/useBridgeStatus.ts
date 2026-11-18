import { type ComputedRef, type Ref, computed, ref } from 'vue';

import { PLUGINS_PREFIX } from '../../../app.constants';
import { useBackend, useLogger } from '../../../common';
import { DEVICES_ZIGBEE2MQTT_PLUGIN_PREFIX } from '../devices-zigbee2mqtt.constants';
import { type IZ2mBridgeHint, type IZ2mBridgeStatus, bridgeSettingsHints, transformBridgeStatusResponse } from '../utils/bridge-settings';

export interface IUseBridgeStatus {
	status: Ref<IZ2mBridgeStatus | null>;
	hints: ComputedRef<IZ2mBridgeHint[]>;
	loading: Ref<boolean>;
	fetchStatus: () => Promise<void>;
}

/** The bridge's freshness-related settings. A failed fetch only hides the recommendations. */
export const useBridgeStatus = (): IUseBridgeStatus => {
	const backend = useBackend();
	const logger = useLogger();

	const status = ref<IZ2mBridgeStatus | null>(null);
	const loading = ref<boolean>(false);

	const fetchStatus = async (): Promise<void> => {
		loading.value = true;

		try {
			const { data: responseData } = await backend.client.GET(`/${PLUGINS_PREFIX}/${DEVICES_ZIGBEE2MQTT_PLUGIN_PREFIX}/bridge`);

			status.value = typeof responseData !== 'undefined' ? transformBridgeStatusResponse(responseData.data) : null;
		} catch (error: unknown) {
			logger.warn('Zigbee2MQTT bridge status could not be loaded', error);

			status.value = null;
		} finally {
			loading.value = false;
		}
	};

	const hints = computed<IZ2mBridgeHint[]>(() => bridgeSettingsHints(status.value));

	return { status, hints, loading, fetchStatus };
};
