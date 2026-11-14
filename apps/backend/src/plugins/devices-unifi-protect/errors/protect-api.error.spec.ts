import { PROTECT_ERROR_MESSAGES, ProtectApiError, ProtectErrorCategory, toProtectApiError } from './protect-api.error';

const withCode = (code: string, message = 'x'): Error => Object.assign(new Error(message), { code });

describe('ProtectApiError', () => {
	it('has a fixed message per category and never includes details', () => {
		const e = new ProtectApiError(ProtectErrorCategory.AUTHENTICATION, 'meta/info', { status: 401 });

		expect(e.message).toBe("UniFi Protect request 'meta/info' failed (authentication)");
		expect(e.name).toBe('ProtectApiError');
		expect(e.status).toBe(401);
		expect(e.retryAfterMs).toBeNull();
		expect(e.retryable).toBe(false);
		expect(Object.keys(PROTECT_ERROR_MESSAGES).sort()).toEqual(Object.values(ProtectErrorCategory).sort());
		expect(PROTECT_ERROR_MESSAGES.version_unsupported).toContain('7.2.105');
	});

	it.each([
		[ProtectErrorCategory.TIMEOUT, true],
		[ProtectErrorCategory.UNREACHABLE, true],
		[ProtectErrorCategory.UNAVAILABLE, true],
		[ProtectErrorCategory.RATE_LIMITED, true],
		[ProtectErrorCategory.PROTOCOL, true],
		[ProtectErrorCategory.VALIDATION, false],
		[ProtectErrorCategory.TLS_UNTRUSTED, false],
		[ProtectErrorCategory.TLS_FINGERPRINT_MISMATCH, false],
		[ProtectErrorCategory.AUTHENTICATION, false],
		[ProtectErrorCategory.AUTHORIZATION, false],
		[ProtectErrorCategory.NOT_FOUND, false],
		[ProtectErrorCategory.BAD_REQUEST, false],
		[ProtectErrorCategory.UNSUPPORTED, false],
		[ProtectErrorCategory.VERSION_UNSUPPORTED, false],
		[ProtectErrorCategory.CANCELLED, false],
	])('marks %s retryable=%s', (category, retryable) => {
		expect(new ProtectApiError(category, 'system').retryable).toBe(retryable);
	});

	it('carries retryAfterMs and defaults details to null', () => {
		const e = new ProtectApiError(ProtectErrorCategory.RATE_LIMITED, 'cameras', { status: 429, retryAfterMs: 1500 });

		expect(e.status).toBe(429);
		expect(e.retryAfterMs).toBe(1500);
		expect(new ProtectApiError(ProtectErrorCategory.TIMEOUT, 'tls').status).toBeNull();
	});

	it('keeps every fixed user text free of placeholders and non-empty', () => {
		for (const text of Object.values(PROTECT_ERROR_MESSAGES)) {
			expect(text.length).toBeGreaterThan(10);
			expect(text).not.toMatch(/[{}$]/);
		}
	});
});

describe('toProtectApiError', () => {
	it.each([
		['ECONNREFUSED', 'unreachable'],
		['EHOSTUNREACH', 'unreachable'],
		['ENETUNREACH', 'unreachable'],
		['ENOTFOUND', 'unreachable'],
		['EAI_AGAIN', 'unreachable'],
		['ECONNRESET', 'unreachable'],
		['ETIMEDOUT', 'timeout'],
		['DEPTH_ZERO_SELF_SIGNED_CERT', 'tls_untrusted'],
		['SELF_SIGNED_CERT_IN_CHAIN', 'tls_untrusted'],
		['UNABLE_TO_VERIFY_LEAF_SIGNATURE', 'tls_untrusted'],
		['UNABLE_TO_GET_ISSUER_CERT_LOCALLY', 'tls_untrusted'],
		['CERT_HAS_EXPIRED', 'tls_untrusted'],
		['ERR_TLS_CERT_ALTNAME_INVALID', 'tls_untrusted'],
	])('maps %s to %s', (code, category) => {
		expect(toProtectApiError(withCode(code), 'tls').category).toBe(category);
	});

	it('returns an existing ProtectApiError unchanged', () => {
		const original = new ProtectApiError(ProtectErrorCategory.NOT_FOUND, 'cameras/{id}', { status: 404 });

		expect(toProtectApiError(original, 'tls')).toBe(original);
	});

	it('maps abort errors to cancelled and timeout errors to timeout', () => {
		expect(toProtectApiError(Object.assign(new Error('x'), { name: 'AbortError' }), 'nvrs').category).toBe('cancelled');
		expect(toProtectApiError(Object.assign(new Error('x'), { name: 'TimeoutError' }), 'nvrs').category).toBe('timeout');
	});

	it('maps unknown failures to unavailable and never leaks the original message', () => {
		const secret = 'https://user:PROTECT_SENTINEL_KEY_7f3a9c0d1e2b4a6f@10.0.0.2/x';
		const mapped = toProtectApiError(new Error(secret), 'system');

		expect(mapped.category).toBe('unavailable');
		expect(mapped.operation).toBe('system');
		expect(mapped.message).not.toContain('PROTECT_SENTINEL_KEY');
		expect(toProtectApiError('plain string', 'system').category).toBe('unavailable');
		expect(toProtectApiError(null, 'system').category).toBe('unavailable');
	});
});
