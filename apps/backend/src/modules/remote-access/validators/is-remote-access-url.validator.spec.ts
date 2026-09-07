import { IsRemoteAccessUrlConstraint, normalizeRemoteAccessUrl } from './is-remote-access-url.validator';

describe('normalizeRemoteAccessUrl', () => {
	it.each([
		'https://panel.example.com',
		'http://panel.example.com',
		'https://panel.example.com:8443',
		'https://[2001:db8::1]:8443',
	])('accepts an already-normalized origin %s', (value) => {
		expect(normalizeRemoteAccessUrl(value)).toBe(value);
	});

	it.each([
		['https://panel.example.com/', 'https://panel.example.com', 'trailing slash on a bare origin'],
		['http://panel.local:8080/', 'http://panel.local:8080', 'trailing slash with a port'],
		['HTTPS://Example.COM', 'https://example.com', 'upper-case scheme and host'],
		['https://panel.example.com:443', 'https://panel.example.com', 'redundant default HTTPS port'],
	])('normalizes %s to its canonical origin (%s)', (value, expected) => {
		expect(normalizeRemoteAccessUrl(value)).toBe(expected);
	});

	it.each([
		['https://panel.example.com/prefix', 'path prefix'],
		['https://panel.example.com/prefix/', 'path prefix with trailing slash'],
		['https://user:secret@panel.example.com', 'credentials'],
		['https://user@panel.example.com', 'username only'],
		['https://panel.example.com?query=1', 'query string'],
		['https://panel.example.com#fragment', 'fragment'],
		['ftp://panel.example.com', 'non-HTTP(S) scheme'],
		['not a url', 'unparseable value'],
		// `new URL()` canonicalizes dot segments before `.pathname` is ever read (e.g. `/..`
		// collapses to `/`), so these must be caught against the raw input instead.
		['https://panel.example.com/..', 'a bare ".." path segment'],
		['https://panel.example.com/.', 'a bare "." path segment'],
		['https://panel.example.com/foo/..', 'a ".." segment after a real path component'],
	])('rejects %s (%s)', (value) => {
		expect(normalizeRemoteAccessUrl(value)).toBeNull();
	});
});

describe('IsRemoteAccessUrlConstraint', () => {
	const constraint = new IsRemoteAccessUrlConstraint();

	it('validates a normalized HTTP origin', () => {
		expect(constraint.validate('http://panel.example.com')).toBe(true);
	});

	it('validates a normalized HTTPS origin', () => {
		expect(constraint.validate('https://panel.example.com')).toBe(true);
	});

	it('validates an HTTPS origin with a trailing slash', () => {
		expect(constraint.validate('https://panel.example.com/')).toBe(true);
	});

	it('rejects a URL carrying a path', () => {
		expect(constraint.validate('https://panel.example.com/prefix')).toBe(false);
	});

	it('rejects a URL carrying credentials', () => {
		expect(constraint.validate('https://user:secret@panel.example.com')).toBe(false);
	});

	it('rejects a non-string value', () => {
		expect(constraint.validate(42)).toBe(false);
	});

	it('provides a human-readable default message', () => {
		expect(constraint.defaultMessage({} as never)).toEqual(expect.any(String));
	});
});
