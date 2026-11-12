import type { Ref } from 'vue';

import type { z } from 'zod';

import type {
	AutomationNodeTypePortsSchema,
	AutomationNodeTypeResSchema,
	AutomationNodeTypeSchema,
	AutomationNodeTypesStateSemaphoreSchema,
} from './node-types.store.schemas';

export type IAutomationNodeType = z.infer<typeof AutomationNodeTypeSchema>;

export type IAutomationNodeTypePorts = z.infer<typeof AutomationNodeTypePortsSchema>;

export type IAutomationNodeTypesStateSemaphore = z.infer<typeof AutomationNodeTypesStateSemaphoreSchema>;

export type IAutomationNodeTypeRes = z.infer<typeof AutomationNodeTypeResSchema>;

export type AutomationNodeTypeLookup = (type: IAutomationNodeType['type']) => IAutomationNodeType | null;

export interface IAutomationNodeTypesStoreState {
	data: Ref<Map<IAutomationNodeType['type'], IAutomationNodeType>>;
	semaphore: Ref<IAutomationNodeTypesStateSemaphore>;
	firstLoad: Ref<boolean>;
}

export interface IAutomationNodeTypesStoreActions {
	// Getters
	firstLoadFinished: () => boolean;
	fetching: () => boolean;
	findAll: () => IAutomationNodeType[];
	findByType: AutomationNodeTypeLookup;
	// Actions
	fetch: () => Promise<IAutomationNodeType[]>;
	isLoaded: () => boolean;
	refresh: () => Promise<unknown>;
}

export interface IAutomationNodeTypesStore extends IAutomationNodeTypesStoreState, IAutomationNodeTypesStoreActions {}
