import { IsTrustedProxyEntryConstraint } from './is-trusted-proxy-entry.validator';

describe('IsTrustedProxyEntryConstraint', () => {
	const constraint = new IsTrustedProxyEntryConstraint();

	it.each(['127.0.0.1', '10.0.0.0/8', '::1', 'fc00::/7', '203.0.113.10/32'])(
		'accepts valid IP/CIDR entry %s',
		(value) => {
			expect(constraint.validate(value)).toBe(true);
		},
	);

	it.each(['10.0.0.0/', '10.0.0.0/8.0', 'not-an-ip', '10.0.0.0/33', '', 42, null])(
		'rejects malformed entry %p',
		(value) => {
			expect(constraint.validate(value)).toBe(false);
		},
	);

	it('provides a human-readable default message', () => {
		expect(constraint.defaultMessage({} as never)).toEqual(expect.any(String));
	});
});
