const REDACTED = '<redacted>';
const MAX_LINE_LENGTH = 1024;
// At least one character after the scheme: a literal that was already replaced leaves `scheme://<redacted>`, which
// must not be redacted a second time.
const URL_PATTERN = /\b(rtsps?|rtspx|https?|wss?):\/\/[^\s"'<>]+/gi;

/**
 * Redacts a line of go2rtc output before it is stored or logged: registered secret literals (longest first), then any
 * stream url by scheme, then truncation. go2rtc prints source urls and, on failure, may echo parts of its config.
 */
export function redactGo2rtcOutput(line: string, secrets: readonly string[]): string {
	let redacted = line;

	for (const secret of [...secrets].filter((value) => value !== '').sort((a, b) => b.length - a.length)) {
		redacted = redacted.split(secret).join(REDACTED);
	}

	return redacted.replace(URL_PATTERN, `$1://${REDACTED}`).slice(0, MAX_LINE_LENGTH);
}
