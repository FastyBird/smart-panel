import { redactGo2rtcOutput } from './go2rtc-redaction';

describe('redactGo2rtcOutput', () => {
	it('redacts every url scheme go2rtc may print', () => {
		expect(redactGo2rtcOutput('dial rtsps://console:7441/SENTINELALIAS0123456789?enableSrtp failed', [])).toBe(
			'dial rtsps://<redacted> failed',
		);
		expect(redactGo2rtcOutput('src=rtspx://c:7441/A ws=ws://127.0.0.1:11984/api/ws?src=x', [])).toBe(
			'src=rtspx://<redacted> ws=ws://<redacted>',
		);
		expect(redactGo2rtcOutput('a=RTSP://h/p b=https://h/p c=http://h/p d=wss://h/p', [])).toBe(
			'a=RTSP://<redacted> b=https://<redacted> c=http://<redacted> d=wss://<redacted>',
		);
	});

	it('redacts the userinfo of a url together with the rest of it', () => {
		expect(redactGo2rtcOutput('GET http://u:p@h/x', [])).toBe('GET http://<redacted>');
		expect(redactGo2rtcOutput('dial rtsp://admin:hunter2@cam.local:554/ch1?token=abc', [])).toBe(
			'dial rtsp://<redacted>',
		);
	});

	it('redacts registered literals even without a scheme', () => {
		expect(
			redactGo2rtcOutput('path=/SENTINELALIAS0123456789 pw=PW_SENTINEL_abcdef0123', [
				'/SENTINELALIAS0123456789',
				'PW_SENTINEL_abcdef0123',
			]),
		).toBe('path=<redacted> pw=<redacted>');
	});

	it('redacts the longest literal first and every occurrence', () => {
		expect(
			redactGo2rtcOutput('a=SECRETVALUE1 b=SECRETVALUE1_EXTENDED c=SECRETVALUE1', [
				'SECRETVALUE1',
				'SECRETVALUE1_EXTENDED',
			]),
		).toBe('a=<redacted> b=<redacted> c=<redacted>');
	});

	it('ignores empty literals and does not double a url that was a registered literal', () => {
		expect(redactGo2rtcOutput('plain text', [''])).toBe('plain text');
		expect(
			redactGo2rtcOutput('dial rtsps://console:7441/ALIAS0123456789 x', ['rtsps://console:7441/ALIAS0123456789']),
		).toBe('dial <redacted> x');
	});

	it('does not double a url whose registered literal starts after the scheme', () => {
		expect(redactGo2rtcOutput('rtsps://console:7441/ALIAS0123456789', ['console:7441/ALIAS0123456789'])).toBe(
			'rtsps://<redacted>',
		);
	});

	it('truncates long lines', () => {
		expect(redactGo2rtcOutput('x'.repeat(5000), [])).toHaveLength(1024);
	});

	it('redacts before it truncates', () => {
		const line = `${'x'.repeat(1010)} rtsps://console:7441/${'a'.repeat(200)}`;
		const redacted = redactGo2rtcOutput(line, []);

		expect(redacted).toHaveLength(1024);
		expect(redacted.endsWith('rtsps://<reda')).toBe(true);
		expect(redacted).not.toContain('aaaa');
	});
});
