import { type Ref, ref } from 'vue';

import { PLUGINS_PREFIX } from '../../../app.constants';
import { getErrorReason, useBackend, useFlashMessage, useLogger } from '../../../common';
import { DEVICES_HOME_ASSISTANT_PLUGIN_PREFIX } from '../devices-home-assistant.constants';
import { DevicesHomeAssistantApiException, DevicesHomeAssistantValidationException } from '../devices-home-assistant.exceptions';
import type { IMappingPreviewRequest, IMappingPreviewResponse } from '../schemas/mapping-preview.types';
import {
	transformHelperMappingPreviewResponse,
	transformMappingPreviewRequest,
	transformMappingPreviewResponse,
} from '../utils/mapping-preview.transformers';

export type ItemType = 'device' | 'helper';

export interface IUseMappingPreview {
	preview: Ref<IMappingPreviewResponse | null>;
	isLoading: Ref<boolean>;
	error: Ref<Error | null>;
	itemType: Ref<ItemType>;
	fetchPreview: (itemId: string, overrides?: IMappingPreviewRequest, type?: ItemType) => Promise<IMappingPreviewResponse>;
	updatePreview: (itemId: string, overrides: IMappingPreviewRequest, type?: ItemType) => Promise<IMappingPreviewResponse>;
	clearPreview: () => void;
}

export const useMappingPreview = (): IUseMappingPreview => {
	const backend = useBackend();
	const logger = useLogger();
	const flashMessage = useFlashMessage();

	const preview = ref<IMappingPreviewResponse | null>(null);
	const isLoading = ref<boolean>(false);
	const error = ref<Error | null>(null);
	const itemType = ref<ItemType>('device');

	// Request sequence guard: track the current request ID to ignore stale responses
	let currentRequestId = 0;

	const fetchPreview = async (itemId: string, overrides?: IMappingPreviewRequest, type?: ItemType): Promise<IMappingPreviewResponse> => {
		// Store the item type for later use
		const currentType = type ?? itemType.value;
		itemType.value = currentType;
		// Increment request ID for this new request
		const requestId = ++currentRequestId;
		isLoading.value = true;
		error.value = null;

		try {
			let transformed: IMappingPreviewResponse;

			if (currentType === 'helper') {
				// Fetch helper mapping preview
				// For helpers, extract channelCategory from the first entityOverride if present
				// (helpers have only one entity, so only one override applies)
				const helperChannelCategory = overrides?.entityOverrides?.[0]?.channelCategory;
				const helperRequestBody = overrides
					? {
							device_category: overrides.deviceCategory,
							channel_category: helperChannelCategory,
						}
					: undefined;

				const {
					data: responseData,
					error: apiError,
					response,
				} = await backend.client.POST(`/${PLUGINS_PREFIX}/${DEVICES_HOME_ASSISTANT_PLUGIN_PREFIX}/discovered-helpers/{entityId}/preview-mapping`, {
					params: {
						path: { entityId: itemId },
					},
					body: helperRequestBody as never,
				});

				// Sequence guard: ignore response if this request is no longer the current one
				if (requestId !== currentRequestId) {
					throw new DevicesHomeAssistantApiException('Request was superseded by a newer request.');
				}

				if (typeof responseData !== 'undefined' && responseData.data) {
					if (requestId !== currentRequestId) {
						throw new DevicesHomeAssistantApiException('Request was superseded by a newer request.');
					}

					transformed = transformHelperMappingPreviewResponse(responseData.data);
				} else {
					let errorReason: string | null = 'Failed to fetch helper mapping preview.';

					if (apiError) {
						errorReason = getErrorReason(apiError as never, errorReason);
					}

					throw new DevicesHomeAssistantApiException(errorReason, response?.status);
				}
			} else {
				// Fetch device mapping preview
				const requestBody = overrides ? transformMappingPreviewRequest(overrides) : undefined;

				const {
					data: responseData,
					error: apiError,
					response,
				} = await backend.client.POST(`/${PLUGINS_PREFIX}/${DEVICES_HOME_ASSISTANT_PLUGIN_PREFIX}/discovered-devices/{id}/preview-mapping`, {
					params: {
						path: { id: itemId },
					},
					body: requestBody as never,
				});

				// Sequence guard: ignore response if this request is no longer the current one
				if (requestId !== currentRequestId) {
					throw new DevicesHomeAssistantApiException('Request was superseded by a newer request.');
				}

				if (typeof responseData !== 'undefined' && responseData.data) {
					if (requestId !== currentRequestId) {
						throw new DevicesHomeAssistantApiException('Request was superseded by a newer request.');
					}

					transformed = transformMappingPreviewResponse(responseData.data);
				} else {
					let errorReason: string | null = 'Failed to fetch mapping preview.';

					if (apiError) {
						errorReason = getErrorReason(apiError as never, errorReason);
					}

					throw new DevicesHomeAssistantApiException(errorReason, response?.status);
				}
			}

			preview.value = transformed;
			isLoading.value = false;

			return transformed;
		} catch (err: unknown) {
			// Only update loading state if this is still the current request
			if (requestId === currentRequestId) {
				isLoading.value = false;
			}

			const errorObj = err as Error;

			// Ignore errors from superseded requests - don't show error messages or update error state
			if (requestId !== currentRequestId) {
				// Silently ignore stale request errors
				throw errorObj;
			}

			if (errorObj instanceof DevicesHomeAssistantValidationException) {
				error.value = errorObj;
				flashMessage.error(errorObj.message);
			} else if (errorObj instanceof DevicesHomeAssistantApiException) {
				// Don't show error for superseded requests
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

	const updatePreview = async (itemId: string, overrides: IMappingPreviewRequest, type?: ItemType): Promise<IMappingPreviewResponse> => {
		return fetchPreview(itemId, overrides, type ?? itemType.value);
	};

	const clearPreview = (): void => {
		// Increment request ID to invalidate any in-flight requests
		// This ensures stale responses from old requests are ignored
		currentRequestId++;
		preview.value = null;
		error.value = null;
		isLoading.value = false;
	};

	return {
		preview,
		isLoading,
		error,
		itemType,
		fetchPreview,
		updatePreview,
		clearPreview,
	};
};
