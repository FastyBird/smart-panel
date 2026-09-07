import type { ErrorResponse, MediaType, ResponseObjectMap } from 'openapi-typescript-helpers';
import { describe, expect, it } from 'vitest';

import { getErrorCode, getErrorReason } from './api-error.utils';

// A minimal fake operation shape - just enough of `{ responses: ... }` for `ResponseObjectMap<T>`
// to resolve to a real record instead of `unknown` (which would fail `ErrorResponse`'s own
// `T extends Record<string | number, any>` constraint). The real callers in this codebase pass a
// generated operation type (e.g. `RemoteAccessTailscalePluginGetStatusOperation`), which already
// has this shape - this fake exists only so the tests below can build an `error` value without
// importing one.
type FakeOperation = {
	responses: {
		default: {
			content: {
				'application/json': unknown;
			};
		};
	};
};

type TestError = ErrorResponse<ResponseObjectMap<FakeOperation>, MediaType>;

const withDetails = (details: unknown): TestError => ({ error: { details } }) as unknown as TestError;

const reason = (error: TestError, fallback: string): string => getErrorReason<FakeOperation>(error, fallback);

const code = (error: TestError): string | null => getErrorCode<FakeOperation>(error);

describe('getErrorReason', () => {
	it('returns the fallback message when the error has no details', () => {
		expect(reason(withDetails(undefined), 'fallback')).toBe('fallback');
	});

	it('returns the fallback message when details is null', () => {
		expect(reason(withDetails(null), 'fallback')).toBe('fallback');
	});

	it('returns the fallback message when details is not an object', () => {
		expect(reason(withDetails('not an object'), 'fallback')).toBe('fallback');
	});

	it('returns the fallback message when details has no reason field', () => {
		expect(reason(withDetails({ code: 'operator-not-granted' }), 'fallback')).toBe('fallback');
	});

	it('returns the fallback message when reason is not a string', () => {
		expect(reason(withDetails({ reason: 42 }), 'fallback')).toBe('fallback');
	});

	it('reads a single reason from an object details payload', () => {
		expect(reason(withDetails({ reason: 'The operator is not granted.' }), 'fallback')).toBe('The operator is not granted.');
	});

	it('joins every string reason from an array details payload', () => {
		expect(reason(withDetails([{ reason: 'First problem.' }, { reason: 'Second problem.' }]), 'fallback')).toBe('First problem., Second problem.');
	});

	it('falls back to the message when an array details payload has no string reasons', () => {
		expect(reason(withDetails([{ code: 'x' }, { reason: 1 }]), 'fallback')).toBe('fallback');
	});
});

describe('getErrorCode', () => {
	it('returns null when the error has no details', () => {
		expect(code(withDetails(undefined))).toBeNull();
	});

	it('returns null when details is null', () => {
		expect(code(withDetails(null))).toBeNull();
	});

	it('returns null when details is not an object', () => {
		expect(code(withDetails('not an object'))).toBeNull();
	});

	it('returns null when details has no code field', () => {
		expect(code(withDetails({ reason: 'Some reason.' }))).toBeNull();
	});

	it('returns null when code is not a string', () => {
		expect(code(withDetails({ code: 42 }))).toBeNull();
	});

	it('reads a single code from an object details payload', () => {
		expect(code(withDetails({ code: 'operator-not-granted', reason: 'The operator is not granted.' }))).toBe('operator-not-granted');
	});

	it('reads the first string code from an array details payload', () => {
		expect(code(withDetails([{ code: 'operator-not-granted' }, { code: 'daemon-not-active' }]))).toBe('operator-not-granted');
	});

	it('returns null for an array details payload with no string codes', () => {
		expect(code(withDetails([{ reason: 'Some reason.' }]))).toBeNull();
	});

	it('skips null and primitive entries in an array details payload instead of throwing', () => {
		expect(code(withDetails([null, 'a string entry', 42, { code: 'daemon-not-active' }]))).toBe('daemon-not-active');
	});
});
