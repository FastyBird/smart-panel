import { z } from 'zod';

import { ConfigPluginEditFormSchema } from '../../../modules/config';
import {
	MAX_HOMEY_CONNECTION_TIMEOUT_MS,
	MAX_HOMEY_RECONCILIATION_INTERVAL_MS,
	MIN_HOMEY_CONNECTION_TIMEOUT_MS,
	MIN_HOMEY_RECONCILIATION_INTERVAL_MS,
} from '../devices-homey.constants';

import { HomeyUrlSchema } from './homey-url.schemas';

export const HomeyConfigEditFormSchema = ConfigPluginEditFormSchema.extend({
	url: HomeyUrlSchema.nullable().optional(),
	apiKey: z.string().nullable().optional(),
	apiKeyConfigured: z.boolean().optional(),
	connectionTimeout: z.coerce.number().int().min(MIN_HOMEY_CONNECTION_TIMEOUT_MS).max(MAX_HOMEY_CONNECTION_TIMEOUT_MS),
	reconciliationInterval: z.coerce.number().int().min(MIN_HOMEY_RECONCILIATION_INTERVAL_MS).max(MAX_HOMEY_RECONCILIATION_INTERVAL_MS),
});
