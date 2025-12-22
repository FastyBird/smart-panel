import type { Ref } from 'vue';

import type { Store } from 'pinia';

import { z } from 'zod';

import {
	DeviceValidationResultResSchema,
	DeviceValidationResultSchema,
	DevicesValidationResSchema,
	DevicesValidationSchema,
	DevicesValidationStateSemaphoreSchema,
	ValidationIssueResSchema,
	ValidationIssueSchema,
	ValidationSummaryResSchema,
	ValidationSummarySchema,
} from './devices.validation.store.schemas';

// STORE STATE
// ===========

export type IValidationIssue = z.infer<typeof ValidationIssueSchema>;

export type IDeviceValidationResult = z.infer<typeof DeviceValidationResultSchema>;

export type IValidationSummary = z.infer<typeof ValidationSummarySchema>;

export type IDevicesValidation = z.infer<typeof DevicesValidationSchema>;

export type IDevicesValidationStateSemaphore = z.infer<typeof DevicesValidationStateSemaphoreSchema>;

// STORE ACTIONS
// =============

export interface IDevicesValidationGetActionPayload {
	id: string;
}

// STORE
// =====

export interface IDevicesValidationStoreState {
	semaphore: Ref<IDevicesValidationStateSemaphore>;
	firstLoad: Ref<boolean>;
	data: Ref<IDevicesValidation | null>;
}

export interface IDevicesValidationStoreActions {
	// Getters
	firstLoadFinished: () => boolean;
	fetching: () => boolean;
	getting: (id: string) => boolean;
	findAll: () => IDeviceValidationResult[];
	findById: (deviceId: string) => IDeviceValidationResult | null;
	// Actions
	fetch: () => Promise<IDevicesValidation>;
	get: (payload: IDevicesValidationGetActionPayload) => Promise<IDeviceValidationResult>;
	clear: () => void;
}

export type DevicesValidationStoreSetup = IDevicesValidationStoreState & IDevicesValidationStoreActions;

// BACKEND API
// ===========

export type IValidationIssueRes = z.infer<typeof ValidationIssueResSchema>;

export type IDeviceValidationResultRes = z.infer<typeof DeviceValidationResultResSchema>;

export type IValidationSummaryRes = z.infer<typeof ValidationSummaryResSchema>;

export type IDevicesValidationRes = z.infer<typeof DevicesValidationResSchema>;

// STORE
export type DevicesValidationStore = Store<string, IDevicesValidationStoreState, object, IDevicesValidationStoreActions>;
