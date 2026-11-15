export const PROTECT_REDACTED = '<redacted>';

const MIN_SECRET_LENGTH = 4;
const MAX_LENGTH = 1024;

const API_KEY_HEADER = /(x-api-key\s*[:=]\s*["']?)[^\s"',;&]+/gi;
const STREAM_URL = /\b((?:rtsps?|rtspx):\/\/[^/\s"'<>]+)\/[^\s"']*/gi;

export function redactProtectText(text: string, secrets: readonly string[]): string {
	let result = text;

	const literals = secrets.filter((s) => typeof s === 'string' && s.length >= MIN_SECRET_LENGTH);

	for (const secret of [...literals].sort((a, b) => b.length - a.length)) {
		result = result.split(secret).join(PROTECT_REDACTED);
	}

	result = result.replace(API_KEY_HEADER, `$1${PROTECT_REDACTED}`);
	result = result.replace(STREAM_URL, `$1/${PROTECT_REDACTED}`);

	return result.length > MAX_LENGTH ? result.slice(0, MAX_LENGTH) : result;
}
