import { z } from 'zod';

import { ConfigPluginEditFormSchema } from '../../../modules/config';
import { DevicesHomeyPluginConnectionMode } from '../../../openapi.constants';
import {
	MAX_HOMEY_CLOUD_CLIENT_VALUE_LENGTH,
	MAX_HOMEY_CONNECTION_TIMEOUT_MS,
	MAX_HOMEY_RECONCILIATION_INTERVAL_MS,
	MIN_HOMEY_CONNECTION_TIMEOUT_MS,
	MIN_HOMEY_RECONCILIATION_INTERVAL_MS,
} from '../devices-homey.constants';

import { isSafeHomeyCloudRedirectUrl } from './homey-cloud-redirect-url.schemas';
import { isSafeHomeyUrl } from './homey-url.schemas';

export const isBlankHomeyApiKeyReplacement = (value: string | null | undefined): boolean => typeof value === 'string' && value.trim() === '';

export const isBlankHomeyCloudClientSecretReplacement = (value: string | null | undefined): boolean =>
	typeof value === 'string' && value.trim() === '';

export const HomeyConfigEditFormSchema = ConfigPluginEditFormSchema.extend({
	mode: z.nativeEnum(DevicesHomeyPluginConnectionMode),
	url: z.string().nullable().optional(),
	apiKey: z.string().nullable().optional(),
	apiKeyConfigured: z.boolean().optional(),
	cloudClientId: z.string().nullable().optional(),
	cloudClientSecret: z.string().nullable().optional(),
	cloudClientSecretConfigured: z.boolean().optional(),
	cloudRedirectUrl: z.string().nullable().optional(),
	connectionTimeout: z.coerce.number().int().min(MIN_HOMEY_CONNECTION_TIMEOUT_MS).max(MAX_HOMEY_CONNECTION_TIMEOUT_MS),
	reconciliationInterval: z.coerce.number().int().min(MIN_HOMEY_RECONCILIATION_INTERVAL_MS).max(MAX_HOMEY_RECONCILIATION_INTERVAL_MS),
})
	.superRefine((value, context) => {
		if (
			value.mode === DevicesHomeyPluginConnectionMode.local &&
			typeof value.url === 'string' &&
			value.url.trim() !== '' &&
			!isSafeHomeyUrl(value.url)
		) {
			context.addIssue({ code: 'custom', path: ['url'], message: 'Homey URL must use HTTP or HTTPS without embedded credentials' });
		}

		if (value.mode === DevicesHomeyPluginConnectionMode.local && isBlankHomeyApiKeyReplacement(value.apiKey)) {
			context.addIssue({ code: 'custom', path: ['apiKey'], message: 'A Homey API key replacement must not be blank' });
		}

		if (value.mode === DevicesHomeyPluginConnectionMode.cloud) {
			if (
				typeof value.cloudClientId === 'string' &&
				value.cloudClientId.trim() !== '' &&
				value.cloudClientId.length > MAX_HOMEY_CLOUD_CLIENT_VALUE_LENGTH
			) {
				context.addIssue({ code: 'custom', path: ['cloudClientId'], message: 'The Homey Cloud client ID is too long' });
			}

			if (isBlankHomeyCloudClientSecretReplacement(value.cloudClientSecret)) {
				context.addIssue({ code: 'custom', path: ['cloudClientSecret'], message: 'A Homey Cloud client secret replacement must not be blank' });
			} else if (typeof value.cloudClientSecret === 'string' && value.cloudClientSecret.length > MAX_HOMEY_CLOUD_CLIENT_VALUE_LENGTH) {
				context.addIssue({ code: 'custom', path: ['cloudClientSecret'], message: 'The Homey Cloud client secret is too long' });
			}

			if (
				typeof value.cloudRedirectUrl === 'string' &&
				value.cloudRedirectUrl.trim() !== '' &&
				!isSafeHomeyCloudRedirectUrl(value.cloudRedirectUrl)
			) {
				context.addIssue({ code: 'custom', path: ['cloudRedirectUrl'], message: 'Enter the exact registered Homey Cloud callback URL' });
			}
		}
	})
	.overwrite((value) =>
		value.mode === DevicesHomeyPluginConnectionMode.cloud
			? {
					...value,
					url: undefined,
					apiKey: undefined,
					cloudClientId: typeof value.cloudClientId === 'string' && value.cloudClientId.trim() === '' ? null : value.cloudClientId,
					cloudRedirectUrl: typeof value.cloudRedirectUrl === 'string' && value.cloudRedirectUrl.trim() === '' ? null : value.cloudRedirectUrl,
				}
			: {
					...value,
					url: typeof value.url === 'string' && value.url.trim() === '' ? null : value.url,
					cloudClientId: undefined,
					cloudClientSecret: undefined,
					cloudRedirectUrl: undefined,
				}
	);
