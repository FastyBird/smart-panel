import { ref, type Ref } from 'vue';

import { getErrorReason, injectStoresManager, useBackend, useFlashMessage, useLogger } from '../../../common';
import { PLUGINS_PREFIX } from '../../../app.constants';
import { DeviceSchema, transformDeviceResponse, type IDevice, devicesStoreKey, useDevicesPlugins } from '../../../modules/devices';
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
	const storesManager = injectStoresManager();

	const { getElement: getPluginElement } = useDevicesPlugins();
	const devicesStore = storesManager.getStore(devicesStoreKey);

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
				body: requestBody as never,
			});

			if (typeof responseData !== 'undefined' && responseData.data) {
				isAdopting.value = false;

				// Transform the response device to match IDevice type
				const element = getPluginElement(responseData.data.type);
				const transformed = transformDeviceResponse(responseData.data, element?.schemas?.deviceSchema || DeviceSchema);

				// Store the device in the store
				devicesStore.set({
					id: transformed.id,
					data: transformed,
				});

				// The backend should return the device with channels and controls
				// If the response includes relations, they will be handled when the device is fetched
				// For now, we just store the device and let the store handle relations when needed
				// The device detail page will fetch the full device with relations

				return transformed;
			}

			let errorReason: string | null = 'Failed to adopt device.';

			if (apiError) {
				// OpenAPI operation type will be generated when OpenAPI spec is updated
				errorReason = getErrorReason(apiError as never, errorReason);
			}

			throw new DevicesHomeAssistantApiException(errorReason, response.status);
		} catch (err: unknown) {
			isAdopting.value = false;

			const errorObj = err as Error;

			if (errorObj instanceof DevicesHomeAssistantValidationException) {
				error.value = errorObj;
				flashMessage.error(errorObj.message);
			} else if (errorObj instanceof DevicesHomeAssistantApiException) {
				error.value = errorObj;
				flashMessage.error(errorObj.message);
			} else {
				error.value = errorObj;
				logger.error('Failed to adopt device:', errorObj);
				flashMessage.error('Failed to adopt device. Please try again.');
			}

			throw errorObj;
		}
	};

	return {
		isAdopting,
		error,
		adoptDevice,
	};
};
