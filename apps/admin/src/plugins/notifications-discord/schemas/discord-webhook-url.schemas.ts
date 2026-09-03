import { z } from 'zod';

/** The only hostnames Discord serves incoming webhooks from. */
const DISCORD_WEBHOOK_HOSTNAMES = new Set(['discord.com', 'discordapp.com', 'ptb.discord.com', 'canary.discord.com']);

/**
 * `/api/webhooks/<numeric id>/<token>`, with an optional `/vN` API-version segment
 * (`/api/v10/webhooks/...`). Mirrors the backend's `discord-webhook-url.validator.ts`.
 */
const DISCORD_WEBHOOK_PATH_PATTERN = /^\/api\/(?:v\d+\/)?webhooks\/\d+\/[\w-]+\/?$/;

/**
 * Restricted to Discord's own webhook hostnames and path shape, not just `https:` - an
 * unrestricted host would let the field act as an open SSRF proxy from the server to any
 * HTTPS host the administrator (or a compromised admin session) configured.
 */
export const isValidDiscordWebhookUrl = (value: string): boolean => {
	if (!value.startsWith('https://')) {
		return false;
	}

	try {
		const url = new URL(value);

		return (
			url.protocol === 'https:' &&
			url.username === '' &&
			url.password === '' &&
			url.port === '' &&
			DISCORD_WEBHOOK_HOSTNAMES.has(url.hostname.toLowerCase()) &&
			DISCORD_WEBHOOK_PATH_PATTERN.test(url.pathname)
		);
	} catch {
		return false;
	}
};

export const DiscordWebhookUrlSchema = z.string().refine(isValidDiscordWebhookUrl, {
	message:
		'Discord webhook URL must be an https://discord.com (or discordapp.com/ptb.discord.com/canary.discord.com) URL matching /api/webhooks/<id>/<token>, without embedded credentials or a port',
});
