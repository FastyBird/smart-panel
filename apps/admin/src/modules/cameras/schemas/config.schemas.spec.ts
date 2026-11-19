import { describe, expect, it } from 'vitest';

import { CamerasModuleDataGo2rtcConfigMode } from '../../../openapi.constants';
import { ConfigValidationException } from '../../config/config.exceptions';
import { transformConfigModuleUpdateRequest } from '../../config/store/config-modules.store.transformers';

import { CamerasConfigEditFormSchema, CamerasConfigSchema, CamerasConfigUpdateReqSchema } from './config.schemas';

const valid = {
	type: 'cameras-module',
	enabled: true,
	go2rtc: {
		mode: CamerasModuleDataGo2rtcConfigMode.managed,
		binaryPath: '/usr/local/lib/smart-panel/go2rtc/go2rtc',
		externalUrl: null as string | null,
	},
	maxSessions: 8,
	maxSessionsPerCamera: 4,
};

const withGo2rtc = (go2rtc: Partial<typeof valid.go2rtc>) => ({ ...valid, go2rtc: { ...valid.go2rtc, ...go2rtc } });

describe('Cameras config schemas', () => {
	it('accepts the default config', () => {
		expect(CamerasConfigEditFormSchema.safeParse(valid).success).toBe(true);
		expect(CamerasConfigSchema.safeParse(valid).success).toBe(true);
	});

	it('rejects max_sessions 33 and max_sessions_per_camera 0', () => {
		expect(CamerasConfigEditFormSchema.safeParse({ ...valid, maxSessions: 33 }).success).toBe(false);
		expect(CamerasConfigEditFormSchema.safeParse({ ...valid, maxSessions: 0 }).success).toBe(false);
		expect(CamerasConfigEditFormSchema.safeParse({ ...valid, maxSessionsPerCamera: 0 }).success).toBe(false);
		expect(CamerasConfigEditFormSchema.safeParse({ ...valid, maxSessionsPerCamera: 17 }).success).toBe(false);
		expect(CamerasConfigEditFormSchema.safeParse({ ...valid, maxSessions: 1.5 }).success).toBe(false);
		expect(CamerasConfigEditFormSchema.safeParse({ ...valid, maxSessions: 32, maxSessionsPerCamera: 16 }).success).toBe(true);
	});

	it('rejects a relative binary path and one whose file name does not start with go2rtc', () => {
		for (const binaryPath of [
			'go2rtc',
			'./go2rtc',
			'bin/go2rtc',
			'/usr/bin/ffmpeg',
			'/usr/bin/xgo2rtc',
			'/usr/bin/go2rtc/',
			'/usr/bin/go2rtc\0',
			'/usr/bin/go2rtc bad',
			'',
		]) {
			expect(CamerasConfigEditFormSchema.safeParse(withGo2rtc({ binaryPath })).success, binaryPath).toBe(false);
		}

		for (const binaryPath of ['/go2rtc', '/opt/go2rtc_1.9.0', '/opt/go2rtc-linux.amd64']) {
			expect(CamerasConfigEditFormSchema.safeParse(withGo2rtc({ binaryPath })).success, binaryPath).toBe(true);
		}
	});

	it('checks the binary path only in managed mode', () => {
		for (const mode of [CamerasModuleDataGo2rtcConfigMode.external, CamerasModuleDataGo2rtcConfigMode.disabled]) {
			const parsed = CamerasConfigEditFormSchema.safeParse(withGo2rtc({ mode, binaryPath: 'go2rtc', externalUrl: 'http://192.168.1.5:1984' }));

			expect(parsed.success, mode).toBe(true);
		}

		expect(CamerasConfigEditFormSchema.safeParse(withGo2rtc({ binaryPath: 'go2rtc' })).success).toBe(false);
	});

	it('requires an external url in external mode', () => {
		const external = { mode: CamerasModuleDataGo2rtcConfigMode.external };

		expect(CamerasConfigEditFormSchema.safeParse(withGo2rtc({ ...external, externalUrl: null })).success).toBe(false);
		expect(CamerasConfigEditFormSchema.safeParse(withGo2rtc({ ...external, externalUrl: '' })).success).toBe(false);
		expect(CamerasConfigEditFormSchema.safeParse(withGo2rtc({ ...external, externalUrl: 'http://192.168.1.5:1984' })).success).toBe(true);
	});

	it('accepts only an http or https url without credentials, query or fragment', () => {
		const external = { mode: CamerasModuleDataGo2rtcConfigMode.external };

		for (const externalUrl of [
			'ftp://host',
			'host:1984',
			'http://u:p@host',
			'http://u@host',
			'http://host?a=1',
			'http://host?',
			'http://host#x',
			'http://host#',
			'not a url',
		]) {
			expect(CamerasConfigEditFormSchema.safeParse(withGo2rtc({ ...external, externalUrl })).success, externalUrl).toBe(false);
		}

		expect(CamerasConfigEditFormSchema.safeParse(withGo2rtc({ ...external, externalUrl: 'https://relay.example.com/go2rtc' })).success).toBe(true);
	});

	it('does not need an external url outside external mode, and turns an empty one into null', () => {
		const parsed = CamerasConfigEditFormSchema.safeParse(withGo2rtc({ mode: CamerasModuleDataGo2rtcConfigMode.disabled, externalUrl: '' }));

		expect(parsed.success).toBe(true);
		expect(parsed.data?.go2rtc.externalUrl).toBeNull();
	});

	const toRequest = (config: unknown) => transformConfigModuleUpdateRequest(config as never, CamerasConfigUpdateReqSchema);

	it('shapes the update request with snake_case keys', () => {
		const parsed = toRequest(valid);

		expect(parsed).toEqual({
			type: 'cameras-module',
			enabled: true,
			go2rtc: { mode: 'managed', binary_path: valid.go2rtc.binaryPath, external_url: null },
			max_sessions: 8,
			max_sessions_per_camera: 4,
		});
	});

	it.each([CamerasModuleDataGo2rtcConfigMode.external, CamerasModuleDataGo2rtcConfigMode.disabled])(
		'leaves the binary path out of the %s mode request, even when the stored one is invalid',
		(mode) => {
			const externalUrl = mode === CamerasModuleDataGo2rtcConfigMode.external ? 'http://192.168.1.5:1984' : null;

			expect(toRequest(withGo2rtc({ mode, binaryPath: 'go2rtc', externalUrl }))).toEqual({
				type: 'cameras-module',
				enabled: true,
				go2rtc: { mode, external_url: externalUrl },
				max_sessions: 8,
				max_sessions_per_camera: 4,
			});
		}
	);

	it('refuses a managed mode request with an invalid binary path', () => {
		expect(() => toRequest(withGo2rtc({ binaryPath: 'go2rtc' }))).toThrow(ConfigValidationException);
	});
});
