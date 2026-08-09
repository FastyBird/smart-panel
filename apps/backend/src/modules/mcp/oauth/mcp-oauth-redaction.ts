const SENSITIVE_KEY = /(?:authorization|code|cookie|password|pkce|secret|token|verifier|hash)/i;

export function redactMcpOAuthLogValue(value: unknown): unknown {
	if (Array.isArray(value)) {
		return value.map((item) => redactMcpOAuthLogValue(item));
	}

	if (!value || typeof value !== 'object') {
		return value;
	}

	return Object.fromEntries(
		Object.entries(value).map(([key, entry]) => [
			key,
			SENSITIVE_KEY.test(key) ? '[REDACTED]' : redactMcpOAuthLogValue(entry),
		]),
	);
}
