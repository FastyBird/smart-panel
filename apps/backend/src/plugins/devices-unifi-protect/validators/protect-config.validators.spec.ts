import { isValidProtectHost, isValidProtectServerName, normalizeProtectFingerprint } from './protect-config.validators';

describe('Protect config validators', () => {
	it.each(['192.168.1.1', 'fe80::1', 'unvr.local', 'abc123.id.ui.direct'])('accepts the host %s', (h) =>
		expect(isValidProtectHost(h)).toBe(true),
	);

	it.each([
		'https://192.168.1.1',
		'192.168.1.1:443',
		'host/path',
		'user@host',
		'a b',
		'',
		'x'.repeat(254),
		42,
		'999.1.1.1',
		'-bad.local',
	])('refuses the host %#', (h) => expect(isValidProtectHost(h)).toBe(false));

	it.each(['192.168.1.1', '::1', 'bad_name.local', ''])('refuses the server name %#', (n) =>
		expect(isValidProtectServerName(n)).toBe(false),
	);

	it('accepts a DNS server name', () => {
		expect(isValidProtectServerName('abc123.id.ui.direct')).toBe(true);
	});

	it('normalizes fingerprints', () => {
		const hex = 'ab'.repeat(32);

		expect(normalizeProtectFingerprint(hex.toUpperCase().match(/../g).join(':'))).toBe(hex);
		expect(normalizeProtectFingerprint('ab'.repeat(31))).toBeNull();
		expect(normalizeProtectFingerprint('zz'.repeat(32))).toBeNull();
		expect(normalizeProtectFingerprint(null)).toBeNull();
	});
});
