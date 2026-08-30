import type { z } from 'zod';

import type {
	DevicesHomeyPluginInventoryAdoptionFilter,
	DevicesHomeyPluginInventoryAvailabilityFilter,
	DevicesHomeyPluginInventorySupportFilter,
} from '../../../openapi.constants';

import type {
	HomeyAdoptionResultSchema,
	HomeyCloudAuthorizationCompletionSchema,
	HomeyCloudAuthorizationStartSchema,
	HomeyCloudAuthorizationStatusSchema,
	HomeyCloudHomeyChoicesSchema,
	HomeyCloudPendingTransactionSchema,
	HomeyInventoryDeviceSchema,
	HomeyMappingPreviewSchema,
	HomeyStatusSchema,
	HomeyTestConnectionSchema,
} from './homey.schemas';

export type IHomeyStatus = z.infer<typeof HomeyStatusSchema>;
export type IHomeyTestConnection = z.infer<typeof HomeyTestConnectionSchema>;
export type IHomeyCloudAuthorizationStart = z.infer<typeof HomeyCloudAuthorizationStartSchema>;
export type IHomeyCloudAuthorizationStatus = z.infer<typeof HomeyCloudAuthorizationStatusSchema>;
export type IHomeyCloudHomeyChoices = z.infer<typeof HomeyCloudHomeyChoicesSchema>;
export type IHomeyCloudAuthorizationCompletion = z.infer<typeof HomeyCloudAuthorizationCompletionSchema>;
export type IHomeyCloudPendingTransaction = z.infer<typeof HomeyCloudPendingTransactionSchema>;
export type IHomeyInventoryDevice = z.infer<typeof HomeyInventoryDeviceSchema>;
export type IHomeyMappingPreview = z.infer<typeof HomeyMappingPreviewSchema>;
export type IHomeyAdoptionResult = z.infer<typeof HomeyAdoptionResultSchema>;

export interface IHomeyInventoryFilters {
	support?: DevicesHomeyPluginInventorySupportFilter;
	adoption?: DevicesHomeyPluginInventoryAdoptionFilter;
	availability?: DevicesHomeyPluginInventoryAvailabilityFilter;
	zoneId?: string;
	class?: string;
	search?: string;
}

export interface IHomeyAdoptSelection {
	deviceId: string;
	deviceCategory?: IHomeyInventoryDevice['suggestedCategory'];
	name?: string;
}
