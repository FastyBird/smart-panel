import { ValidateBy, ValidationOptions } from 'class-validator';

export const MAX_DISCORD_WEBHOOK_URL_LENGTH = 2048;

/**
 * Discord (like Slack and Telegram) rejects a non-`https:` webhook URL at config
 * validation - unlike the generic webhook plugin, there is no trusted-network exception,
 * because a Discord incoming-webhook URL is itself the only credential and must never
 * travel in cleartext.
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

		return url.protocol === 'https:' && url.username.length === 0 && url.password.length === 0;
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
					`Discord webhook URL must start with https:// and be at most ${MAX_DISCORD_WEBHOOK_URL_LENGTH} characters without embedded credentials`,
			},
		},
		validationOptions,
	);
