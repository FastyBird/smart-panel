import type { Ref } from 'vue';

import type { z } from 'zod';

import type {
	AutomationCreateReqSchema,
	AutomationGraphEdgeSchema,
	AutomationGraphIssueSchema,
	AutomationGraphNodeSchema,
	AutomationGraphSchema,
	AutomationGraphValidationSchema,
	AutomationResSchema,
	AutomationSchema,
	AutomationSummaryResSchema,
	AutomationUpdateReqSchema,
	AutomationsAddActionPayloadSchema,
	AutomationsEditActionPayloadSchema,
	AutomationsGetActionPayloadSchema,
	AutomationsOnEventActionPayloadSchema,
	AutomationsRemoveActionPayloadSchema,
	AutomationsSetActionPayloadSchema,
	AutomationsStateSemaphoreSchema,
	AutomationsUnsetActionPayloadSchema,
	AutomationsValidateActionPayloadSchema,
} from './automations.store.schemas';

export type IAutomation = z.infer<typeof AutomationSchema>;

export type IAutomationGraph = z.infer<typeof AutomationGraphSchema>;

export type IAutomationGraphNode = z.infer<typeof AutomationGraphNodeSchema>;

export type IAutomationGraphEdge = z.infer<typeof AutomationGraphEdgeSchema>;

export type IAutomationGraphIssue = z.infer<typeof AutomationGraphIssueSchema>;

export type IAutomationGraphValidation = z.infer<typeof AutomationGraphValidationSchema>;

export type IAutomationsStateSemaphore = z.infer<typeof AutomationsStateSemaphoreSchema>;

export type IAutomationsOnEventActionPayload = z.infer<typeof AutomationsOnEventActionPayloadSchema>;

export type IAutomationsSetActionPayload = z.input<typeof AutomationsSetActionPayloadSchema>;

export type IAutomationsUnsetActionPayload = z.infer<typeof AutomationsUnsetActionPayloadSchema>;

export type IAutomationsGetActionPayload = z.infer<typeof AutomationsGetActionPayloadSchema>;

export type IAutomationsAddActionPayload = z.input<typeof AutomationsAddActionPayloadSchema>;

export type IAutomationsEditActionPayload = z.input<typeof AutomationsEditActionPayloadSchema>;

export type IAutomationsRemoveActionPayload = z.infer<typeof AutomationsRemoveActionPayloadSchema>;

export type IAutomationsValidateActionPayload = z.infer<typeof AutomationsValidateActionPayloadSchema>;

export type IAutomationCreateReq = z.infer<typeof AutomationCreateReqSchema>;

export type IAutomationUpdateReq = z.infer<typeof AutomationUpdateReqSchema>;

export type IAutomationSummaryRes = z.infer<typeof AutomationSummaryResSchema>;

export type IAutomationRes = z.infer<typeof AutomationResSchema>;

export interface IAutomationsStoreState {
	data: Ref<Map<IAutomation['id'], IAutomation>>;
	semaphore: Ref<IAutomationsStateSemaphore>;
	firstLoad: Ref<boolean>;
}

export interface IAutomationsStoreActions {
	// Getters
	firstLoadFinished: () => boolean;
	getting: (id: IAutomation['id']) => boolean;
	fetching: () => boolean;
	findAll: () => IAutomation[];
	findById: (id: IAutomation['id']) => IAutomation | null;
	findBySpace: (spaceId: IAutomation['spaceId']) => IAutomation[];
	// Actions
	onEvent: (payload: IAutomationsOnEventActionPayload) => IAutomation;
	set: (payload: IAutomationsSetActionPayload) => IAutomation;
	unset: (payload: IAutomationsUnsetActionPayload) => void;
	unsetAll: () => void;
	reset: () => Promise<unknown>;
	get: (payload: IAutomationsGetActionPayload) => Promise<IAutomation>;
	fetch: () => Promise<IAutomation[]>;
	add: (payload: IAutomationsAddActionPayload) => Promise<IAutomation>;
	edit: (payload: IAutomationsEditActionPayload) => Promise<IAutomation>;
	remove: (payload: IAutomationsRemoveActionPayload) => Promise<void>;
	validate: (payload: IAutomationsValidateActionPayload) => Promise<IAutomationGraphValidation>;
	isLoaded: () => boolean;
	refresh: () => Promise<unknown>;
}

export interface IAutomationsStore extends IAutomationsStoreState, IAutomationsStoreActions {}
