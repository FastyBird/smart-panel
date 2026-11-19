import { readFileSync } from 'fs';
import { resolve } from 'path';

import { FAKE_PROTECT_ALIAS } from '../../../../test/support/fake-protect-server';
import { toGo2rtcSource } from '../../../modules/cameras/services/go2rtc-source';

import { redactProtectText } from './protect-redaction';
import { buildBridgeStreamUrl, parseProtectStreamUrl } from './protect-stream-url';

const ALIAS = 'REDACTEDALIAS00000';

describe('protect-stream-url', () => {
	it('parses the captured URL into port and alias', () => {
		const fixture = JSON.parse(readFileSync(resolve(__dirname, '../__fixtures__/rtsps-stream.json'), 'utf8')) as {
			high: string;
		};

		expect(parseProtectStreamUrl(fixture.high)).toEqual({ port: 7441, alias: ALIAS });
	});

	it('keeps a non-default console port and defaults to 7441', () => {
		expect(parseProtectStreamUrl(`rtsps://h:7447/${ALIAS}`)).toEqual({ port: 7447, alias: ALIAS });
		expect(parseProtectStreamUrl(`rtsps://h/${ALIAS}`)).toEqual({ port: 7441, alias: ALIAS });
	});

	it.each([
		['rtsp://h:7447/AAAAAAAAAA'],
		['rtspx://h:7441/AAAAAAAAAA'],
		['http://h/AAAAAAAAAA'],
		['rtsps://u:p@h:7441/AAAAAAAAAA'],
		['rtsps://h:7441/a/AAAAAAAAAA'],
		['rtsps://h:7441/short'],
		['rtsps://h:7441/' + 'A'.repeat(129)],
		['rtsps://h:7441/AAAA AAAAAA'],
		['rtsps://h:7441/AAAAAAAAAA#x'],
		['rtsps://h:0/AAAAAAAAAA'],
		['rtsps://h:7441/%41AAAAAAAAA'],
		['rtsps://h/a/../AAAAAAAAAA'],
		['rtsps://h/./AAAAAAAAAA'],
		['rtsps://h/%2e%2e/AAAAAAAAAA'],
		['rtsps://h/AAAA\nAAAAAA'],
		['rtsps://h/AAAA\tAAAAAA'],
		[' rtsps://h/AAAAAAAAAA'],
		['rtsps://h/AAAAAAAAAA '],
		['rtsps://h/AAAAAAAAAA\n'],
		['rtsps://@h/AAAAAAAAAA'],
		['rtsps://:@h/AAAAAAAAAA'],
		['rtsps://h\\x/AAAAAAAAAA'],
		['rtsps:///AAAAAAAAAA'],
		['rtsps://h/AAAAAAAAAA/'],
		[''],
		[null],
		[42],
	])('refuses %p', (value) => {
		expect(parseProtectStreamUrl(value)).toBeNull();
	});

	it('builds a plain rtsp bridge URL', () => {
		expect(buildBridgeStreamUrl({ host: '127.0.0.1', port: 40123 }, ALIAS)).toBe(`rtsp://127.0.0.1:40123/${ALIAS}`);
	});

	it('brackets an IPv6 bridge host', () => {
		expect(buildBridgeStreamUrl({ host: '::1', port: 40123 }, ALIAS)).toBe(`rtsp://[::1]:40123/${ALIAS}`);
	});

	it('refuses a bad bridge endpoint or alias', () => {
		expect(buildBridgeStreamUrl({ host: 'a b', port: 40123 }, ALIAS)).toBeNull();
		expect(buildBridgeStreamUrl({ host: '127.0.0.1', port: 0 }, ALIAS)).toBeNull();
		expect(buildBridgeStreamUrl({ host: '127.0.0.1', port: 40123 }, 'x')).toBeNull();
	});

	it('passes the core unchanged as an rtsp source', () => {
		const url = buildBridgeStreamUrl({ host: '127.0.0.1', port: 40123 }, ALIAS);

		expect(toGo2rtcSource({ url, transport: 'rtsp' })).toBe(url);
	});

	it('is fully redacted by the plugin redactor', () => {
		const url = buildBridgeStreamUrl({ host: '127.0.0.1', port: 40123 }, FAKE_PROTECT_ALIAS);

		expect(redactProtectText(`failed ${url}`, [])).not.toContain(FAKE_PROTECT_ALIAS);
	});

	it('drops the console host and query', () => {
		const result = parseProtectStreamUrl(`rtsps://h:7441/${FAKE_PROTECT_ALIAS}?enableSrtp&x=1`);

		expect(result).toEqual({ port: 7441, alias: FAKE_PROTECT_ALIAS });

		const text = JSON.stringify(result);

		expect(text).not.toContain('enableSrtp');
		expect(text).not.toContain('x=1');
		expect(text).not.toContain('rtsps');
	});

	it('accepts a bracketed IPv6 console host and drops it', () => {
		const result = parseProtectStreamUrl(`rtsps://[fd00::1]:7441/${FAKE_PROTECT_ALIAS}`);

		expect(result).toEqual({ port: 7441, alias: FAKE_PROTECT_ALIAS });
		expect(JSON.stringify(result)).not.toContain('fd00');
	});

	it('refuses an IPv6 zone id as a bridge host', () => {
		expect(buildBridgeStreamUrl({ host: 'fe80::1%en0', port: 40123 }, ALIAS)).toBeNull();
	});
});
