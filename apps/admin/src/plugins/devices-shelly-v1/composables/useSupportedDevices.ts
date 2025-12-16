import { ref } from 'vue';
import { useI18n } from 'vue-i18n';

import { getErrorReason, useBackend, useFlashMessage } from '../../../common';
import { PLUGINS_PREFIX } from '../../../app.constants';
import type { DevicesShellyV1PluginGetSupportedOperation } from '../../../openapi.constants';
import { DEVICES_SHELLY_V1_PLUGIN_PREFIX } from '../devices-shelly-v1.constants';
import type { IShellyV1SupportedDevice } from '../schemas/devices.types';
import { transformSupportedDevicesResponse } from '../utils/devices.transformers';

import type { IUseSupportedDevices } from './types';

export const useSupportedDevices = (): IUseSupportedDevices => {
	const { t } = useI18n();

	const backend = useBackend();

	const flashMessage = useFlashMessage();

	const supportedDevices = ref<IShellyV1SupportedDevice[]>([]);

	const loaded = ref<boolean>(false);

	const fetchDevices = async (force?: boolean): Promise<void> => {
		if (loaded.value && !force) {
			return;
		}

		const { data: responseData, error, response } = await backend.client.GET(`/${PLUGINS_PREFIX}/${DEVICES_SHELLY_V1_PLUGIN_PREFIX}/devices/supported`, {});

		if (typeof responseData !== 'undefined') {
			supportedDevices.value = transformSupportedDevicesResponse(responseData.data);

			loaded.value = true;

			return;
		}

		if (response.status === 422) {
			let errorMessage: string | null = 'Failed to fetch supported devices.';

			if (error) {
				errorMessage = getErrorReason<DevicesShellyV1PluginGetSupportedOperation>(error, errorMessage);
			}

			flashMessage.error(errorMessage);
		} else {
			flashMessage.error(t('devicesShellyV1Plugin.messages.devices.failedLoadSupportedDevices'));
		}
	};

	return {
		supportedDevices,
		loaded,
		fetchDevices,
	};
};
