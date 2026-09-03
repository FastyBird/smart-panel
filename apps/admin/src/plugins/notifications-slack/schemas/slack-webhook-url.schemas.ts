import { z } from 'zod';

export const isValidSlackWebhookUrl = (value: string): boolean => {
	if (!value.startsWith('https://')) {
		return false;
	}

	try {
		const url = new URL(value);

		return url.protocol === 'https:' && url.username === '' && url.password === '';
	} catch {
		return false;
	}
};

export const SlackWebhookUrlSchema = z.string().refine(isValidSlackWebhookUrl, {
	message: 'Slack webhook URL must start with https://, without embedded credentials',
});
