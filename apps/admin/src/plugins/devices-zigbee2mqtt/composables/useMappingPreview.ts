import { ref, type Ref } from 'vue';

import { useBackend, useFlashMessage, useLogger } from '../../../common';
import { PLUGINS_PREFIX } from '../../../app.constants';
import { DEVICES_ZIGBEE2MQTT_PLUGIN_PREFIX } from '../devices-zigbee2mqtt.constants';
import { DevicesZigbee2mqttApiException, DevicesZigbee2mqttValidationException } from '../devices-zigbee2mqtt.exceptions';
import type { IMappingPreviewRequest, IMappingPreviewResponse } from '../schemas/mapping-preview.types';
import { transformMappingPreviewRequest, transformMappingPreviewResponse } from '../utils/mapping-preview.transformers';

export interface IUseMappingPreview {
	preview: Ref<IMappingPreviewResponse | null>;
	isLoading: Ref<boolean>;
	error: Ref<Error | null>;
	fetchPreview: (ieeeAddress: string, overrides?: IMappingPreviewRequest) => Promise<IMappingPreviewResponse>;
	updatePreview: (ieeeAddress: string, overrides: IMappingPreviewRequest) => Promise<IMappingPreviewResponse>;
	clearPreview: () => void;
}

export const useMappingPreview = (): IUseMappingPreview => {
	const backend = useBackend();
	const logger = useLogger();
	const flashMessage = useFlashMessage();

	const preview = ref<IMappingPreviewResponse | null>(null);
	const isLoading = ref<boolean>(false);
	const error = ref<Error | null>(null);

	// Request sequence guard: track the current request ID to ignore stale responses
	let currentRequestId = 0;

	const fetchPreview = async (ieeeAddress: string, overrides?: IMappingPreviewRequest): Promise<IMappingPreviewResponse> => {
		// Increment request ID for this new request
		const requestId = ++currentRequestId;
		isLoading.value = true;
		error.value = null;

		try {
			const requestBody = overrides ? transformMappingPreviewRequest(overrides) : undefined;

			const apiResponse = await backend.client.POST(
				`/${PLUGINS_PREFIX}/${DEVICES_ZIGBEE2MQTT_PLUGIN_PREFIX}/discovered-devices/{ieeeAddress}/preview-mapping` as never,
				{
					params: {
						path: { ieeeAddress },
					},
					body: requestBody,
				} as never
			);

			const { data: responseData, error: apiError, response } = apiResponse as {
				data?: { data: unknown };
				error?: unknown;
				response?: { status: number };
			};

			// Sequence guard: ignore response if this request is no longer the current one
			if (requestId !== currentRequestId) {
				throw new DevicesZigbee2mqttApiException('Request was superseded by a newer request.', 0);
			}

			if (typeof responseData !== 'undefined' && responseData.data) {
				// Double-check sequence guard before updating state
				if (requestId !== currentRequestId) {
					throw new DevicesZigbee2mqttApiException('Request was superseded by a newer request.', 0);
				}

				const transformed = transformMappingPreviewResponse(responseData.data as never);

				preview.value = transformed;
				isLoading.value = false;

				return transformed;
			}

			const errorReason = apiError ? String(apiError) : 'Failed to fetch mapping preview.';

			throw new DevicesZigbee2mqttApiException(errorReason, response?.status ?? 500);
		} catch (err: unknown) {
			// Only update loading state if this is still the current request
			if (requestId === currentRequestId) {
				isLoading.value = false;
			}

			const errorObj = err as Error;

			// Ignore errors from superseded requests - don't show error messages or update error state
			if (requestId !== currentRequestId) {
				throw errorObj;
			}

			if (errorObj instanceof DevicesZigbee2mqttValidationException) {
				error.value = errorObj;
				flashMessage.error(errorObj.message);
			} else if (errorObj instanceof DevicesZigbee2mqttApiException) {
				if (!errorObj.message.includes('superseded')) {
					error.value = errorObj;
					flashMessage.error(errorObj.message);
				}
			} else {
				error.value = errorObj;
				logger.error('Failed to fetch mapping preview:', errorObj);
				flashMessage.error('Failed to load mapping preview. Please try again.');
			}

			throw errorObj;
		}
	};

	const updatePreview = async (ieeeAddress: string, overrides: IMappingPreviewRequest): Promise<IMappingPreviewResponse> => {
		return fetchPreview(ieeeAddress, overrides);
	};

	const clearPreview = (): void => {
		// Increment request ID to invalidate any in-flight requests
		currentRequestId++;
		preview.value = null;
		error.value = null;
		isLoading.value = false;
	};

	return {
		preview,
		isLoading,
		error,
		fetchPreview,
		updatePreview,
		clearPreview,
	};
};
