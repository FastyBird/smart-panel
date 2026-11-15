import { formatMac, isDnsHostname, normalizeMacString, sanitizeText } from './protect-discovery-text';

describe('protect discovery text helpers', () => {
	it('sanitizeText trims and keeps ordinary text', () => expect(sanitizeText('  UNVR ')).toBe('UNVR'));

	it.each(['', '   ', 'a\u0000b', 'a\nb', 'x'.repeat(129)])('sanitizeText rejects %j', (v) =>
		expect(sanitizeText(v)).toBeNull(),
	);

	it('sanitizeText accepts exactly 128 characters', () => expect(sanitizeText('x'.repeat(128))).toBe('x'.repeat(128)));

	it('formatMac formats six bytes lowercase', () =>
		expect(formatMac(Uint8Array.of(0xaa, 0xbb, 0xcc, 0, 0, 1))).toBe('aa:bb:cc:00:00:01'));

	it.each([
		['AA-BB-CC-00-00-01', 'aa:bb:cc:00:00:01'],
		['aabb.cc00.0001', 'aa:bb:cc:00:00:01'],
		['aa:bb:cc:00:00:01', 'aa:bb:cc:00:00:01'],
	])('normalizeMacString %s', (i, o) => expect(normalizeMacString(i)).toBe(o));

	it.each(['aa:bb:cc:00:00', 'zz:bb:cc:00:00:01', '', 'aa:bb:cc:00:00:01:02'])('normalizeMacString rejects %s', (v) =>
		expect(normalizeMacString(v)).toBeNull(),
	);

	it.each(['unifi', 'unifi.local', 'abc123.id.ui.direct', 'a-b.c'])('isDnsHostname accepts %s', (v) =>
		expect(isDnsHostname(v)).toBe(true),
	);

	it.each([
		'',
		'Unifi',
		'a_b',
		'-a.b',
		'a-.b',
		'a..b',
		'1.2.3',
		'a b',
		'x'.repeat(64) + '.local',
		'a.'.repeat(130) + 'a',
	])('isDnsHostname rejects %j', (v) => expect(isDnsHostname(v)).toBe(false));
});
