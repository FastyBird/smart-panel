import { ref } from 'vue';

import { type Pinia, type Store, defineStore } from 'pinia';

import { get as lodashGet } from 'lodash';

import { MODULES_PREFIX } from '../../../app.constants';
import { getErrorCode, getErrorReason, useBackend, useLogger } from '../../../common';
import type { AutomationsModuleGenerateTemplateDraftOperation, AutomationsModuleGetTemplatesOperation } from '../../../openapi.constants';
import {
	AUTOMATIONS_MODULE_PREFIX,
	AUTOMATION_GRAPH_INVALID_ERROR_CODE,
	AUTOMATION_TEMPLATE_PARAMETERS_INVALID_ERROR_CODE,
} from '../automations.constants';
import {
	AutomationsApiException,
	AutomationsException,
	AutomationsGraphInvalidException,
	AutomationsTemplateParametersException,
	AutomationsValidationException,
} from '../automations.exceptions';

import { transformAutomationGraphIssues } from './automations.transformers';
import { AutomationTemplatesGenerateActionPayloadSchema } from './templates.store.schemas';
import type {
	IAutomationTemplate,
	IAutomationTemplateDraft,
	IAutomationTemplatesGenerateActionPayload,
	IAutomationTemplatesStateSemaphore,
	IAutomationTemplatesStoreActions,
	IAutomationTemplatesStoreState,
} from './templates.store.types';
import {
	transformAutomationTemplateDraftResponse,
	transformAutomationTemplateIssues,
	transformAutomationTemplateResponse,
} from './templates.transformers';

export type AutomationTemplatesStoreSetup = IAutomationTemplatesStoreState & IAutomationTemplatesStoreActions;

type ApiErrorEnvelope = Parameters<typeof getErrorReason<AutomationsModuleGenerateTemplateDraftOperation>>[0];

const toApiException = (error: unknown, message: string): AutomationsException => {
	return error instanceof AutomationsException ? error : new AutomationsApiException(message, null, error as Error);
};

/**
 * The templates new automations can be created from, as the backend loaded them, and the generation of the draft
 * of a new automation from a template. The catalogue is read as a whole and never changed from here; a draft is
 * not stored anywhere by the backend.
 */
export const useAutomationTemplatesStore = defineStore<'automations_module-templates', AutomationTemplatesStoreSetup>(
	'automations_module-templates',
	(): AutomationTemplatesStoreSetup => {
		const backend = useBackend();
		const logger = useLogger();

		const semaphore = ref<IAutomationTemplatesStateSemaphore>({ fetching: false, generating: [] });

		const firstLoad = ref<boolean>(false);

		const data = ref<IAutomationTemplate[]>([]);

		const firstLoadFinished = (): boolean => firstLoad.value;

		const fetching = (): boolean => semaphore.value.fetching;

		const generating = (id: IAutomationTemplate['id']): boolean => semaphore.value.generating.includes(id);

		const findAll = (): IAutomationTemplate[] => data.value;

		const findById = (id: IAutomationTemplate['id']): IAutomationTemplate | null => data.value.find((template) => template.id === id) ?? null;

		let pendingFetchPromise: Promise<IAutomationTemplate[]> | null = null;

		const fetch = (): Promise<IAutomationTemplate[]> => {
			if (pendingFetchPromise) {
				return pendingFetchPromise;
			}

			const fetchPromise = (async (): Promise<IAutomationTemplate[]> => {
				semaphore.value.fetching = true;

				try {
					const { data: responseData, error, response } = await backend.client.GET(`/${MODULES_PREFIX}/${AUTOMATIONS_MODULE_PREFIX}/templates`);

					if (typeof responseData === 'undefined') {
						let errorReason: string = 'Failed to fetch automation templates.';

						if (error) {
							errorReason = getErrorReason<AutomationsModuleGetTemplatesOperation>(error, errorReason);
						}

						throw new AutomationsApiException(errorReason, response?.status ?? null);
					}

					data.value = responseData.data.map(transformAutomationTemplateResponse);

					firstLoad.value = true;

					return data.value;
				} catch (e) {
					throw toApiException(e, 'Failed to fetch automation templates.');
				} finally {
					semaphore.value.fetching = false;
				}
			})().finally((): void => {
				pendingFetchPromise = null;
			});

			pendingFetchPromise = fetchPromise;

			return fetchPromise;
		};

		/**
		 * Tells apart the refusals a caller can show where they belong: answers that do not fit their questions and
		 * a generated graph the backend would not save. Everything else is a plain API failure.
		 */
		const createGenerateException = (error: unknown, status: number | null): AutomationsApiException => {
			const message = 'Failed to generate an automation from the template.';

			const envelope = error as ApiErrorEnvelope;

			const errorReason = error ? getErrorReason<AutomationsModuleGenerateTemplateDraftOperation>(envelope, message) : message;

			if (status === 422 && error) {
				const code = getErrorCode<AutomationsModuleGenerateTemplateDraftOperation>(envelope);

				if (code === AUTOMATION_TEMPLATE_PARAMETERS_INVALID_ERROR_CODE) {
					return new AutomationsTemplateParametersException(
						errorReason,
						transformAutomationTemplateIssues(lodashGet(error, 'error.details.issues', []))
					);
				}

				if (code === AUTOMATION_GRAPH_INVALID_ERROR_CODE) {
					return new AutomationsGraphInvalidException(errorReason, transformAutomationGraphIssues(lodashGet(error, 'error.details.issues', [])));
				}
			}

			return new AutomationsApiException(errorReason, status);
		};

		const generate = async (payload: IAutomationTemplatesGenerateActionPayload): Promise<IAutomationTemplateDraft> => {
			const parsedPayload = AutomationTemplatesGenerateActionPayloadSchema.safeParse(payload);

			if (!parsedPayload.success) {
				logger.error('Schema validation failed with:', parsedPayload.error);

				throw new AutomationsValidationException('Failed to generate an automation from the template.');
			}

			const { id, parameters } = parsedPayload.data;

			semaphore.value.generating.push(id);

			try {
				const {
					data: responseData,
					error,
					response,
				} = await backend.client.POST(`/${MODULES_PREFIX}/${AUTOMATIONS_MODULE_PREFIX}/templates/{id}/generate`, {
					params: { path: { id } },
					body: { data: { parameters } },
				});

				if (typeof responseData === 'undefined') {
					throw createGenerateException(error, response?.status ?? null);
				}

				return transformAutomationTemplateDraftResponse(responseData.data);
			} catch (e) {
				throw toApiException(e, 'Failed to generate an automation from the template.');
			} finally {
				semaphore.value.generating = semaphore.value.generating.filter((item) => item !== id);
			}
		};

		return {
			data,
			semaphore,
			firstLoad,
			firstLoadFinished,
			fetching,
			generating,
			findAll,
			findById,
			fetch,
			generate,
		};
	}
);

export const registerAutomationTemplatesStore = (
	pinia: Pinia
): Store<string, IAutomationTemplatesStoreState, object, IAutomationTemplatesStoreActions> => {
	return useAutomationTemplatesStore(pinia);
};
