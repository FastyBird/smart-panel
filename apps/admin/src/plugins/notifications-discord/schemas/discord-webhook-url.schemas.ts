import { z } from 'zod';

export const isValidDiscordWebhookUrl = (value: string): boolean => {
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

export const DiscordWebhookUrlSchema = z.string().refine(isValidDiscordWebhookUrl, {
	message: 'Discord webhook URL must start with https://, without embedded credentials',
});
