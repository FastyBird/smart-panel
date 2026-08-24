import { z } from 'zod';

import { ConfigPluginEditFormSchema } from '../../../modules/config';
import {
	MAX_HOMEY_CONNECTION_TIMEOUT_MS,
	MAX_HOMEY_RECONCILIATION_INTERVAL_MS,
	MIN_HOMEY_CONNECTION_TIMEOUT_MS,
	MIN_HOMEY_RECONCILIATION_INTERVAL_MS,
} from '../devices-homey.constants';

import { HomeyUrlSchema } from './homey-url.schemas';

export const hasUsableHomeyApiKey = (value: string | null | undefined, configured: boolean | undefined): boolean =>
	(typeof value === 'string' && value.trim() !== '') || (value === undefined && configured === true);

export const HomeyConfigEditFormSchema = ConfigPluginEditFormSchema.extend({
	url: HomeyUrlSchema.nullable().optional(),
	apiKey: z.string().nullable().optional(),
	apiKeyConfigured: z.boolean().optional(),
	connectionTimeout: z.coerce.number().int().min(MIN_HOMEY_CONNECTION_TIMEOUT_MS).max(MAX_HOMEY_CONNECTION_TIMEOUT_MS),
	reconciliationInterval: z.coerce.number().int().min(MIN_HOMEY_RECONCILIATION_INTERVAL_MS).max(MAX_HOMEY_RECONCILIATION_INTERVAL_MS),
}).superRefine((value, context) => {
	if (value.enabled && !hasUsableHomeyApiKey(value.apiKey, value.apiKeyConfigured)) {
		context.addIssue({ code: 'custom', path: ['apiKey'], message: 'A Homey API key is required when the plugin is enabled' });
	}
});
