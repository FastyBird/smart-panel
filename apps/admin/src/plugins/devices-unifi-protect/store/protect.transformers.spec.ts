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

	it('maps a probe and a discovery with nulls', () => {
		const probe = {
			host: '192.168.1.10',
			port: 443,
			status: 'unreachable',
			failure: 'timeout',
			protect: 'unknown',
			model: null,
			certificate: null,
		};

		expect(transformProtectProbe(probe as never)).toEqual(expect.objectContaining({ failure: 'timeout', certificate: null }));

		const discovery = transformProtectDiscovery({
			status: 'failed',
			failureReason: 'no_usable_interface',
			warnings: ['no_replies'],
			startedAt: null,
			finishedAt: null,
			interfaces: [{ name: 'en0', address: '192.168.1.5', broadcastAddress: '192.168.1.255', status: 'error', errorCode: 'permission_denied' }],
			consoles: [{ mac: 'aa', host: '192.168.1.10', addresses: [], hostname: null, probe }],
			otherUnifiDevices: 1,
		} as never);

		expect(discovery.failureReason).toBe('no_usable_interface');
		expect(discovery.interfaces[0].broadcastAddress).toBe('192.168.1.255');
		expect(discovery.consoles[0].probe.status).toBe('unreachable');
	});

	it('rejects an unknown enum value', () => {
		expect(() => transformProtectProbe({ host: 'h', port: 1, status: 'mystery', protect: 'present' } as never)).toThrow(ProtectValidationException);
	});
});
