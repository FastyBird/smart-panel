import { describe, expect, it } from 'vitest';

import { isValidHeadersJson, parseHeadersJson } from './webhook-headers.schemas';

describe('isValidHeadersJson', () => {
	it.each(['{}', '{"Authorization":"Bearer token"}', '{"X-One":"1","X-Two":"2"}'])('accepts a flat JSON object of strings: %s', (value) => {
		expect(isValidHeadersJson(value)).toBe(true);
	});

	it.each(['not-json', '[]', '{"a":1}', '{"a":{"b":"c"}}', '"just a string"'])('rejects %s', (value) => {
		expect(isValidHeadersJson(value)).toBe(false);
	});

	it('rejects a non-string header value', () => {
		expect(isValidHeadersJson('{"X-Retry":1}')).toBe(false);
	});

	it('rejects a header name containing a space', () => {
		expect(isValidHeadersJson('{"bad header":"value"}')).toBe(false);
	});

	it('rejects a header name containing a colon', () => {
		expect(isValidHeadersJson('{"X-Bad:Name":"value"}')).toBe(false);
	});

	it('accepts a well-formed header name', () => {
		expect(isValidHeadersJson('{"X-Custom-Header":"1"}')).toBe(true);
	});
});

describe('parseHeadersJson', () => {
	it('parses a valid JSON object', () => {
		expect(parseHeadersJson('{"Authorization":"Bearer token"}')).toEqual({ Authorization: 'Bearer token' });
	});
});
