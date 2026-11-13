import { parse } from 'yaml';

import { buildGo2rtcConfig } from './go2rtc-config';

const options = { apiPort: 11984, rtspPort: 18554, username: 'smart-panel', password: 'PW_SENTINEL_abcdef0123' };

describe('buildGo2rtcConfig', () => {
	it('generates the loopback-only document', () => {
		expect(buildGo2rtcConfig(options)).toBe(
			[
				'api:',
				'  listen: 127.0.0.1:11984',
				'  username: smart-panel',
				'  password: PW_SENTINEL_abcdef0123',
				'  local_auth: true',
				'rtsp:',
				'  listen: 127.0.0.1:18554',
				'  username: smart-panel',
				'  password: PW_SENTINEL_abcdef0123',
				'webrtc:',
				'  listen: ""',
				'srtp:',
				'  listen: ""',
				'log:',
				'  level: info',
				'  format: text',
				'',
			].join('\n'),
		);
	});

	it('binds every listener to loopback or disables it', () => {
		const text = buildGo2rtcConfig(options);
		const doc = parse(text) as Record<'api' | 'rtsp' | 'webrtc' | 'srtp', { listen: string; local_auth?: boolean }>;
		const listens = [doc.api.listen, doc.rtsp.listen, doc.webrtc.listen, doc.srtp.listen];

		expect(listens.every((l: string) => l === '' || l.startsWith('127.0.0.1:'))).toBe(true);
		expect(text).not.toMatch(/0\.0\.0\.0|:1984\b|:8554\b|:8555\b|streams:/);
		expect(doc.api.local_auth).toBe(true);
	});

	it.each(['', 'has space', 'quote"', 'line\nbreak', 'short_pw', 'x'.repeat(129)])(
		'refuses an unsafe password %#',
		(password) => {
			expect(() => buildGo2rtcConfig({ ...options, password })).toThrow('Invalid go2rtc password');
		},
	);

	it('refuses an unsafe username and does not echo the password', () => {
		expect(() => buildGo2rtcConfig({ ...options, username: 'Bad User' })).toThrow('Invalid go2rtc username');

		let thrown: unknown;

		try {
			buildGo2rtcConfig({ ...options, password: 'bad pw "x"' });
		} catch (e) {
			thrown = e;
		}

		expect(thrown).toBeInstanceOf(Error);
		expect((thrown as Error).message).toContain('Invalid go2rtc password');
		expect((thrown as Error).message).not.toContain('bad pw');
	});

	it.each([0, 70000, 1.5, Number.NaN])('refuses the port %s', (port) => {
		expect(() => buildGo2rtcConfig({ ...options, apiPort: port })).toThrow('Invalid go2rtc port');
		expect(() => buildGo2rtcConfig({ ...options, rtspPort: port })).toThrow('Invalid go2rtc port');
	});
});
