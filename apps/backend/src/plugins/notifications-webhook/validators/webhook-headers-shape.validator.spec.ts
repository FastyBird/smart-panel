import { isValidHeaderRecord } from './webhook-headers-shape.validator';

describe('isValidHeaderRecord', () => {
	it('accepts an empty object', () => {
		expect(isValidHeaderRecord({})).toBe(true);
	});

	it('accepts a flat object of string values with valid header names', () => {
		expect(isValidHeaderRecord({ Authorization: 'Bearer token', 'X-Custom-Header': '1' })).toBe(true);
	});

	it('rejects a non-string value', () => {
		expect(isValidHeaderRecord({ 'X-Retry': 1 })).toBe(false);
	});

	it('rejects a boolean value', () => {
		expect(isValidHeaderRecord({ 'X-Enabled': true })).toBe(false);
	});

	it('rejects a header name containing a space', () => {
		expect(isValidHeaderRecord({ 'bad header': 'value' })).toBe(false);
	});

	it('rejects a header name containing a colon', () => {
		expect(isValidHeaderRecord({ 'X-Bad:Name': 'value' })).toBe(false);
	});

	it('rejects a value containing a NUL byte', () => {
		expect(isValidHeaderRecord({ 'X-Custom-Header': 'bad\0value' })).toBe(false);
	});

	it('rejects a value containing a carriage return', () => {
		expect(isValidHeaderRecord({ 'X-Custom-Header': 'bad\rvalue' })).toBe(false);
	});

	it('rejects a value containing a line feed', () => {
		expect(isValidHeaderRecord({ 'X-Custom-Header': 'bad\nvalue' })).toBe(false);
	});

	it('rejects a value that smuggles an extra header via CRLF', () => {
		expect(isValidHeaderRecord({ 'X-Custom-Header': 'value\r\nX-Injected: evil' })).toBe(false);
	});

	it('rejects a header name containing a NUL byte', () => {
		expect(isValidHeaderRecord({ 'X-Bad\0Name': 'value' })).toBe(false);
	});

	it('rejects a header name containing a carriage return or line feed', () => {
		expect(isValidHeaderRecord({ 'X-Bad\r\nName': 'value' })).toBe(false);
	});

	it('rejects an array', () => {
		expect(isValidHeaderRecord(['not', 'an', 'object'])).toBe(false);
	});

	it('rejects null', () => {
		expect(isValidHeaderRecord(null)).toBe(false);
	});

	it('rejects a non-object primitive', () => {
		expect(isValidHeaderRecord('not-an-object')).toBe(false);
	});
});
