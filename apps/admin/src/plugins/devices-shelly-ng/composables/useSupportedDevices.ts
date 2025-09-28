import { ref } from 'vue';
import { useI18n } from 'vue-i18n';

import { getErrorReason, useBackend, useFlashMessage } from '../../../common';
import type { operations } from '../../../openapi';
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

		const { data: responseData, error, response } = await backend.client.GET(`/plugins/${DEVICES_SHELLY_NG_PLUGIN_PREFIX}/devices/supported`, {});

		if (typeof responseData !== 'undefined') {
			supportedDevices.value = transformSupportedDevicesResponse(responseData.data);

			loaded.value = true;

			return;
		}

		if (response.status === 422) {
			let errorMessage: string | null = 'Failed to fetch supported devices.';

			if (error) {
				errorMessage = getErrorReason<operations['get-devices-shelly-ng-plugin-supported']>(error, errorMessage);
			}

			flashMessage.error(errorMessage);
		} else {
			flashMessage.error(t('devicesShellyNgPlugin.messages.devices.failedLoadSupportedDevices'));
		}
	};

	return {
		supportedDevices,
		loaded,
		fetchDevices,
	};
};
