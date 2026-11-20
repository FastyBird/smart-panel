import { describe, expect, it } from 'vitest';

import { DevicesUnifiProtectPluginErrorCategory, DevicesUnifiProtectPluginTlsMode } from '../../../openapi.constants';
import type { IProtectTestConnection } from '../store/protect.types';

import {
	type IProtectConnectionFields,
	buildTestRequest,
	formatProtectDate,
	isSameProtectTarget,
	protectTestTarget,
	protectTrustable,
} from './protect-config-form.utils';

const FINGERPRINT = 'ab'.repeat(32);

const saved = (overrides: Partial<IProtectConnectionFields> = {}): IProtectConnectionFields => ({
	host: '192.168.1.10',
	port: 443,
	apiKey: undefined,
	apiKeyConfigured: true,
	tls: { mode: 'verify', serverName: 'abc123.id.ui.direct', fingerprintSha256: null },
	...overrides,
});

const edited = (base: IProtectConnectionFields, overrides: Partial<IProtectConnectionFields>): IProtectConnectionFields => ({
	...structuredClone(base),
	...overrides,
});

const result = (overrides: Partial<IProtectTestConnection> = {}): IProtectTestConnection => ({
	mode: 'candidate',
	success: false,
	tlsMode: DevicesUnifiProtectPluginTlsMode.verify,
	certificate: {
		fingerprintSha256: FINGERPRINT,
		subjectCommonName: 'unifi.local',
		issuerCommonName: 'unifi.local',
		subjectAltNames: ['unifi.local'],
		validFrom: '2026-01-01T00:00:00.000Z',
		validTo: '2036-01-01T00:00:00.000Z',
		selfSigned: true,
		trusted: false,
	},
	minimumVersion: '7.2.105',
	errorCategory: DevicesUnifiProtectPluginErrorCategory.tls_untrusted,
	error: 'The console certificate is not trusted.',
	...overrides,
});

describe('buildTestRequest', () => {
	it('tests the candidate with the typed key and the saved config otherwise', () => {
		const initial = saved();

		expect(buildTestRequest(edited(initial, {}), initial)).toEqual({
			request: { data: { mode: 'saved' } },
			target: { host: '192.168.1.10', port: 443, tlsMode: 'verify', serverName: 'abc123.id.ui.direct' },
		});

		// A typed key alone is a change: the saved key is never what the test runs with then.
		expect(buildTestRequest(edited(initial, { apiKey: ' new-key ' }), initial)).toEqual({
			request: {
				data: {
					mode: 'candidate',
					host: '192.168.1.10',
					port: 443,
					api_key: 'new-key',
					tls: { mode: 'verify', server_name: 'abc123.id.ui.direct', fingerprint_sha256: null },
				},
			},
			target: { host: '192.168.1.10', port: 443, tlsMode: 'verify', serverName: 'abc123.id.ui.direct' },
		});

		const pinned = edited(initial, {
			host: ' 192.168.1.20 ',
			port: 7443,
			apiKey: 'new-key',
			tls: { mode: 'pinned', serverName: '', fingerprintSha256: FINGERPRINT.toUpperCase().match(/../g)!.join(':') },
		});

		expect(buildTestRequest(pinned, initial)).toEqual({
			request: {
				data: {
					mode: 'candidate',
					host: '192.168.1.20',
					port: 7443,
					api_key: 'new-key',
					tls: { mode: 'pinned', server_name: null, fingerprint_sha256: FINGERPRINT },
				},
			},
			target: { host: '192.168.1.20', port: 7443, tlsMode: 'pinned', serverName: null },
		});

		// Only the backend's own normalisation (trim, case) is not a change of console.
		expect(buildTestRequest(edited(initial, { host: ' 192.168.1.10 ' }), initial)).toMatchObject({ request: { data: { mode: 'saved' } } });
		expect(
			buildTestRequest(edited(initial, { tls: { mode: 'verify', serverName: 'ABC123.id.ui.direct ', fingerprintSha256: null } }), initial)
		).toMatchObject({
			request: { data: { mode: 'saved' } },
		});
	});

	it('leaves an invalid server name hidden by pinned mode out of a candidate test, as the save does', () => {
		const initial = saved({ tls: { mode: 'pinned', serverName: null, fingerprintSha256: FINGERPRINT } });
		const leftOver = edited(initial, { tls: { mode: 'pinned', serverName: '10.0.0.1', fingerprintSha256: FINGERPRINT } });

		// Not a change: the save would store no server name either, so the saved test still answers for it.
		expect(buildTestRequest(leftOver, initial)).toMatchObject({ request: { data: { mode: 'saved' } }, target: { serverName: null } });
		expect(buildTestRequest(edited(leftOver, { apiKey: 'new-key' }), initial)).toMatchObject({
			request: { data: { mode: 'candidate', tls: { mode: 'pinned', server_name: null } } },
		});
	});

	it('disables the test with a hint when a changed host has no typed key or the key is marked for removal', () => {
		const initial = saved();

		expect(buildTestRequest(edited(initial, { host: '192.168.1.20' }), initial)).toEqual({ disabled: true, hint: 'needs_key' });
		expect(buildTestRequest(edited(initial, { port: 8443 }), initial)).toEqual({ disabled: true, hint: 'needs_key' });
		expect(buildTestRequest(edited(initial, { tls: { mode: 'pinned', serverName: null, fingerprintSha256: FINGERPRINT } }), initial)).toEqual({
			disabled: true,
			hint: 'needs_key',
		});
		expect(buildTestRequest(edited(initial, { apiKey: null }), initial)).toEqual({ disabled: true, hint: 'needs_key' });
		expect(buildTestRequest(edited(initial, { host: '192.168.1.20', apiKey: '   ' }), initial)).toEqual({ disabled: true, hint: 'needs_key' });

		const unconfigured = saved({ apiKeyConfigured: false });

		expect(buildTestRequest(edited(unconfigured, {}), unconfigured)).toEqual({ disabled: true, hint: 'needs_key' });

		expect(buildTestRequest(edited(initial, { host: '', apiKey: 'new-key' }), initial)).toEqual({ disabled: true, hint: 'needs_host' });
		expect(buildTestRequest(edited(initial, { host: 'https://unifi.local', apiKey: 'new-key' }), initial)).toEqual({
			disabled: true,
			hint: 'needs_host',
		});
	});

	it('disables the test with a port hint instead of building a request for an empty or out-of-range port', () => {
		const initial = saved();

		for (const port of [null, undefined, 0, 65536, 44.5] as unknown as number[]) {
			expect(buildTestRequest(edited(initial, { port, apiKey: 'new-key' }), initial)).toEqual({ disabled: true, hint: 'needs_port' });
			expect(buildTestRequest(edited(initial, { port }), initial)).toEqual({ disabled: true, hint: 'needs_port' });
		}
	});
});

describe('protect test targets', () => {
	it('compares targets with the backend host normalisation', () => {
		const target = protectTestTarget(saved({ host: ' UNIFI.local ' }));
		const verify = DevicesUnifiProtectPluginTlsMode.verify;
		const serverName = 'abc123.id.ui.direct';

		expect(target).toEqual({ host: 'UNIFI.local', port: 443, tlsMode: 'verify', serverName });
		expect(isSameProtectTarget(target, { host: 'unifi.local', port: 443, tlsMode: verify, serverName })).toBe(true);
		expect(isSameProtectTarget(target, { host: 'unifi.local', port: 8443, tlsMode: verify, serverName })).toBe(false);
		expect(isSameProtectTarget(target, { host: 'unifi.local', port: 443, tlsMode: DevicesUnifiProtectPluginTlsMode.pinned, serverName })).toBe(false);
		expect(isSameProtectTarget(target, null)).toBe(false);
		expect(protectTestTarget(saved({ host: '  ' }))).toBeNull();
	});

	it('compares the server name in verify mode only, as a DNS name', () => {
		const verify = DevicesUnifiProtectPluginTlsMode.verify;
		const pinned = DevicesUnifiProtectPluginTlsMode.pinned;
		const base = { host: '192.168.1.10', port: 443 };

		expect(
			isSameProtectTarget({ ...base, tlsMode: verify, serverName: 'a.id.ui.direct' }, { ...base, tlsMode: verify, serverName: ' A.id.ui.direct ' })
		).toBe(true);
		expect(
			isSameProtectTarget({ ...base, tlsMode: verify, serverName: 'a.id.ui.direct' }, { ...base, tlsMode: verify, serverName: 'b.id.ui.direct' })
		).toBe(false);
		expect(isSameProtectTarget({ ...base, tlsMode: verify, serverName: null }, { ...base, tlsMode: verify, serverName: 'b.id.ui.direct' })).toBe(
			false
		);
		expect(isSameProtectTarget({ ...base, tlsMode: verify, serverName: '' }, { ...base, tlsMode: verify, serverName: null })).toBe(true);
		expect(
			isSameProtectTarget({ ...base, tlsMode: pinned, serverName: 'a.id.ui.direct' }, { ...base, tlsMode: pinned, serverName: 'b.id.ui.direct' })
		).toBe(true);
	});
});

describe('protectTrustable', () => {
	it('offers trust only for an untrusted chain in verify mode or a pin mismatch in pinned mode', () => {
		const verify = { mode: 'verify' as const, fingerprintSha256: null };
		const pinned = { mode: 'pinned' as const, fingerprintSha256: '33'.repeat(32) };
		const mismatch = result({
			tlsMode: DevicesUnifiProtectPluginTlsMode.pinned,
			errorCategory: DevicesUnifiProtectPluginErrorCategory.tls_fingerprint_mismatch,
		});

		expect(protectTrustable(result(), verify)).toBe('untrusted');
		expect(protectTrustable(result(), pinned)).toBe('none');
		// Replacing an existing pin needs confirmation; with no pin in the form there is nothing to replace.
		expect(protectTrustable(mismatch, pinned)).toBe('changed');
		expect(protectTrustable(mismatch, { mode: 'pinned', fingerprintSha256: null })).toBe('untrusted');
		expect(protectTrustable(mismatch, { mode: 'pinned', fingerprintSha256: '  ' })).toBe('untrusted');
		expect(protectTrustable(result({ errorCategory: DevicesUnifiProtectPluginErrorCategory.tls_fingerprint_mismatch }), verify)).toBe('none');
		expect(protectTrustable(result({ success: true, errorCategory: null }), verify)).toBe('none');
		expect(protectTrustable(result({ errorCategory: DevicesUnifiProtectPluginErrorCategory.authentication }), verify)).toBe('none');
		expect(protectTrustable(result({ certificate: null }), verify)).toBe('none');
		expect(protectTrustable(null, verify)).toBe('none');
	});
});

describe('formatProtectDate', () => {
	it('formats in the given app locale and keeps a value that does not parse', () => {
		const value = '2036-01-01T00:00:00.000Z';

		expect(formatProtectDate(value, 'cs-CZ')).toBe(new Intl.DateTimeFormat('cs-CZ', { dateStyle: 'medium' }).format(new Date(value)));
		expect(formatProtectDate(value, 'en-US')).toBe(new Intl.DateTimeFormat('en-US', { dateStyle: 'medium' }).format(new Date(value)));
		expect(formatProtectDate('not a date', 'en-US')).toBe('not a date');
	});
});
