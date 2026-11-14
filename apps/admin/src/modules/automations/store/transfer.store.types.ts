import type { Ref } from 'vue';

import type { z } from 'zod';

import type {
	AutomationExportResSchema,
	AutomationExportSchema,
	AutomationImportDraftSchema,
	AutomationImportIssueSchema,
	AutomationImportMissingReferenceSchema,
	AutomationImportPreparationResSchema,
	AutomationImportPreparationSchema,
	AutomationImportReferenceMappingSchema,
	AutomationImportReferenceUsageSchema,
	AutomationTransferExportActionPayloadSchema,
	AutomationTransferPrepareActionPayloadSchema,
	AutomationTransferStateSemaphoreSchema,
} from './transfer.store.schemas';

export type IAutomationExport = z.infer<typeof AutomationExportSchema>;

export type IAutomationImportReferenceUsage = z.infer<typeof AutomationImportReferenceUsageSchema>;

export type IAutomationImportMissingReference = z.infer<typeof AutomationImportMissingReferenceSchema>;

export type IAutomationImportDraft = z.infer<typeof AutomationImportDraftSchema>;

export type IAutomationImportPreparation = z.infer<typeof AutomationImportPreparationSchema>;

export type IAutomationImportIssue = z.infer<typeof AutomationImportIssueSchema>;

export type IAutomationImportReferenceMapping = z.infer<typeof AutomationImportReferenceMappingSchema>;

export type IAutomationTransferStateSemaphore = z.infer<typeof AutomationTransferStateSemaphoreSchema>;

export type IAutomationTransferExportActionPayload = z.infer<typeof AutomationTransferExportActionPayloadSchema>;

export type IAutomationTransferPrepareActionPayload = z.infer<typeof AutomationTransferPrepareActionPayloadSchema>;

export type IAutomationExportRes = z.infer<typeof AutomationExportResSchema>;

export type IAutomationImportPreparationRes = z.infer<typeof AutomationImportPreparationResSchema>;

export interface IAutomationTransferStoreState {
	semaphore: Ref<IAutomationTransferStateSemaphore>;
}

export interface IAutomationTransferStoreActions {
	// Getters
	exporting: (id: string) => boolean;
	preparing: () => boolean;
	// Actions
	exportYaml: (payload: IAutomationTransferExportActionPayload) => Promise<IAutomationExport>;
	prepareImport: (payload: IAutomationTransferPrepareActionPayload) => Promise<IAutomationImportPreparation>;
}

export interface IAutomationTransferStore extends IAutomationTransferStoreState, IAutomationTransferStoreActions {}
