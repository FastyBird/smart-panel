import { isIpInCidr, isValidTrustedProxyEntry, normalizeIpAddress } from './ip-match.utils';

describe('normalizeIpAddress', () => {
	it('maps an IPv4-mapped IPv6 address down to its plain IPv4 form', () => {
		expect(normalizeIpAddress('::ffff:127.0.0.1')).toBe('127.0.0.1');
	});

	it('is case-insensitive for the ::ffff: prefix', () => {
		expect(normalizeIpAddress('::FFFF:192.168.1.5')).toBe('192.168.1.5');
	});

	it('trims surrounding whitespace', () => {
		expect(normalizeIpAddress('  10.0.0.1  ')).toBe('10.0.0.1');
	});

	it('leaves a plain IPv4 address unchanged', () => {
		expect(normalizeIpAddress('192.168.1.5')).toBe('192.168.1.5');
	});

	it('leaves a plain IPv6 address unchanged', () => {
		expect(normalizeIpAddress('fc00::1')).toBe('fc00::1');
	});

	it('leaves an unparseable value unchanged', () => {
		expect(normalizeIpAddress('not-an-ip')).toBe('not-an-ip');
	});

	it('strips an IPv6 zone id', () => {
		expect(normalizeIpAddress('fe80::1%eth0')).toBe('fe80::1');
	});
});

describe('isIpInCidr', () => {
	describe('IPv4', () => {
		it('matches an address inside an IPv4 CIDR range', () => {
			expect(isIpInCidr('10.1.2.3', '10.0.0.0/8')).toBe(true);
		});

		it('rejects an address outside an IPv4 CIDR range', () => {
			expect(isIpInCidr('11.0.0.0', '10.0.0.0/8')).toBe(false);
		});

		it('matches a bare IP entry exactly', () => {
			expect(isIpInCidr('192.168.1.5', '192.168.1.5')).toBe(true);
		});

		it('rejects a different address against a bare IP entry', () => {
			expect(isIpInCidr('192.168.1.6', '192.168.1.5')).toBe(false);
		});

		it('handles a /0 range as matching everything in the family', () => {
			expect(isIpInCidr('8.8.8.8', '0.0.0.0/0')).toBe(true);
		});

		it('handles a /32 range as an exact match', () => {
			expect(isIpInCidr('10.0.0.1', '10.0.0.1/32')).toBe(true);
			expect(isIpInCidr('10.0.0.2', '10.0.0.1/32')).toBe(false);
		});

		it('matches on a non-byte-aligned prefix boundary', () => {
			// 10.0.0.0/12 covers 10.0.0.0 - 10.15.255.255
			expect(isIpInCidr('10.15.255.255', '10.0.0.0/12')).toBe(true);
			expect(isIpInCidr('10.16.0.0', '10.0.0.0/12')).toBe(false);
		});
	});

	describe('IPv6', () => {
		it('matches an address inside an IPv6 CIDR range', () => {
			expect(isIpInCidr('fc00::1234', 'fc00::/7')).toBe(true);
		});

		it('rejects an address outside an IPv6 CIDR range', () => {
			expect(isIpInCidr('fe80::1', 'fc00::/7')).toBe(false);
		});

		it('matches a bare IPv6 entry exactly', () => {
			expect(isIpInCidr('::1', '::1')).toBe(true);
		});

		it('handles a /128 range as an exact match', () => {
			expect(isIpInCidr('2001:db8::1', '2001:db8::1/128')).toBe(true);
			expect(isIpInCidr('2001:db8::2', '2001:db8::1/128')).toBe(false);
		});

		it('handles a /0 range as matching everything in the family', () => {
			expect(isIpInCidr('2001:db8::1', '::/0')).toBe(true);
		});

		it('normalises an IPv4-mapped IPv6 address before matching', () => {
			expect(isIpInCidr('::ffff:127.0.0.1', '127.0.0.0/8')).toBe(true);
		});

		it('matches a zone-suffixed link-local address against a zone-less entry', () => {
			expect(isIpInCidr('fe80::1%eth0', 'fe80::/10')).toBe(true);
		});
	});

	describe('malformed input', () => {
		it('rejects a family mismatch between address and entry', () => {
			expect(isIpInCidr('10.0.0.1', 'fc00::/7')).toBe(false);
			expect(isIpInCidr('fc00::1', '10.0.0.0/8')).toBe(false);
		});

		it('rejects an unparseable address', () => {
			expect(isIpInCidr('not-an-ip', '10.0.0.0/8')).toBe(false);
		});

		it('rejects an unparseable entry', () => {
			expect(isIpInCidr('10.0.0.1', 'not-a-cidr')).toBe(false);
		});

		it('rejects an out-of-range IPv4 prefix', () => {
			expect(isIpInCidr('10.0.0.1', '10.0.0.0/33')).toBe(false);
		});

		it('rejects a negative or non-numeric prefix', () => {
			expect(isIpInCidr('10.0.0.1', '10.0.0.0/-1')).toBe(false);
			expect(isIpInCidr('10.0.0.1', '10.0.0.0/abc')).toBe(false);
		});

		it('rejects a trailing slash with no prefix instead of silently matching everything', () => {
			// `Number('')` is `0` — without an explicit empty/non-digit check
			// this would parse as `/0` and trust the whole address family.
			expect(isIpInCidr('8.8.8.8', '10.0.0.0/')).toBe(false);
			expect(isIpInCidr('2001:db8::1', 'fc00::/')).toBe(false);
		});

		it('rejects a decimal or explicitly-signed prefix', () => {
			expect(isIpInCidr('10.0.0.1', '10.0.0.0/8.0')).toBe(false);
			expect(isIpInCidr('10.0.0.1', '10.0.0.0/+8')).toBe(false);
		});

		it('rejects an out-of-range IPv6 prefix', () => {
			expect(isIpInCidr('fc00::1', 'fc00::/129')).toBe(false);
		});

		it('rejects an empty entry', () => {
			expect(isIpInCidr('10.0.0.1', '')).toBe(false);
		});
	});
});

describe('isValidTrustedProxyEntry', () => {
	it('accepts a bare IPv4 address', () => {
		expect(isValidTrustedProxyEntry('192.168.1.5')).toBe(true);
	});

	it('accepts a bare IPv6 address', () => {
		expect(isValidTrustedProxyEntry('fc00::1')).toBe(true);
	});

	it('accepts an IPv4 CIDR range', () => {
		expect(isValidTrustedProxyEntry('10.0.0.0/8')).toBe(true);
	});

	it('accepts an IPv6 CIDR range', () => {
		expect(isValidTrustedProxyEntry('fc00::/7')).toBe(true);
	});

	it('rejects a hostname', () => {
		expect(isValidTrustedProxyEntry('proxy.example.com')).toBe(false);
	});

	it('rejects a bracketed IPv6 address', () => {
		expect(isValidTrustedProxyEntry('[::1]')).toBe(false);
	});

	it('rejects a trailing slash with no prefix', () => {
		expect(isValidTrustedProxyEntry('10.0.0.0/')).toBe(false);
	});

	it('rejects an out-of-range prefix', () => {
		expect(isValidTrustedProxyEntry('10.0.0.0/33')).toBe(false);
	});

	it('rejects an empty string', () => {
		expect(isValidTrustedProxyEntry('')).toBe(false);
	});
});
