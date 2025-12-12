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

	const fetchPreview = async (haDeviceId: string, overrides?: IMappingPreviewRequest): Promise<IMappingPreviewResponse> => {
		if (isLoading.value) {
			throw new DevicesHomeAssistantApiException('Preview is already being loaded.');
		}

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
					body: requestBody
						? {
								data: requestBody,
							}
						: undefined,
				}
			);

			if (typeof responseData !== 'undefined') {
				const transformed = transformMappingPreviewResponse(responseData);

				preview.value = transformed;
				isLoading.value = false;

				return transformed;
			}

			let errorReason: string | null = 'Failed to fetch mapping preview.';

			if (apiError) {
				// OpenAPI operation type will be generated when OpenAPI spec is updated
				errorReason = getErrorReason(apiError, errorReason);
			}

			throw new DevicesHomeAssistantApiException(errorReason, response.status);
		} catch (err: unknown) {
			isLoading.value = false;

			const err = err as Error;

			if (err instanceof DevicesHomeAssistantValidationException) {
				error.value = err;
				flashMessage.error(err.message);
			} else if (err instanceof DevicesHomeAssistantApiException) {
				error.value = err;
				flashMessage.error(err.message);
			} else {
				error.value = err;
				logger.error('Failed to fetch mapping preview:', err);
				flashMessage.error('Failed to load mapping preview. Please try again.');
			}

			throw err;
		}
	};

	const updatePreview = async (haDeviceId: string, overrides: IMappingPreviewRequest): Promise<IMappingPreviewResponse> => {
		return fetchPreview(haDeviceId, overrides);
	};

	const clearPreview = (): void => {
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
