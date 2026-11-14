import { compareProtectVersions, isSupportedProtectVersion, parseProtectVersion } from './protect-version';

describe('protect-version', () => {
	it.each([
		['7.2.105', true],
		['7.3.74', true],
		['7.10.0', true],
		['8.0.0', true],
		['7.3', true],
		['7.3.74-beta.3', true],
		['7.2.104', false],
		['6.9.999', false],
		['5.3.48', false],
		['', false],
		['v7.3.74', false],
		['7.x.1', false],
		[null, false],
		[7.3, false],
	])('isSupportedProtectVersion(%p) is %p', (v, expected) => {
		expect(isSupportedProtectVersion(v)).toBe(expected);
	});

	it('compares numerically, not lexically', () => {
		expect(compareProtectVersions(parseProtectVersion('7.10.0'), parseProtectVersion('7.9.9'))).toBe(1);
		expect(compareProtectVersions(parseProtectVersion('7.9.9'), parseProtectVersion('7.10.0'))).toBe(-1);
		expect(compareProtectVersions(parseProtectVersion('7.3'), parseProtectVersion('7.3.0'))).toBe(0);
	});

	it('defaults the patch to 0 and ignores prerelease suffixes', () => {
		expect(parseProtectVersion('7.3')).toEqual({ major: 7, minor: 3, patch: 0 });
		expect(parseProtectVersion('7.3.74-beta.3')).toEqual({ major: 7, minor: 3, patch: 74 });
	});

	it('accepts a custom minimum and rejects an unparseable one', () => {
		expect(isSupportedProtectVersion('7.3.0', '7.3.74')).toBe(false);
		expect(isSupportedProtectVersion('7.3.74', '7.3.74')).toBe(true);
		expect(isSupportedProtectVersion('9.0.0', 'bogus')).toBe(false);
	});
});
