import type { Ref } from 'vue';

import type { z } from 'zod';

import type {
	AutomationRunSchema,
	AutomationRunStepResultSchema,
	AutomationRunStepSchema,
	AutomationRunTraceSchema,
	AutomationRunTriggerSchema,
	AutomationRunsFetchActionPayloadSchema,
	AutomationRunsGetActionPayloadSchema,
	AutomationRunsOnEventActionPayloadSchema,
	AutomationRunsStateSemaphoreSchema,
	AutomationRunsTriggerActionPayloadSchema,
	AutomationRunsUnsetActionPayloadSchema,
	AutomationRuntimeProblemSchema,
	AutomationRuntimeSchema,
	AutomationTriggerResultSchema,
} from './runs.store.schemas';

export type IAutomationRunStepResult = z.infer<typeof AutomationRunStepResultSchema>;

export type IAutomationRunStep = z.infer<typeof AutomationRunStepSchema>;

export type IAutomationRunTrigger = z.infer<typeof AutomationRunTriggerSchema>;

export type IAutomationRunTrace = z.infer<typeof AutomationRunTraceSchema>;

export type IAutomationRun = z.infer<typeof AutomationRunSchema>;

export type IAutomationTriggerResult = z.infer<typeof AutomationTriggerResultSchema>;

export type IAutomationRuntimeProblem = z.infer<typeof AutomationRuntimeProblemSchema>;

export type IAutomationRuntime = z.infer<typeof AutomationRuntimeSchema>;

export type IAutomationRunsStateSemaphore = z.infer<typeof AutomationRunsStateSemaphoreSchema>;

export type IAutomationRunsFetchActionPayload = z.infer<typeof AutomationRunsFetchActionPayloadSchema>;

export type IAutomationRunsGetActionPayload = z.infer<typeof AutomationRunsGetActionPayloadSchema>;

export type IAutomationRunsTriggerActionPayload = z.infer<typeof AutomationRunsTriggerActionPayloadSchema>;

export type IAutomationRunsOnEventActionPayload = z.infer<typeof AutomationRunsOnEventActionPayloadSchema>;

export type IAutomationRunsUnsetActionPayload = z.infer<typeof AutomationRunsUnsetActionPayloadSchema>;

export interface IAutomationRunsStoreState {
	// The history of each automation read so far, newest first and without traces
	data: Ref<Map<IAutomationRun['automationId'], IAutomationRun[]>>;
	// The runs read on their own, with their traces
	traces: Ref<Map<IAutomationRun['id'], IAutomationRun>>;
	runtimes: Ref<Map<IAutomationRun['automationId'], IAutomationRuntime>>;
	semaphore: Ref<IAutomationRunsStateSemaphore>;
}

export interface IAutomationRunsStoreActions {
	// Getters
	firstLoadFinished: (automationId: IAutomationRun['automationId']) => boolean;
	fetching: (automationId: IAutomationRun['automationId']) => boolean;
	getting: (id: IAutomationRun['id']) => boolean;
	triggering: (automationId: IAutomationRun['automationId']) => boolean;
	findForAutomation: (automationId: IAutomationRun['automationId']) => IAutomationRun[];
	findById: (id: IAutomationRun['id']) => IAutomationRun | null;
	findRuntime: (automationId: IAutomationRun['automationId']) => IAutomationRuntime | null;
	// Actions
	fetch: (payload: IAutomationRunsFetchActionPayload) => Promise<IAutomationRun[]>;
	get: (payload: IAutomationRunsGetActionPayload) => Promise<IAutomationRun>;
	trigger: (payload: IAutomationRunsTriggerActionPayload) => Promise<IAutomationTriggerResult>;
	fetchRuntime: (payload: IAutomationRunsFetchActionPayload) => Promise<IAutomationRuntime>;
	onEvent: (payload: IAutomationRunsOnEventActionPayload) => IAutomationRun | null;
	unset: (payload: IAutomationRunsUnsetActionPayload) => void;
	reset: () => void;
	isLoaded: () => boolean;
	refresh: () => Promise<unknown>;
}

export interface IAutomationRunsStore extends IAutomationRunsStoreState, IAutomationRunsStoreActions {}
