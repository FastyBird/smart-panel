import { ref } from 'vue';

import { type Pinia, type Store, defineStore } from 'pinia';

import { get as lodashGet } from 'lodash';

import { MODULES_PREFIX } from '../../../app.constants';
import { getErrorCode, getErrorReason, useBackend, useLogger } from '../../../common';
import type { AutomationsModuleExportAutomationOperation, AutomationsModulePrepareImportOperation } from '../../../openapi.constants';
import { AUTOMATIONS_MODULE_PREFIX, AUTOMATION_GRAPH_INVALID_ERROR_CODE, AUTOMATION_IMPORT_INVALID_ERROR_CODE } from '../automations.constants';
import {
	AutomationsApiException,
	AutomationsException,
	AutomationsGraphInvalidException,
	AutomationsImportInvalidException,
	AutomationsValidationException,
} from '../automations.exceptions';

import { transformAutomationGraphIssues } from './automations.transformers';
import { AutomationTransferExportActionPayloadSchema, AutomationTransferPrepareActionPayloadSchema } from './transfer.store.schemas';
import type {
	IAutomationExport,
	IAutomationImportPreparation,
	IAutomationTransferExportActionPayload,
	IAutomationTransferPrepareActionPayload,
	IAutomationTransferStateSemaphore,
	IAutomationTransferStoreActions,
	IAutomationTransferStoreState,
} from './transfer.store.types';
import {
	transformAutomationExportResponse,
	transformAutomationImportIssues,
	transformAutomationImportPreparationResponse,
} from './transfer.transformers';

export type AutomationTransferStoreSetup = IAutomationTransferStoreState & IAutomationTransferStoreActions;

type ApiErrorEnvelope = Parameters<typeof getErrorReason<AutomationsModulePrepareImportOperation>>[0];

const toApiException = (error: unknown, message: string): AutomationsException => {
	return error instanceof AutomationsException ? error : new AutomationsApiException(message, null, error as Error);
};

/**
 * Automations as YAML files: the export of one automation and the preparation of an import. The backend owns the
 * format; nothing here is stored, and an imported automation is created through the automations store like any other.
 */
export const useAutomationTransferStore = defineStore<'automations_module-transfer', AutomationTransferStoreSetup>(
	'automations_module-transfer',
	(): AutomationTransferStoreSetup => {
		const backend = useBackend();
		const logger = useLogger();

		const semaphore = ref<IAutomationTransferStateSemaphore>({ exporting: [], preparing: false });

		const exporting = (id: string): boolean => semaphore.value.exporting.includes(id);

		const preparing = (): boolean => semaphore.value.preparing;

		const exportYaml = async (payload: IAutomationTransferExportActionPayload): Promise<IAutomationExport> => {
			const parsedPayload = AutomationTransferExportActionPayloadSchema.safeParse(payload);

			if (!parsedPayload.success) {
				logger.error('Schema validation failed with:', parsedPayload.error);

				throw new AutomationsValidationException('Failed to export the automation.');
			}

			const { id } = parsedPayload.data;

			semaphore.value.exporting.push(id);

			try {
				const {
					data: responseData,
					error,
					response,
				} = await backend.client.GET(`/${MODULES_PREFIX}/${AUTOMATIONS_MODULE_PREFIX}/automations/{id}/export`, {
					params: { path: { id } },
				});

				if (typeof responseData === 'undefined') {
					let errorReason: string = 'Failed to export the automation.';

					if (error) {
						errorReason = getErrorReason<AutomationsModuleExportAutomationOperation>(error, errorReason);
					}

					throw new AutomationsApiException(errorReason, response?.status ?? null);
				}

				return transformAutomationExportResponse(responseData.data);
			} catch (e) {
				throw toApiException(e, 'Failed to export the automation.');
			} finally {
				semaphore.value.exporting = semaphore.value.exporting.filter((item) => item !== id);
			}
		};

		/**
		 * Tells apart the refusals a caller can show where they belong: a file the backend could not read as an
		 * automation and a graph it would not save. Everything else is a plain API failure.
		 */
		const createPrepareException = (error: unknown, status: number | null): AutomationsApiException => {
			const message = 'Failed to read the automation file.';

			const envelope = error as ApiErrorEnvelope;

			const errorReason = error ? getErrorReason<AutomationsModulePrepareImportOperation>(envelope, message) : message;

			if (status === 422 && error) {
				const code = getErrorCode<AutomationsModulePrepareImportOperation>(envelope);

				if (code === AUTOMATION_IMPORT_INVALID_ERROR_CODE) {
					return new AutomationsImportInvalidException(errorReason, transformAutomationImportIssues(lodashGet(error, 'error.details.issues', [])));
				}

				if (code === AUTOMATION_GRAPH_INVALID_ERROR_CODE) {
					return new AutomationsGraphInvalidException(errorReason, transformAutomationGraphIssues(lodashGet(error, 'error.details.issues', [])));
				}
			}

			return new AutomationsApiException(errorReason, status);
		};

		const prepareImport = async (payload: IAutomationTransferPrepareActionPayload): Promise<IAutomationImportPreparation> => {
			const parsedPayload = AutomationTransferPrepareActionPayloadSchema.safeParse(payload);

			if (!parsedPayload.success) {
				logger.error('Schema validation failed with:', parsedPayload.error);

				throw new AutomationsValidationException('Failed to read the automation file.');
			}

			const { yaml, mappings } = parsedPayload.data;

			semaphore.value.preparing = true;

			try {
				const {
					data: responseData,
					error,
					response,
				} = await backend.client.POST(`/${MODULES_PREFIX}/${AUTOMATIONS_MODULE_PREFIX}/automations/import/prepare`, {
					body: { data: { yaml, ...(mappings && mappings.length > 0 ? { mappings } : {}) } },
				});

				if (typeof responseData === 'undefined') {
					throw createPrepareException(error, response?.status ?? null);
				}

				return transformAutomationImportPreparationResponse(responseData.data);
			} catch (e) {
				throw toApiException(e, 'Failed to read the automation file.');
			} finally {
				semaphore.value.preparing = false;
			}
		};

		return {
			semaphore,
			exporting,
			preparing,
			exportYaml,
			prepareImport,
		};
	}
);

export const registerAutomationTransferStore = (
	pinia: Pinia
): Store<string, IAutomationTransferStoreState, object, IAutomationTransferStoreActions> => {
	return useAutomationTransferStore(pinia);
};
