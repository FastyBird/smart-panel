import { BuddyProviderTimeoutException } from './buddy.exceptions';
import { isTimeoutError } from './buddy.utils';

describe('isTimeoutError', () => {
	it('should detect BuddyProviderTimeoutException', () => {
		expect(isTimeoutError(new BuddyProviderTimeoutException())).toBe(true);
	});

	it('should detect Anthropic APIConnectionTimeoutError by name', () => {
		const error = new Error('Connection timed out');

		error.name = 'APIConnectionTimeoutError';

		expect(isTimeoutError(error)).toBe(true);
	});

	it('should detect AbortError by name', () => {
		const error = new Error('The operation was aborted');

		error.name = 'AbortError';

		expect(isTimeoutError(error)).toBe(true);
	});

	it('should detect ETIMEDOUT by code', () => {
		const error = new Error('connect ETIMEDOUT');

		(error as unknown as Record<string, unknown>).code = 'ETIMEDOUT';

		expect(isTimeoutError(error)).toBe(true);
	});

	it('should detect ECONNABORTED by code', () => {
		const error = new Error('socket hang up');

		(error as unknown as Record<string, unknown>).code = 'ECONNABORTED';

		expect(isTimeoutError(error)).toBe(true);
	});

	it('should detect timeout via message string matching', () => {
		expect(isTimeoutError(new Error('Request timed out after 30s'))).toBe(true);
		expect(isTimeoutError(new Error('Connection timeout'))).toBe(true);
	});

	it('should not match non-timeout errors', () => {
		expect(isTimeoutError(new Error('Authentication failed'))).toBe(false);
		expect(isTimeoutError(new Error('Rate limit exceeded'))).toBe(false);
		expect(isTimeoutError(null)).toBe(false);
		expect(isTimeoutError(undefined)).toBe(false);
	});
});
