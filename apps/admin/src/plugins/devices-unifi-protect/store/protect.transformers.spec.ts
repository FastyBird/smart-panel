import { describe, expect, it, vi } from 'vitest';

import { ProtectValidationException } from '../devices-unifi-protect.exceptions';

import { transformProtectDiscovery, transformProtectProbe, transformProtectStatus, transformProtectTestConnection } from './protect.transformers';

vi.mock('../../../common', async () => {
	const actual = await vi.importActual('../../../common');

	return { ...actual, logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), log: vi.fn(), fatal: vi.fn() } };
});

describe('Protect transformers', () => {
	it('maps a status with null optional fields to camelCase', () => {
		const status = transformProtectStatus({
			service_state: 'started',
			connection_state: 'auth_failed',
			enabled: true,
			configured: true,
			healthy: false,
			tls_mode: 'pinned',
			application_version: null,
			minimum_version: '6.0.0',
			nvr_id: null,
			nvr_name: null,
			last_connected_at: null,
			last_error_category: 'authentication',
			last_error: null,
			reconnect_attempt: 3,
			next_retry_at: null,
			realtime_state: 'stopped',
			ignored_event_count: 0,
		} as never);

		expect(status).toEqual(
			expect.objectContaining({
				connectionState: 'auth_failed',
				tlsMode: 'pinned',
				applicationVersion: null,
				lastErrorCategory: 'authentication',
				reconnectAttempt: 3,
			})
		);
	});

	it('maps a test result with a certificate and omitted optional fields', () => {
		const result = transformProtectTestConnection({
			mode: 'candidate',
			success: false,
			minimum_version: '6.0.0',
			error_category: 'tls_untrusted',
			certificate: {
				fingerprint_sha256: 'a'.repeat(64),
				subject_common_name: null,
				subject_alt_names: ['192.168.1.10'],
				valid_from: '2026-01-01T00:00:00Z',
				valid_to: '2027-01-01T00:00:00Z',
				self_signed: true,
				trusted: false,
			},
			suggested_server_name: 'console.ui.direct',
		} as never);

		expect(result.certificate).toEqual(expect.objectContaining({ fingerprintSha256: 'a'.repeat(64), selfSigned: true, subjectCommonName: null }));
		expect(result.suggestedServerName).toBe('console.ui.direct');
		expect(result.nvrName).toBeUndefined();
	});

	it('maps a probe and a discovery from snake_case wire bodies with nulls', () => {
		const probe = {
			host: '192.168.1.10',
			port: 443,
			status: 'unreachable',
			failure: 'timeout',
			protect: 'unknown',
			model: null,
			device_state: null,
			direct_connect_domain: 'abc.ui.direct',
			preferred_host: '192.168.1.10',
			certificate: { checked: true, domain: 'abc.ui.direct', valid: null, error_code: null, valid_to: null, domain_resolves_to_host: false },
		};

		expect(transformProtectProbe(probe as never)).toEqual(
			expect.objectContaining({
				failure: 'timeout',
				directConnectDomain: 'abc.ui.direct',
				preferredHost: '192.168.1.10',
				certificate: expect.objectContaining({ domainResolvesToHost: false, errorCode: null }),
			})
		);

		const discovery = transformProtectDiscovery({
			status: 'failed',
			failure_reason: 'no_usable_interface',
			warnings: ['no_replies'],
			started_at: null,
			finished_at: '2026-11-20T10:00:00Z',
			interfaces: [{ name: 'en0', address: '192.168.1.5', broadcast_address: '192.168.1.255', status: 'error', error_code: 'permission_denied' }],
			consoles: [{ mac: 'aa', host: '192.168.1.10', addresses: [], hostname: null, direct_connect_domain: null, probe }],
			other_unifi_devices: 1,
		} as never);

		expect(discovery.failureReason).toBe('no_usable_interface');
		expect(discovery.finishedAt).toBe('2026-11-20T10:00:00Z');
		expect(discovery.otherUnifiDevices).toBe(1);
		expect(discovery.interfaces[0]).toEqual(expect.objectContaining({ broadcastAddress: '192.168.1.255', errorCode: 'permission_denied' }));
		expect(discovery.consoles[0].probe.status).toBe('unreachable');
	});

	it('rejects an unknown enum value', () => {
		expect(() => transformProtectProbe({ host: 'h', port: 1, status: 'mystery', protect: 'present' } as never)).toThrow(ProtectValidationException);
	});
});
