import { z } from 'zod';

import { ConfigPluginEditFormSchema } from '../../../modules/config';

import { isValidSlackWebhookUrl } from './slack-webhook-url.schemas';

export const SlackConfigEditFormSchema = ConfigPluginEditFormSchema.extend({
	// Absent or blank keeps the stored webhook URL and null removes it. The backend never sends
	// the URL back, so the field always starts blank - which is why removing one needs a
	// gesture of its own rather than just clearing the input.
	webhookUrl: z.string().nullable().optional(),
	// What the backend answers with in place of the URL. Declared so the form knows whether
	// there is anything to remove; the update request schema drops it again.
	webhookUrlConfigured: z.boolean().optional(),
	minSeverity: z.enum(['info', 'warning', 'error', 'critical']),
}).superRefine((value, context) => {
	if (typeof value.webhookUrl === 'string' && value.webhookUrl.trim() !== '' && !isValidSlackWebhookUrl(value.webhookUrl)) {
		context.addIssue({
			code: 'custom',
			path: ['webhookUrl'],
			message: 'Slack webhook URL must start with https:// and must not embed credentials',
		});
	}
});
