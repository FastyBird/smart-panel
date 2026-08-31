import { z } from 'zod';

import { ConfigPluginEditFormSchema } from '../../../modules/config';
import {
	MAX_HOMEY_CONNECTION_TIMEOUT_MS,
	MAX_HOMEY_RECONCILIATION_INTERVAL_MS,
	MIN_HOMEY_CONNECTION_TIMEOUT_MS,
	MIN_HOMEY_RECONCILIATION_INTERVAL_MS,
} from '../devices-homey.constants';

import { isSafeHomeyUrl } from './homey-url.schemas';

export const isBlankHomeyApiKeyReplacement = (value: string | null | undefined): boolean => typeof value === 'string' && value.trim() === '';

export const HomeyConfigEditFormSchema = ConfigPluginEditFormSchema.extend({
	url: z.string().nullable().optional(),
	apiKey: z.string().nullable().optional(),
	apiKeyConfigured: z.boolean().optional(),
	connectionTimeout: z.coerce.number().int().min(MIN_HOMEY_CONNECTION_TIMEOUT_MS).max(MAX_HOMEY_CONNECTION_TIMEOUT_MS),
	reconciliationInterval: z.coerce.number().int().min(MIN_HOMEY_RECONCILIATION_INTERVAL_MS).max(MAX_HOMEY_RECONCILIATION_INTERVAL_MS),
})
	.superRefine((value, context) => {
		if (typeof value.url === 'string' && value.url.trim() !== '' && !isSafeHomeyUrl(value.url)) {
			context.addIssue({
				code: 'custom',
				path: ['url'],
				message: 'Homey URL must use HTTP or HTTPS without embedded credentials',
			});
		}

		if (isBlankHomeyApiKeyReplacement(value.apiKey)) {
			context.addIssue({
				code: 'custom',
				path: ['apiKey'],
				message: 'A Homey API key replacement must not be blank',
			});
		}
	})
	.overwrite((value) => ({
		...value,
		url: typeof value.url === 'string' && value.url.trim() === '' ? null : value.url,
	}));
