import * as path from 'path';

import { isValidGo2rtcBinaryPath, isValidGo2rtcExternalUrl, normalizeGo2rtcExternalUrl } from './cameras.config.utils';
import { GO2RTC_DEFAULT_BINARY_PATH, GO2RTC_INSTALL_DIR } from './cameras.constants';

describe('cameras config utils', () => {
	it('keeps the install path and the default binary in step', () =>
		expect(path.join(GO2RTC_INSTALL_DIR, 'go2rtc')).toBe(GO2RTC_DEFAULT_BINARY_PATH));

	it.each(['/usr/local/lib/smart-panel/go2rtc/go2rtc', '/opt/go2rtc_linux_arm64'])('accepts the binary %s', (p) =>
		expect(isValidGo2rtcBinaryPath(p)).toBe(true),
	);

	it.each([
		'go2rtc',
		'./go2rtc',
		'/bin/sh',
		'/usr/bin/go2rtc\0x',
		'/usr/bin/go2rtc/',
		`/${'a'.repeat(4100)}/go2rtc`,
		42,
	])('refuses the binary %#', (p) => expect(isValidGo2rtcBinaryPath(p)).toBe(false));

	it.each(['http://192.168.1.5:1984', 'https://frigate.local:1984/'])('accepts the external url %s', (u) =>
		expect(isValidGo2rtcExternalUrl(u)).toBe(true),
	);

	it.each(['ftp://h', 'http://user:pw@h:1984', 'http://h:1984/?x=1', 'http://h:1984/#a', 'rtsp://h', 'h:1984', ''])(
		'refuses the external url %s',
		(u) => expect(isValidGo2rtcExternalUrl(u)).toBe(false),
	);

	it('normalizes trailing slashes', () => expect(normalizeGo2rtcExternalUrl('http://h:1984//')).toBe('http://h:1984'));
});
