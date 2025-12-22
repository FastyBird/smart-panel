import { ref, type Ref } from 'vue';

import { getErrorReason, injectStoresManager, useBackend, useFlashMessage, useLogger } from '../../../common';
import { PLUGINS_PREFIX } from '../../../app.constants';
import { devicesStoreKey, type IDevice } from '../../../modules/devices';
import { DEVICES_ZIGBEE2MQTT_PLUGIN_PREFIX, DEVICES_ZIGBEE2MQTT_TYPE } from '../devices-zigbee2mqtt.constants';
import { DevicesZigbee2mqttApiException, DevicesZigbee2mqttValidationException } from '../devices-zigbee2mqtt.exceptions';
import type { IAdoptDeviceRequest } from '../schemas/mapping-preview.types';
import { Zigbee2mqttDeviceSchema } from '../store/devices.store.schemas';
import type { IZigbee2mqttDevice } from '../store/devices.store.types';
import { transformAdoptDeviceRequest } from '../utils/mapping-preview.transformers';

export interface IUseDeviceAdoption {
	isAdopting: Ref<boolean>;
	adoptionError: Ref<Error | null>;
	adoptDevice: (request: IAdoptDeviceRequest) => Promise<IZigbee2mqttDevice>;
}

export const useDeviceAdoption = (): IUseDeviceAdoption => {
	const backend = useBackend();
	const logger = useLogger();
	const flashMessage = useFlashMessage();
	const storesManager = injectStoresManager();

	const devicesStore = storesManager.getStore(devicesStoreKey);

	const isAdopting = ref<boolean>(false);
	const adoptionError = ref<Error | null>(null);

	const adoptDevice = async (request: IAdoptDeviceRequest): Promise<IZigbee2mqttDevice> => {
		isAdopting.value = true;
		adoptionError.value = null;

		try {
			const requestBody = transformAdoptDeviceRequest(request);

			const {
				data: responseData,
				error: apiError,
				response,
			} = await backend.client.POST(`/${PLUGINS_PREFIX}/${DEVICES_ZIGBEE2MQTT_PLUGIN_PREFIX}/discovered-devices/adopt`, {
				body: requestBody as never,
			});

			if (typeof responseData !== 'undefined' && responseData.data) {
				// Parse and validate the response
				const parsedDevice = Zigbee2mqttDeviceSchema.safeParse({
					...responseData.data,
					type: DEVICES_ZIGBEE2MQTT_TYPE,
				});

				if (!parsedDevice.success) {
					logger.error('Schema validation failed with:', parsedDevice.error);
					throw new DevicesZigbee2mqttValidationException('Failed to parse adopted device response.');
				}

				// Store the adopted device
				devicesStore.set({
					id: parsedDevice.data.id,
					data: parsedDevice.data as IDevice,
				});

				isAdopting.value = false;
				flashMessage.success(`Device "${request.name}" has been adopted successfully.`);

				return parsedDevice.data;
			}

			let errorReason: string | null = 'Failed to adopt device.';

			if (apiError) {
				errorReason = getErrorReason(apiError as never, errorReason);
			}

			throw new DevicesZigbee2mqttApiException(errorReason, response?.status);
		} catch (err: unknown) {
			isAdopting.value = false;
			const errorObj = err as Error;
			adoptionError.value = errorObj;

			if (errorObj instanceof DevicesZigbee2mqttValidationException) {
				flashMessage.error(errorObj.message);
			} else if (errorObj instanceof DevicesZigbee2mqttApiException) {
				flashMessage.error(errorObj.message);
			} else {
				logger.error('Failed to adopt device:', errorObj);
				flashMessage.error('Failed to adopt device. Please try again.');
			}

			throw errorObj;
		}
	};

	return {
		isAdopting,
		adoptionError,
		adoptDevice,
	};
};
