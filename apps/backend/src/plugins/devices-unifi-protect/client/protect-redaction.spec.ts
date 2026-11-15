import { readFileSync } from 'fs';
import { resolve } from 'path';

import { PROTECT_REDACTED, redactProtectText } from './protect-redaction';

const KEY = 'PROTECT_SENTINEL_KEY_7f3a9c0d1e2b4a6f';
const ALIAS = 'SENTINELALIASprotect0123456789';

describe('protect-redaction', () => {
	it('removes the key literal and any X-API-KEY header value', () => {
		expect(redactProtectText(`failed with ${KEY}`, [KEY])).toBe('failed with <redacted>');
		expect(redactProtectText('X-API-KEY: abcdef123', [])).toBe('X-API-KEY: <redacted>');
		expect(redactProtectText('x-api-key=abcdef123&x=1', [])).toBe('x-api-key=<redacted>&x=1');
		expect(PROTECT_REDACTED).toBe('<redacted>');
	});

	it('removes every occurrence and the longest secret first', () => {
		expect(redactProtectText(`${KEY} ${KEY}`, [KEY])).toBe('<redacted> <redacted>');
		expect(redactProtectText('abcdXYZ', ['abcd', 'abcdXYZ'])).toBe('<redacted>');
	});

	it.each([
		[`rtsps://192.168.1.1:7441/${ALIAS}?enableSrtp`, 'rtsps://192.168.1.1:7441/<redacted>'],
		['rtspx://h:7441/abc', 'rtspx://h:7441/<redacted>'],
		['rtsp://h/abc', 'rtsp://h/<redacted>'],
	])('redacts the stream alias of %s', (input, output) => {
		const result = redactProtectText(input, []);

		expect(result).toBe(output);
		expect(result).not.toContain(ALIAS);
	});

	it('is idempotent and keeps the fixture host visible', () => {
		const fixture = readFileSync(resolve(__dirname, '../__fixtures__/rtsps-stream.json'), 'utf8');
		const text = `${fixture} X-API-KEY: ${KEY} rtsps://h:7441/${ALIAS}`;
		const once = redactProtectText(text, [KEY]);

		expect(redactProtectText(once, [KEY])).toBe(once);
		expect(once).toContain(':7441/');
		expect(once).not.toContain(KEY);
		expect(once).not.toContain(ALIAS);
	});

	it('ignores empty and short secrets', () => {
		expect(redactProtectText('abc', ['', 'ab'])).toBe('abc');
	});

	it('truncates to 1024 characters', () => {
		expect(redactProtectText('a'.repeat(5000), [])).toHaveLength(1024);
	});
});
