import {
	IsMcpOAuthRedirectUrisConstraint,
	isMcpOAuthRedirectUri,
	matchesMcpOAuthRedirectUri,
} from './is-mcp-oauth-redirect-uri.validator';

describe('MCP OAuth redirect URI policy', () => {
	it.each([
		'https://client.example/callback',
		'https://client.example:8443/oauth/callback?profile=panel',
		'http://127.0.0.1:1455/callback',
		'http://[::1]:1455/callback',
		'http://localhost:1455/callback',
	])('accepts %s', (uri) => {
		expect(isMcpOAuthRedirectUri(uri)).toBe(true);
	});

	it.each([
		'http://client.example/callback',
		'http://127.0.0.2/callback',
		'ftp://127.0.0.1/callback',
		'https://user:secret@client.example/callback',
		'https://client.example/callback#fragment',
		'not-a-url',
	])('rejects %s', (uri) => {
		expect(isMcpOAuthRedirectUri(uri)).toBe(false);
	});

	it('allows only the runtime port to vary for native loopback IP literals', () => {
		expect(matchesMcpOAuthRedirectUri('http://127.0.0.1:1455/callback', 'http://127.0.0.1:49152/callback')).toBe(true);
		expect(matchesMcpOAuthRedirectUri('http://[::1]:1455/callback', 'http://[::1]:49152/callback')).toBe(true);
		expect(matchesMcpOAuthRedirectUri('http://localhost:1455/callback', 'http://localhost:49152/callback')).toBe(false);
		expect(matchesMcpOAuthRedirectUri('http://127.0.0.1:1455/callback', 'http://127.0.0.1:49152/other')).toBe(false);
		expect(
			matchesMcpOAuthRedirectUri('http://127.0.0.1:1455/callback?a=1', 'http://127.0.0.1:49152/callback?a=2'),
		).toBe(false);
		expect(matchesMcpOAuthRedirectUri('https://client.example/callback', 'https://client.example:8443/callback')).toBe(
			false,
		);
	});

	it('requires a bounded unique non-empty redirect allowlist', () => {
		const constraint = new IsMcpOAuthRedirectUrisConstraint();

		expect(constraint.validate(['https://client.example/callback'])).toBe(true);
		expect(constraint.validate([])).toBe(false);
		expect(constraint.validate(['https://client.example/callback', 'https://client.example/callback'])).toBe(false);
		expect(constraint.validate(Array.from({ length: 11 }, (_, index) => `https://client.example/${index}`))).toBe(
			false,
		);
	});
});
