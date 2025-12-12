import { ref } from 'vue';

import { getErrorReason, useBackend, useFlashMessage, useLogger } from '../../../common';
import { PLUGINS_PREFIX } from '../../../app.constants';
import type { DevicesHomeAssistantPluginAdoptDeviceOperation } from '../../../openapi.constants';
import type { IDevice } from '../../../modules/devices';
import { DEVICES_HOME_ASSISTANT_PLUGIN_PREFIX } from '../devices-home-assistant.constants';
import { DevicesHomeAssistantApiException, DevicesHomeAssistantValidationException } from '../devices-home-assistant.exceptions';
import type { IAdoptDeviceRequest } from '../schemas/mapping-preview.types';
import { transformAdoptDeviceRequest } from '../utils/mapping-preview.transformers';

export interface IUseDeviceAdoption {
	isAdopting: Ref<boolean>;
	error: Ref<Error | null>;
	adoptDevice: (request: IAdoptDeviceRequest) => Promise<IDevice>;
}

export const useDeviceAdoption = (): IUseDeviceAdoption => {
	const backend = useBackend();
	const logger = useLogger();
	const flashMessage = useFlashMessage();

	const isAdopting = ref<boolean>(false);
	const error = ref<Error | null>(null);

	const adoptDevice = async (request: IAdoptDeviceRequest): Promise<IDevice> => {
		if (isAdopting.value) {
			throw new DevicesHomeAssistantApiException('Device adoption is already in progress.');
		}

		isAdopting.value = true;
		error.value = null;

		try {
			const requestBody = transformAdoptDeviceRequest(request);

			const {
				data: responseData,
				error: apiError,
				response,
			} = await backend.client.POST(`/${PLUGINS_PREFIX}/${DEVICES_HOME_ASSISTANT_PLUGIN_PREFIX}/discovered-devices/adopt`, {
				body: {
					data: requestBody,
				},
			});

			if (typeof responseData !== 'undefined' && responseData.data) {
				isAdopting.value = false;

				// Transform the response to match IDevice type
				// The response should be a DeviceResponseModel with the device data
				const device = responseData.data as unknown as IDevice;

				return device;
			}

			let errorReason: string | null = 'Failed to adopt device.';

			if (apiError) {
				errorReason = getErrorReason<DevicesHomeAssistantPluginAdoptDeviceOperation>(apiError, errorReason);
			}

			throw new DevicesHomeAssistantApiException(errorReason, response.status);
		} catch (err: unknown) {
			isAdopting.value = false;

			const err = err as Error;

			if (err instanceof DevicesHomeAssistantValidationException) {
				error.value = err;
				flashMessage.error(err.message);
			} else if (err instanceof DevicesHomeAssistantApiException) {
				error.value = err;
				flashMessage.error(err.message);
			} else {
				error.value = err;
				logger.error('Failed to adopt device:', err);
				flashMessage.error('Failed to adopt device. Please try again.');
			}

			throw err;
		}
	};

	return {
		isAdopting,
		error,
		adoptDevice,
	};
};
