import { ValidateBy, ValidationOptions } from 'class-validator';

export const MAX_SLACK_WEBHOOK_URL_LENGTH = 2048;

/**
 * Slack (like Discord and Telegram) rejects a non-`https:` webhook URL at config validation -
 * unlike the generic webhook plugin, there is no trusted-network exception, because a Slack
 * incoming-webhook URL is itself the only credential and must never travel in cleartext.
 */
export const isValidSlackWebhookUrl = (value: unknown): value is string => {
	if (typeof value !== 'string' || value.length === 0 || value.length > MAX_SLACK_WEBHOOK_URL_LENGTH) {
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

export const IsValidSlackWebhookUrl = (validationOptions?: ValidationOptions): PropertyDecorator =>
	ValidateBy(
		{
			name: 'isValidSlackWebhookUrl',
			validator: {
				validate: isValidSlackWebhookUrl,
				defaultMessage: () =>
					`Slack webhook URL must start with https:// and be at most ${MAX_SLACK_WEBHOOK_URL_LENGTH} characters without embedded credentials`,
			},
		},
		validationOptions,
	);
