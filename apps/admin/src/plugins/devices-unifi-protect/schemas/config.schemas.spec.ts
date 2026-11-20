import { describe, expect, it, vi } from 'vitest';

import { transformConfigPluginUpdateRequest } from '../../../modules/config/store/config-plugins.transformers';
import {
	MAX_PROTECT_POLL_INTERVAL_MS,
	MAX_PROTECT_SNAPSHOT_MIN_INTERVAL_MS,
	MIN_PROTECT_POLL_INTERVAL_MS,
	MIN_PROTECT_SNAPSHOT_MIN_INTERVAL_MS,
} from '../devices-unifi-protect.constants';
import { ProtectConfigUpdateReqSchema } from '../store/config.store.schemas';

import { ProtectConfigEditFormSchema } from './config.schemas';

vi.mock('../../../modules/config', async () => {
	const schemas = await vi.importActual<typeof import('../../../modules/config/schemas/plugins.schemas')>(
		'../../../modules/config/schemas/plugins.schemas'
	);

	return { ConfigPluginEditFormSchema: schemas.ConfigPluginEditFormSchema };
});

const FINGERPRINT = 'AA:BB:CC:DD:EE:FF:00:11:22:33:44:55:66:77:88:99:AA:BB:CC:DD:EE:FF:00:11:22:33:44:55:66:77:88:99';

const createConfig = (overrides: Record<string, unknown> = {}) => ({
	type: 'devices-unifi-protect-plugin',
	enabled: true,
	host: 'protect.example.com',
	port: 443,
	apiKey: undefined,
	apiKeyConfigured: true,
	tls: { mode: 'verify', serverName: null, fingerprintSha256: null },
	streamHostOverride: null,
	defaultStreamQuality: 'medium',
	snapshotMinIntervalMs: 2000,
	pollIntervalMs: 30000,
	...overrides,
});

const issuePaths = (config: Record<string, unknown>): string[] => {
	const result = ProtectConfigEditFormSchema.safeParse(config);

	return result.success ? [] : result.error.issues.map((issue) => issue.path.join('.'));
};

describe('ProtectConfigEditFormSchema', () => {
	it('accepts a verify config with a domain host and no server name', () => {
		expect(ProtectConfigEditFormSchema.safeParse(createConfig()).success).toBe(true);
	});

	it('requires a server name for an IP host in verify mode', () => {
		expect(issuePaths(createConfig({ host: '192.168.1.1' }))).toContain('tls.serverName');
		expect(issuePaths(createConfig({ host: 'fd00::1' }))).toContain('tls.serverName');
		expect(
			ProtectConfigEditFormSchema.safeParse(
				createConfig({ host: '192.168.1.1', tls: { mode: 'verify', serverName: 'console.ui.direct', fingerprintSha256: null } })
			).success
		).toBe(true);
		// Pinned mode does not need a name to verify against.
		expect(
			ProtectConfigEditFormSchema.safeParse(
				createConfig({ host: '192.168.1.1', tls: { mode: 'pinned', serverName: null, fingerprintSha256: FINGERPRINT } })
			).success
		).toBe(true);
	});

	it('rejects a server name that is an IP address or not a DNS name', () => {
		expect(issuePaths(createConfig({ tls: { mode: 'verify', serverName: '10.0.0.1', fingerprintSha256: null } }))).toContain('tls.serverName');
		expect(issuePaths(createConfig({ tls: { mode: 'verify', serverName: 'bad name', fingerprintSha256: null } }))).toContain('tls.serverName');
	});

	it('does not check the hidden server name in pinned mode, and keeps it out of the request when invalid', () => {
		const leftOver = { mode: 'pinned', serverName: '10.0.0.1', fingerprintSha256: FINGERPRINT };
		const result = ProtectConfigEditFormSchema.safeParse(createConfig({ host: '10.0.0.1', tls: leftOver }));

		expect(result.success).toBe(true);
		if (result.success) {
			// The backend refuses an IP server name in either mode, so the one the user can no longer see is dropped.
			expect(result.data.tls.serverName).toBeNull();
		}

		const valid = ProtectConfigEditFormSchema.safeParse(
			createConfig({ tls: { mode: 'pinned', serverName: ' console.ui.direct ', fingerprintSha256: FINGERPRINT } })
		);

		expect(valid.success && valid.data.tls.serverName).toBe('console.ui.direct');
	});

	it('requires a valid fingerprint in pinned mode', () => {
		expect(issuePaths(createConfig({ tls: { mode: 'pinned', serverName: null, fingerprintSha256: null } }))).toContain('tls.fingerprintSha256');
		expect(issuePaths(createConfig({ tls: { mode: 'pinned', serverName: null, fingerprintSha256: 'abc' } }))).toContain('tls.fingerprintSha256');
		expect(
			ProtectConfigEditFormSchema.safeParse(createConfig({ tls: { mode: 'pinned', serverName: null, fingerprintSha256: FINGERPRINT } })).success
		).toBe(true);
	});

	it.each([0, 65536, 1.5, -1])('rejects the port %s outside 1-65535', (port) => {
		expect(issuePaths(createConfig({ port }))).toContain('port');
	});

	it.each([1, 65535])('accepts the port %s', (port) => {
		expect(ProtectConfigEditFormSchema.safeParse(createConfig({ port })).success).toBe(true);
	});

	it('rejects a host with a scheme, port or path', () => {
		for (const host of ['https://console', 'console:8443', 'console/path', 'user@console', 'bad host']) {
			expect(issuePaths(createConfig({ host }))).toContain('host');
		}
	});

	it('rejects poll and snapshot intervals outside the backend limits', () => {
		expect(issuePaths(createConfig({ pollIntervalMs: MIN_PROTECT_POLL_INTERVAL_MS - 1 }))).toContain('pollIntervalMs');
		expect(issuePaths(createConfig({ pollIntervalMs: MAX_PROTECT_POLL_INTERVAL_MS + 1 }))).toContain('pollIntervalMs');
		expect(issuePaths(createConfig({ snapshotMinIntervalMs: MIN_PROTECT_SNAPSHOT_MIN_INTERVAL_MS - 1 }))).toContain('snapshotMinIntervalMs');
		expect(issuePaths(createConfig({ snapshotMinIntervalMs: MAX_PROTECT_SNAPSHOT_MIN_INTERVAL_MS + 1 }))).toContain('snapshotMinIntervalMs');

		expect(
			ProtectConfigEditFormSchema.safeParse(
				createConfig({ pollIntervalMs: MIN_PROTECT_POLL_INTERVAL_MS, snapshotMinIntervalMs: MAX_PROTECT_SNAPSHOT_MIN_INTERVAL_MS })
			).success
		).toBe(true);
		expect(
			ProtectConfigEditFormSchema.safeParse(
				createConfig({ pollIntervalMs: MAX_PROTECT_POLL_INTERVAL_MS, snapshotMinIntervalMs: MIN_PROTECT_SNAPSHOT_MIN_INTERVAL_MS })
			).success
		).toBe(true);
	});

	it('rejects an unknown stream quality and an invalid stream host', () => {
		expect(issuePaths(createConfig({ defaultStreamQuality: 'ultra' }))).toContain('defaultStreamQuality');
		expect(issuePaths(createConfig({ streamHostOverride: 'http://nvr' }))).toContain('streamHostOverride');
	});

	it('rejects a blank key replacement and accepts null removal', () => {
		expect(issuePaths(createConfig({ apiKey: '   ' }))).toContain('apiKey');
		expect(issuePaths(createConfig({ apiKey: '' }))).toContain('apiKey');
		expect(ProtectConfigEditFormSchema.safeParse(createConfig({ apiKey: null })).success).toBe(true);
		expect(ProtectConfigEditFormSchema.safeParse(createConfig({ apiKey: 'new-key' })).success).toBe(true);
		expect(ProtectConfigEditFormSchema.safeParse(createConfig({ apiKey: undefined, apiKeyConfigured: false })).success).toBe(true);
	});

	it('normalizes a cleared host, server name and stream host to null', () => {
		const result = ProtectConfigEditFormSchema.safeParse(
			createConfig({ host: '  ', streamHostOverride: '', tls: { mode: 'verify', serverName: ' ', fingerprintSha256: null } })
		);

		expect(result.success).toBe(true);
		if (result.success) {
			expect(result.data.host).toBeNull();
			expect(result.data.streamHostOverride).toBeNull();
			expect(result.data.tls.serverName).toBeNull();
		}
	});
});

describe('Protect config update request', () => {
	const build = (overrides: Record<string, unknown> = {}) => {
		const form = ProtectConfigEditFormSchema.parse(createConfig(overrides));

		return transformConfigPluginUpdateRequest(form, ProtectConfigUpdateReqSchema) as Record<string, unknown>;
	};

	it('builds an update request in snake_case without an untouched key and with a null fingerprint in verify mode', () => {
		const request = build({ tls: { mode: 'verify', serverName: 'console.ui.direct', fingerprintSha256: FINGERPRINT } });

		expect(request).toEqual({
			type: 'devices-unifi-protect-plugin',
			enabled: true,
			host: 'protect.example.com',
			port: 443,
			tls: { mode: 'verify', server_name: 'console.ui.direct', fingerprint_sha256: null },
			stream_host_override: null,
			default_stream_quality: 'medium',
			snapshot_min_interval_ms: 2000,
			poll_interval_ms: 30000,
		});
		expect('api_key' in request).toBe(false);
		expect('api_key_configured' in request).toBe(false);
	});

	it('sends a replacement key, and null to remove it', () => {
		expect(build({ apiKey: 'new-key' }).api_key).toBe('new-key');
		expect(build({ apiKey: null }).api_key).toBeNull();
	});

	it('normalizes a pinned fingerprint to 64 lowercase hex characters', () => {
		const request = build({ tls: { mode: 'pinned', serverName: null, fingerprintSha256: FINGERPRINT } });

		expect((request.tls as Record<string, unknown>).fingerprint_sha256).toBe(FINGERPRINT.replace(/:/g, '').toLowerCase());
	});
});
