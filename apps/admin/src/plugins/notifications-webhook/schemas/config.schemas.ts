import { z } from 'zod';

import { ConfigPluginEditFormSchema } from '../../../modules/config';

import { isValidHeadersJson } from './webhook-headers.schemas';
import { isValidWebhookUrl } from './webhook-url.schemas';

export const WebhookConfigEditFormSchema = ConfigPluginEditFormSchema.extend({
	// Absent or blank keeps the stored URL and null removes it. The backend never sends the URL
	// back, so the field always starts blank - which is why removing one needs a gesture of its
	// own rather than just clearing the input.
	url: z.string().nullable().optional(),
	// What the backend answers with in place of the URL. Declared so the form knows whether
	// there is anything to remove; the update request schema drops it again.
	urlConfigured: z.boolean().optional(),
	// Same absent/blank/null contract as `url`, but the value is raw JSON text - the only shape
	// a `ConfigSecretInput` textarea can hold - parsed into an object at the wire boundary.
	headers: z.string().nullable().optional(),
	headersConfigured: z.boolean().optional(),
	minSeverity: z.enum(['info', 'warning', 'error', 'critical']),
}).superRefine((value, context) => {
	if (typeof value.url === 'string' && value.url.trim() !== '' && !isValidWebhookUrl(value.url)) {
		context.addIssue({
			code: 'custom',
			path: ['url'],
			message: 'Webhook URL must use HTTP or HTTPS without embedded credentials',
		});
	}

	if (typeof value.headers === 'string' && value.headers.trim() !== '' && !isValidHeadersJson(value.headers)) {
		context.addIssue({
			code: 'custom',
			path: ['headers'],
			message: 'Headers must be a flat JSON object of string values',
		});
	}

	const submittedUrlIsHttp = typeof value.url === 'string' && value.url.trim().toLowerCase().startsWith('http://');
	const submittedHeaders = typeof value.headers === 'string' && value.headers.trim() !== '';

	if (submittedUrlIsHttp && submittedHeaders) {
		context.addIssue({
			code: 'custom',
			path: ['headers'],
			message: 'Custom headers require an HTTPS webhook URL',
		});
	}
});
