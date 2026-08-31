import type { z } from 'zod';

import type {
	DevicesHomeyPluginInventoryAdoptionFilter,
	DevicesHomeyPluginInventoryAvailabilityFilter,
	DevicesHomeyPluginInventorySupportFilter,
} from '../../../openapi.constants';

import type {
	HomeyAdoptionResultSchema,
	HomeyInventoryDeviceSchema,
	HomeyMappingPreviewSchema,
	HomeyStatusSchema,
	HomeyTestConnectionSchema,
} from './homey.schemas';

export type IHomeyStatus = z.infer<typeof HomeyStatusSchema>;
export type IHomeyTestConnection = z.infer<typeof HomeyTestConnectionSchema>;
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
