import { ref, type Ref } from 'vue';

import { getErrorReason, injectStoresManager, useBackend, useFlashMessage, useLogger } from '../../../common';
import { PLUGINS_PREFIX } from '../../../app.constants';
import { DeviceSchema, transformDeviceResponse, type IDevice, devicesStoreKey, useDevicesPlugins } from '../../../modules/devices';
import { DEVICES_HOME_ASSISTANT_PLUGIN_PREFIX } from '../devices-home-assistant.constants';
import { DevicesHomeAssistantApiException, DevicesHomeAssistantValidationException } from '../devices-home-assistant.exceptions';
import type { IAdoptDeviceRequest } from '../schemas/mapping-preview.types';
import { transformAdoptDeviceRequest, transformAdoptHelperRequest } from '../utils/mapping-preview.transformers';

import type { ItemType } from './useMappingPreview';

export interface IUseDeviceAdoption {
	isAdopting: Ref<boolean>;
	error: Ref<Error | null>;
	adoptDevice: (request: IAdoptDeviceRequest, itemType?: ItemType) => Promise<IDevice>;
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

	const adoptDevice = async (request: IAdoptDeviceRequest, itemType: ItemType = 'device'): Promise<IDevice> => {
		if (isAdopting.value) {
			throw new DevicesHomeAssistantApiException('Device adoption is already in progress.');
		}

		isAdopting.value = true;
		error.value = null;

		let storedDeviceId: string | null = null;

		try {
			let responseData: { data?: { type: string } & Record<string, unknown> } | undefined;
			let apiError: unknown;
			let response: { status: number };

			if (itemType === 'helper') {
				// Adopt helper
				const requestBody = transformAdoptHelperRequest(request);

				const result = await backend.client.POST(
					`/${PLUGINS_PREFIX}/${DEVICES_HOME_ASSISTANT_PLUGIN_PREFIX}/discovered-helpers/adopt`,
					{
						body: requestBody as never,
					},
				);

				responseData = result.data;
				apiError = result.error;
				response = result.response;
			} else {
				// Adopt device
				const requestBody = transformAdoptDeviceRequest(request);

				const result = await backend.client.POST(
					`/${PLUGINS_PREFIX}/${DEVICES_HOME_ASSISTANT_PLUGIN_PREFIX}/discovered-devices/adopt`,
					{
						body: requestBody as never,
					},
				);

				responseData = result.data;
				apiError = result.error;
				response = result.response;
			}

			// Check for errors first - if there's an error or non-2xx status, don't process response data
			if (apiError || response.status < 200 || response.status >= 300) {
				let errorReason: string | null = 'Failed to adopt device.';

				if (apiError) {
					// OpenAPI operation type will be generated when OpenAPI spec is updated
					errorReason = getErrorReason(apiError as never, errorReason);
				}

				throw new DevicesHomeAssistantApiException(errorReason, response.status);
			}

			// Only process and store device if response is successful (2xx status) and has data
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

				// Track the stored device ID in case we need to remove it on error
				storedDeviceId = transformed.id;

				// The backend should return the device with channels and controls
				// If the response includes relations, they will be handled when the device is fetched
				// For now, we just store the device and let the store handle relations when needed
				// The device detail page will fetch the full device with relations

				return transformed;
			}

			// If we get here, response was successful but no data - this shouldn't happen
			throw new DevicesHomeAssistantApiException('Device adoption succeeded but no device data was returned.', response.status);
		} catch (err: unknown) {
			isAdopting.value = false;

			const errorObj = err as Error;

			// If device was stored but adoption failed, remove it from the store
			// This is a critical cleanup step - the device should not remain in the store if adoption fails
			if (storedDeviceId) {
				try {
					devicesStore.unset({ id: storedDeviceId });
				} catch (unsetError) {
					logger.error(`[DEVICE ADOPTION] Failed to remove device ${storedDeviceId} from store:`, unsetError);
				}
			}

			if (errorObj instanceof DevicesHomeAssistantValidationException) {
				error.value = errorObj;
				flashMessage.error(errorObj.message);
			} else if (errorObj instanceof DevicesHomeAssistantApiException) {
				error.value = errorObj;
				flashMessage.error(errorObj.message);
			} else {
				error.value = errorObj;
				logger.error('[DEVICE ADOPTION] Failed to adopt device:', errorObj);
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
