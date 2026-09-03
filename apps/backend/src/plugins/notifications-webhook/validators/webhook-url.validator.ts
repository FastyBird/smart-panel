import { ValidateBy, ValidationOptions } from 'class-validator';

export const MAX_WEBHOOK_URL_LENGTH = 2048;

/**
 * A generic webhook target: an absolute `http:` or `https:` URL, without embedded
 * credentials. Unlike Discord/Slack/Telegram, `http:` is accepted here - trusted-network
 * targets (n8n, Node-RED, Home Assistant on the LAN) are a documented use case - but the
 * combination of an `http:` URL and custom headers is rejected separately, by
 * {@link import('./webhook-headers-require-https.validator').WebhookHeadersRequireHttps}.
 */
export const isValidWebhookUrl = (value: unknown): value is string => {
	if (typeof value !== 'string' || value.length === 0 || value.length > MAX_WEBHOOK_URL_LENGTH) {
		return false;
	}

	try {
		const url = new URL(value);

		return ['http:', 'https:'].includes(url.protocol) && url.username.length === 0 && url.password.length === 0;
	} catch {
		return false;
	}
};

export const IsValidWebhookUrl = (validationOptions?: ValidationOptions): PropertyDecorator =>
	ValidateBy(
		{
			name: 'isValidWebhookUrl',
			validator: {
				validate: isValidWebhookUrl,
				defaultMessage: () =>
					`Webhook URL must be at most ${MAX_WEBHOOK_URL_LENGTH} characters and use HTTP or HTTPS without embedded credentials`,
			},
		},
		validationOptions,
	);
