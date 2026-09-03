const MAX_MESSAGE_LENGTH = 300;

const REDACTED = '***';

/** Any `scheme://...` substring, up to the next whitespace or quoting character. */
const URL_PATTERN = /[a-zA-Z][a-zA-Z0-9+.-]*:\/\/[^\s"'<>]+/g;

const BEARER_TOKEN_PATTERN = /\b(Bearer)\s+\S+/gi;

const JSON_SECRET_FIELD_PATTERN = /"(token|key|password|secret)"\s*:\s*"[^"]*"/gi;

const KEY_VALUE_SECRET_PATTERN = /\b(token|key|password|secret)=[^&\s"'}]+/gi;

/**
 * Turns a raw error message into something safe to store in a `delivery-failed` notification or
 * write to the log - the one place a channel failure's detail is allowed to end up.
 *
 * A webhook URL, and a Telegram `bot<token>` path or Slack webhook path just as much, carry the
 * channel's secret in the URL itself, so every URL is reduced to `scheme://host`: userinfo, port,
 * path and query are all dropped. Keeping the port would leak nothing sensitive on its own, but
 * dropping it keeps the output one simple shape regardless of what the original URL carried, rather
 * than a rule with an exception - so it goes too, alongside the path and query.
 *
 * `Bearer <token>` and `token=`/`key=`/`password=`/`secret=` values - inline or inside JSON-like
 * text such as `"token":"..."` - are masked next, for a secret that reached the message some other
 * way (a provider's JSON error body, for instance). Finally, whitespace collapses to single spaces
 * and the result is capped at 300 characters, so a stack trace or a wall of provider JSON cannot
 * blow out a notification row.
 */
export function sanitizeErrorMessage(message: string): string {
	let sanitized = message.replace(URL_PATTERN, reduceUrl);

	sanitized = sanitized.replace(BEARER_TOKEN_PATTERN, `$1 ${REDACTED}`);
	sanitized = sanitized.replace(JSON_SECRET_FIELD_PATTERN, (_match, field: string) => `"${field}":"${REDACTED}"`);
	sanitized = sanitized.replace(KEY_VALUE_SECRET_PATTERN, (_match, field: string) => `${field}=${REDACTED}`);

	sanitized = sanitized.replace(/\s+/g, ' ').trim();

	return sanitized.slice(0, MAX_MESSAGE_LENGTH);
}

/** `scheme://host`, dropping userinfo, port, path and query. Falls back to `scheme://` for a match that is not a valid URL. */
function reduceUrl(match: string): string {
	try {
		const url = new URL(match);

		return `${url.protocol}//${url.hostname}`;
	} catch {
		const scheme = match.split(':')[0];

		return `${scheme}://`;
	}
}
