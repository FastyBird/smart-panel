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

	// A raw control byte makes the JSON itself malformed and is already caught by the JSON.parse
	// try/catch above - the gap this closes is a *validly escaped* control character, which
	// JSON.parse happily decodes into a real NUL/CR/LF in the parsed string.
	it('rejects a value containing an escaped NUL byte', () => {
		expect(isValidHeadersJson('{"X-Custom-Header":"bad\\u0000value"}')).toBe(false);
	});

	it('rejects a value containing an escaped carriage return', () => {
		expect(isValidHeadersJson('{"X-Custom-Header":"bad\\rvalue"}')).toBe(false);
	});

	it('rejects a value containing an escaped line feed', () => {
		expect(isValidHeadersJson('{"X-Custom-Header":"bad\\nvalue"}')).toBe(false);
	});

	it('rejects a value that smuggles an extra header via CRLF', () => {
		expect(isValidHeadersJson('{"X-Custom-Header":"value\\r\\nX-Injected: evil"}')).toBe(false);
	});

	it('rejects a header name containing an escaped NUL byte', () => {
		expect(isValidHeadersJson('{"X-Bad\\u0000Name":"value"}')).toBe(false);
	});

	it('rejects a header name containing an escaped carriage return or line feed', () => {
		expect(isValidHeadersJson('{"X-Bad\\r\\nName":"value"}')).toBe(false);
	});
});

describe('parseHeadersJson', () => {
	it('parses a valid JSON object', () => {
		expect(parseHeadersJson('{"Authorization":"Bearer token"}')).toEqual({ Authorization: 'Bearer token' });
	});
});
