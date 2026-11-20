import { describe, expect, it } from 'vitest';

import { DevicesUnifiProtectPluginErrorCategory, DevicesUnifiProtectPluginTlsMode } from '../../../openapi.constants';
import type { IProtectTestConnection } from '../store/protect.types';

import {
	type IProtectConnectionFields,
	buildTestRequest,
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
			target: { host: '192.168.1.10', port: 443, tlsMode: 'verify' },
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
			target: { host: '192.168.1.10', port: 443, tlsMode: 'verify' },
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
			target: { host: '192.168.1.20', port: 7443, tlsMode: 'pinned' },
		});

		// Only the backend's own normalisation (trim, case) is not a change of console.
		expect(buildTestRequest(edited(initial, { host: ' 192.168.1.10 ' }), initial)).toMatchObject({ request: { data: { mode: 'saved' } } });
		expect(
			buildTestRequest(edited(initial, { tls: { mode: 'verify', serverName: 'ABC123.id.ui.direct ', fingerprintSha256: null } }), initial)
		).toMatchObject({
			request: { data: { mode: 'saved' } },
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
});

describe('protect test targets', () => {
	it('compares targets with the backend host normalisation', () => {
		const target = protectTestTarget(saved({ host: ' UNIFI.local ' }));

		expect(target).toEqual({ host: 'UNIFI.local', port: 443, tlsMode: 'verify' });
		expect(isSameProtectTarget(target, { host: 'unifi.local', port: 443, tlsMode: DevicesUnifiProtectPluginTlsMode.verify })).toBe(true);
		expect(isSameProtectTarget(target, { host: 'unifi.local', port: 8443, tlsMode: DevicesUnifiProtectPluginTlsMode.verify })).toBe(false);
		expect(isSameProtectTarget(target, { host: 'unifi.local', port: 443, tlsMode: DevicesUnifiProtectPluginTlsMode.pinned })).toBe(false);
		expect(isSameProtectTarget(target, null)).toBe(false);
		expect(protectTestTarget(saved({ host: '  ' }))).toBeNull();
	});
});

describe('protectTrustable', () => {
	it('offers trust only for an untrusted chain in verify mode or a changed pin in pinned mode', () => {
		expect(protectTrustable(result(), 'verify')).toBe('untrusted');
		expect(protectTrustable(result(), 'pinned')).toBe('none');
		expect(
			protectTrustable(
				result({ tlsMode: DevicesUnifiProtectPluginTlsMode.pinned, errorCategory: DevicesUnifiProtectPluginErrorCategory.tls_fingerprint_mismatch }),
				'pinned'
			)
		).toBe('changed');
		expect(protectTrustable(result({ errorCategory: DevicesUnifiProtectPluginErrorCategory.tls_fingerprint_mismatch }), 'verify')).toBe('none');
		expect(protectTrustable(result({ success: true, errorCategory: null }), 'verify')).toBe('none');
		expect(protectTrustable(result({ errorCategory: DevicesUnifiProtectPluginErrorCategory.authentication }), 'verify')).toBe('none');
		expect(protectTrustable(result({ certificate: null }), 'verify')).toBe('none');
		expect(protectTrustable(null, 'verify')).toBe('none');
	});
});
