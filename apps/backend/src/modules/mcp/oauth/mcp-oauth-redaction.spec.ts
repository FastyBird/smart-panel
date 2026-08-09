import { redactMcpOAuthLogValue } from './mcp-oauth-redaction';

describe('redactMcpOAuthLogValue', () => {
	it('redacts OAuth artifacts recursively while preserving safe audit identifiers', () => {
		const raw = 'raw-secret-value';
		const redacted = redactMcpOAuthLogValue({
			clientId: 'client-1',
			grantId: 'grant-1',
			access_token: raw,
			nested: {
				codeVerifier: raw,
				cookie: raw,
				tokenHash: raw,
				reason: 'invalid_grant',
			},
		});

		expect(redacted).toEqual({
			clientId: 'client-1',
			grantId: 'grant-1',
			access_token: '[REDACTED]',
			nested: {
				codeVerifier: '[REDACTED]',
				cookie: '[REDACTED]',
				tokenHash: '[REDACTED]',
				reason: 'invalid_grant',
			},
		});
		expect(JSON.stringify(redacted)).not.toContain(raw);
	});
});
