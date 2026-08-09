import { normalizeMcpOAuthPublicBaseUrl } from './is-mcp-oauth-public-base-url.validator';

describe('normalizeMcpOAuthPublicBaseUrl', () => {
	it.each(['https://panel.example.com', 'https://panel.example.com/prefix', 'https://[2001:db8::1]:8443/panel'])(
		'accepts normalized HTTPS base %s',
		(value) => {
			expect(normalizeMcpOAuthPublicBaseUrl(value)).toBe(value);
		},
	);

	it.each([
		'http://panel.example.com',
		'https://panel.example.com/',
		'https://panel.example.com/prefix/',
		'https://panel.example.com:443',
		'https://user:secret@panel.example.com',
		'https://panel.example.com?host=other',
		'https://panel.example.com#fragment',
	])('rejects non-canonical or unsafe base %s', (value) => {
		expect(normalizeMcpOAuthPublicBaseUrl(value)).toBeNull();
	});
});
