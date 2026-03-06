import { ref } from 'vue';
import { useI18n } from 'vue-i18n';

import { getErrorReason, useBackend, useFlashMessage } from '../../../common';
import { PLUGINS_PREFIX } from '../../../app.constants';
import type { DevicesShellyNgPluginGetSupportedOperation } from '../../../openapi.constants';
import { DEVICES_SHELLY_NG_PLUGIN_PREFIX } from '../devices-shelly-ng.constants';
import type { IShellyNgSupportedDevice } from '../schemas/devices.types';
import { transformSupportedDevicesResponse } from '../utils/devices.transformers';

import type { IUseSupportedDevices } from './types';

export const useSupportedDevices = (): IUseSupportedDevices => {
	const { t } = useI18n();

	const backend = useBackend();

	const flashMessage = useFlashMessage();

	const supportedDevices = ref<IShellyNgSupportedDevice[]>([]);

	const loaded = ref<boolean>(false);

	const fetchDevices = async (force?: boolean): Promise<void> => {
		if (loaded.value && !force) {
			return;
		}

		const { data: responseData, error, response } = await backend.client.GET(`/${PLUGINS_PREFIX}/${DEVICES_SHELLY_NG_PLUGIN_PREFIX}/devices/supported`, {});

		if (typeof responseData !== 'undefined') {
			supportedDevices.value = transformSupportedDevicesResponse(responseData.data);

			loaded.value = true;

			return;
		}

		const localizedError = t('devicesShellyNgPlugin.messages.devices.failedLoadSupportedDevices');

		if (response.status === 422) {
			let errorMessage: string | null = localizedError;

			if (error) {
				errorMessage = getErrorReason<DevicesShellyNgPluginGetSupportedOperation>(error, errorMessage);
			}

			flashMessage.error(errorMessage);
		} else {
			flashMessage.error(localizedError);
		}
	};

	return {
		supportedDevices,
		loaded,
		fetchDevices,
	};
};
