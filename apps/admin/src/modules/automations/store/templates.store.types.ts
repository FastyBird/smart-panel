import type { Ref } from 'vue';

import type { z } from 'zod';

import type {
	AutomationTemplateDraftResSchema,
	AutomationTemplateDraftSchema,
	AutomationTemplateIssueSchema,
	AutomationTemplateParameterResSchema,
	AutomationTemplateParameterSchema,
	AutomationTemplateResSchema,
	AutomationTemplateSchema,
	AutomationTemplatesGenerateActionPayloadSchema,
	AutomationTemplatesStateSemaphoreSchema,
} from './templates.store.schemas';

export type IAutomationTemplate = z.infer<typeof AutomationTemplateSchema>;

export type IAutomationTemplateParameter = z.infer<typeof AutomationTemplateParameterSchema>;

export type IAutomationTemplateDraft = z.infer<typeof AutomationTemplateDraftSchema>;

export type IAutomationTemplateIssue = z.infer<typeof AutomationTemplateIssueSchema>;

export type IAutomationTemplatesStateSemaphore = z.infer<typeof AutomationTemplatesStateSemaphoreSchema>;

export type IAutomationTemplatesGenerateActionPayload = z.infer<typeof AutomationTemplatesGenerateActionPayloadSchema>;

export type IAutomationTemplateRes = z.infer<typeof AutomationTemplateResSchema>;

export type IAutomationTemplateParameterRes = z.infer<typeof AutomationTemplateParameterResSchema>;

export type IAutomationTemplateDraftRes = z.infer<typeof AutomationTemplateDraftResSchema>;

export interface IAutomationTemplatesStoreState {
	data: Ref<IAutomationTemplate[]>;
	semaphore: Ref<IAutomationTemplatesStateSemaphore>;
	firstLoad: Ref<boolean>;
}

export interface IAutomationTemplatesStoreActions {
	// Getters
	firstLoadFinished: () => boolean;
	fetching: () => boolean;
	generating: (id: IAutomationTemplate['id']) => boolean;
	findAll: () => IAutomationTemplate[];
	findById: (id: IAutomationTemplate['id']) => IAutomationTemplate | null;
	// Actions
	fetch: () => Promise<IAutomationTemplate[]>;
	generate: (payload: IAutomationTemplatesGenerateActionPayload) => Promise<IAutomationTemplateDraft>;
}

export interface IAutomationTemplatesStore extends IAutomationTemplatesStoreState, IAutomationTemplatesStoreActions {}
