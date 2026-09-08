import { describe, expect, it } from 'vitest';

import { isValidCloudflareTunnelHostname } from './hostname.schemas';

describe('isValidCloudflareTunnelHostname', () => {
	it.each(['panel.example.com', 'smart-panel.example.co.uk', 'a.b'])('accepts %s', (value) => {
		expect(isValidCloudflareTunnelHostname(value)).toBe(true);
	});

	it.each([
		['a bare label with no TLD', 'panel'],
		['a URL with a scheme', 'https://panel.example.com'],
		['a hostname with a path', 'panel.example.com/admin'],
		['a hostname with a port', 'panel.example.com:8080'],
		['a leading hyphen label', '-panel.example.com'],
		['a trailing hyphen label', 'panel-.example.com'],
		['an empty string', ''],
		['whitespace only', '   '],
	])('rejects %s (%s)', (_label, value) => {
		expect(isValidCloudflareTunnelHostname(value)).toBe(false);
	});
});
