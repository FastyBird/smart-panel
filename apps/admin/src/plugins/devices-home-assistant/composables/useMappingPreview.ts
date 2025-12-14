import { ref, type Ref } from 'vue';

import { getErrorReason, useBackend, useFlashMessage, useLogger } from '../../../common';
import { PLUGINS_PREFIX } from '../../../app.constants';
import { DEVICES_HOME_ASSISTANT_PLUGIN_PREFIX } from '../devices-home-assistant.constants';
import { DevicesHomeAssistantApiException, DevicesHomeAssistantValidationException } from '../devices-home-assistant.exceptions';
import type { IMappingPreviewRequest, IMappingPreviewResponse } from '../schemas/mapping-preview.types';
import { transformMappingPreviewRequest, transformMappingPreviewResponse } from '../utils/mapping-preview.transformers';

export interface IUseMappingPreview {
	preview: Ref<IMappingPreviewResponse | null>;
	isLoading: Ref<boolean>;
	error: Ref<Error | null>;
	fetchPreview: (haDeviceId: string, overrides?: IMappingPreviewRequest) => Promise<IMappingPreviewResponse>;
	updatePreview: (haDeviceId: string, overrides: IMappingPreviewRequest) => Promise<IMappingPreviewResponse>;
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

	const fetchPreview = async (haDeviceId: string, overrides?: IMappingPreviewRequest): Promise<IMappingPreviewResponse> => {
		// Increment request ID for this new request
		const requestId = ++currentRequestId;
		isLoading.value = true;
		error.value = null;

		try {
			const requestBody = overrides ? transformMappingPreviewRequest(overrides) : undefined;

			const {
				data: responseData,
				error: apiError,
				response,
			} = await backend.client.POST(
				`/${PLUGINS_PREFIX}/${DEVICES_HOME_ASSISTANT_PLUGIN_PREFIX}/discovered-devices/{id}/preview-mapping`,
				{
					params: {
						path: { id: haDeviceId },
					},
					body: requestBody as never,
				}
			);

			// Sequence guard: ignore response if this request is no longer the current one
			if (requestId !== currentRequestId) {
				// This response is stale - don't update state, but still throw to indicate cancellation
				throw new DevicesHomeAssistantApiException('Request was superseded by a newer request.');
			}

			// Validate response status is in 2xx range before accepting data
			// Check status first to reject non-2xx responses immediately, even if they contain a body
			// This prevents processing error responses that might have a data field (e.g., from proxies or malformed APIs)
			if (!response || response.status < 200 || response.status >= 300) {
				let errorReason: string | null = 'Failed to fetch mapping preview.';

				if (apiError) {
					// OpenAPI operation type will be generated when OpenAPI spec is updated
					errorReason = getErrorReason(apiError as never, errorReason);
				}

				throw new DevicesHomeAssistantApiException(errorReason, response?.status);
			}

			// Only process data if status is 2xx (defensive check: verify status again before processing)
			// This ensures we never process data from non-2xx responses, even if responseData exists
			if (response.status >= 200 && response.status < 300 && typeof responseData !== 'undefined' && responseData.data) {
				// Double-check sequence guard before updating state
				if (requestId !== currentRequestId) {
					throw new DevicesHomeAssistantApiException('Request was superseded by a newer request.');
				}

				const transformed = transformMappingPreviewResponse(responseData.data);

				preview.value = transformed;
				isLoading.value = false;

				return transformed;
			}

			// Status is 2xx but no data - this shouldn't happen but handle gracefully
			let errorReason: string | null = 'Failed to fetch mapping preview: Invalid response format.';

			if (apiError) {
				// OpenAPI operation type will be generated when OpenAPI spec is updated
				errorReason = getErrorReason(apiError as never, errorReason);
			}

			throw new DevicesHomeAssistantApiException(errorReason, response.status);
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

	const updatePreview = async (haDeviceId: string, overrides: IMappingPreviewRequest): Promise<IMappingPreviewResponse> => {
		return fetchPreview(haDeviceId, overrides);
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
		fetchPreview,
		updatePreview,
		clearPreview,
	};
};
