import { ValidateBy, ValidationOptions } from 'class-validator';

export const MAX_SLACK_WEBHOOK_URL_LENGTH = 2048;

/** The only hostname Slack serves incoming webhooks from. */
const SLACK_WEBHOOK_HOSTNAME = 'hooks.slack.com';

/**
 * `/services/T<workspace id>/B<bot/app id>/<token>`. This is the only path shape Slack
 * serves incoming webhooks under.
 */
const SLACK_WEBHOOK_PATH_PATTERN = /^\/services\/T[A-Z0-9]+\/B[A-Z0-9]+\/[A-Za-z0-9]+\/?$/;

/**
 * Slack (like Discord and Telegram) rejects a non-`https:` webhook URL at config validation -
 * unlike the generic webhook plugin, there is no trusted-network exception, because a Slack
 * incoming-webhook URL is itself the only credential and must never travel in cleartext.
 *
 * Beyond the scheme, the URL is restricted to Slack's own webhook hostname and path shape.
 * Without this, `send()` would `fetch()` whatever HTTPS URL the administrator (or a
 * compromised admin session) configured - an open SSRF proxy from the server to any internal
 * or external HTTPS host, e.g. a cloud metadata endpoint. Rejecting userinfo and a non-default
 * port closes off the same class of confusable-URL trick used elsewhere in this codebase's URL
 * validators (`devices-homey`, `remote-access`, `notifications-discord`).
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

		return (
			url.protocol === 'https:' &&
			url.username.length === 0 &&
			url.password.length === 0 &&
			url.port.length === 0 &&
			url.hostname.toLowerCase() === SLACK_WEBHOOK_HOSTNAME &&
			SLACK_WEBHOOK_PATH_PATTERN.test(url.pathname)
		);
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
					'Slack webhook URL must be an https://hooks.slack.com/services/<T.../B.../...> URL, without embedded credentials or a port',
			},
		},
		validationOptions,
	);
