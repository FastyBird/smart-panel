import { IsRemoteAccessUrlConstraint, normalizeRemoteAccessUrl } from './is-remote-access-url.validator';

describe('normalizeRemoteAccessUrl', () => {
	it.each([
		'https://panel.example.com',
		'http://panel.example.com',
		'https://panel.example.com:8443',
		'https://[2001:db8::1]:8443',
	])('accepts normalized origin %s', (value) => {
		expect(normalizeRemoteAccessUrl(value)).toBe(value);
	});

	it.each([
		['https://panel.example.com/', 'trailing slash'],
		['https://panel.example.com/prefix', 'path prefix'],
		['https://panel.example.com/prefix/', 'path prefix with trailing slash'],
		['https://panel.example.com:443', 'redundant default port'],
		['https://user:secret@panel.example.com', 'credentials'],
		['https://user@panel.example.com', 'username only'],
		['https://panel.example.com?query=1', 'query string'],
		['https://panel.example.com#fragment', 'fragment'],
		['ftp://panel.example.com', 'non-HTTP(S) scheme'],
		['not a url', 'unparseable value'],
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
