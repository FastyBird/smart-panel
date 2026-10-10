import { describe, expect, it } from 'vitest';

import { AuthLoginException } from './auth.exceptions';

describe('AuthLoginException', () => {
	it.each(['60', '1', '3600'])('accepts bounded integer Retry-After %s', (value) => {
		expect(new AuthLoginException('limited', 429, value).retryAfterSeconds).toBe(Number(value));
	});
	it.each([
		null,
		undefined,
		'',
		'0',
		'-1',
		'1.5',
		'3601',
		'999999999',
		'60 seconds',
		' 60',
		'Wed, 21 Oct 2015 07:28:00 GMT',
	])('rejects unsafe Retry-After %s', (value) => {
		expect(new AuthLoginException('limited', 429, value).retryAfterSeconds).toBeNull();
	});
	it('ignores Retry-After on other responses', () => {
		expect(new AuthLoginException('invalid', 404, '60').retryAfterSeconds).toBeNull();
	});
});
