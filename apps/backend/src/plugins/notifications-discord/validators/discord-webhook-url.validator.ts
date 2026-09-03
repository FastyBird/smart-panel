import { ValidateBy, ValidationOptions } from 'class-validator';

export const MAX_DISCORD_WEBHOOK_URL_LENGTH = 2048;

/** The only hostnames Discord serves incoming webhooks from. */
const DISCORD_WEBHOOK_HOSTNAMES = new Set(['discord.com', 'discordapp.com', 'ptb.discord.com', 'canary.discord.com']);

/**
 * `/api/webhooks/<numeric id>/<token>`, with an optional `/vN` API-version segment
 * (`/api/v10/webhooks/...`). This is the only path shape Discord serves incoming webhooks
 * under.
 */
const DISCORD_WEBHOOK_PATH_PATTERN = /^\/api\/(?:v\d+\/)?webhooks\/\d+\/[\w-]+\/?$/;

/**
 * Discord (like Slack and Telegram) rejects a non-`https:` webhook URL at config
 * validation - unlike the generic webhook plugin, there is no trusted-network exception,
 * because a Discord incoming-webhook URL is itself the only credential and must never
 * travel in cleartext.
 *
 * Beyond the scheme, the URL is restricted to Discord's own webhook hostnames and path
 * shape. Without this, `send()` would `fetch()` whatever HTTPS URL the administrator (or
 * a compromised admin session) configured - an open SSRF proxy from the server to any
 * internal or external HTTPS host, e.g. a cloud metadata endpoint. Rejecting userinfo and
 * a non-default port closes off the same class of confusable-URL trick used elsewhere in
 * this codebase's URL validators (`devices-homey`, `remote-access`).
 */
export const isValidDiscordWebhookUrl = (value: unknown): value is string => {
	if (typeof value !== 'string' || value.length === 0 || value.length > MAX_DISCORD_WEBHOOK_URL_LENGTH) {
		return false;
	}

	if (!value.startsWith('https://')) {
		return false;
	}

	try {
		const url = new URL(value);

		return (
			url.protocol === 'https:' &&
			url.username.length === 0 &&
			url.password.length === 0 &&
			url.port.length === 0 &&
			DISCORD_WEBHOOK_HOSTNAMES.has(url.hostname.toLowerCase()) &&
			DISCORD_WEBHOOK_PATH_PATTERN.test(url.pathname)
		);
	} catch {
		return false;
	}
};

export const IsValidDiscordWebhookUrl = (validationOptions?: ValidationOptions): PropertyDecorator =>
	ValidateBy(
		{
			name: 'isValidDiscordWebhookUrl',
			validator: {
				validate: isValidDiscordWebhookUrl,
				defaultMessage: () =>
					'Discord webhook URL must be an https://discord.com (or discordapp.com/ptb.discord.com/canary.discord.com) ' +
					'URL matching /api/webhooks/<id>/<token>, without embedded credentials or a port',
			},
		},
		validationOptions,
	);
