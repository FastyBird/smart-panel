import { z } from 'zod';

/** The only hostname Slack serves incoming webhooks from. */
const SLACK_WEBHOOK_HOSTNAME = 'hooks.slack.com';

/**
 * `/services/T<workspace id>/B<bot/app id>/<token>`. Mirrors the backend's
 * `slack-webhook-url.validator.ts`.
 */
const SLACK_WEBHOOK_PATH_PATTERN = /^\/services\/T[A-Z0-9]+\/B[A-Z0-9]+\/[A-Za-z0-9]+\/?$/;

/**
 * Restricted to Slack's own webhook hostname and path shape, not just `https:` - an
 * unrestricted host would let the field act as an open SSRF proxy from the server to any
 * HTTPS host the administrator (or a compromised admin session) configured.
 */
export const isValidSlackWebhookUrl = (value: string): boolean => {
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
			url.hostname.toLowerCase() === SLACK_WEBHOOK_HOSTNAME &&
			SLACK_WEBHOOK_PATH_PATTERN.test(url.pathname)
		);
	} catch {
		return false;
	}
};

export const SlackWebhookUrlSchema = z.string().refine(isValidSlackWebhookUrl, {
	message: 'Slack webhook URL must be an https://hooks.slack.com/services/<T.../B.../...> URL, without embedded credentials or a port',
});
