import { z } from 'zod';

export const isValidWebhookUrl = (value: string): boolean => {
	try {
		const url = new URL(value);

		return (url.protocol === 'http:' || url.protocol === 'https:') && url.username === '' && url.password === '';
	} catch {
		return false;
	}
};

export const WebhookUrlSchema = z.string().refine(isValidWebhookUrl, {
	message: 'Webhook URL must use HTTP or HTTPS without embedded credentials',
});
