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
