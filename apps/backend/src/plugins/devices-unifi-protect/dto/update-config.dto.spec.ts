import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';

import { ConfigSecretsService } from '../../../modules/config/services/config-secrets.service';
import { DEVICES_UNIFI_PROTECT_PLUGIN_NAME } from '../devices-unifi-protect.constants';
import { ProtectConfigModel } from '../models/config.model';

import { ProtectUpdatePluginConfigDto } from './update-config.dto';

const build = (data: Record<string, unknown>): ProtectUpdatePluginConfigDto =>
	plainToInstance(ProtectUpdatePluginConfigDto, { type: DEVICES_UNIFI_PROTECT_PLUGIN_NAME, ...data });

describe('Protect update DTO', () => {
	it.each([
		[{ host: 'https://192.168.1.1' }, 'host'],
		[{ port: 0 }, 'port'],
		[{ port: 65536 }, 'port'],
		[{ tls: { mode: 'off' } }, 'mode'],
		[{ tls: { mode: 'insecure' } }, 'mode'],
		[{ tls: { fingerprint_sha256: 'abc' } }, 'fingerprint_sha256'],
		[{ tls: { server_name: '10.0.0.1' } }, 'server_name'],
		[{ default_stream_quality: 'package' }, 'default_stream_quality'],
		[{ snapshot_min_interval_ms: 499 }, 'snapshot_min_interval_ms'],
		[{ poll_interval_ms: 600001 }, 'poll_interval_ms'],
		[{ stream_host_override: 'rtsps://h' }, 'stream_host_override'],
	])('rejects %j', async (data, field) => {
		const errors = await validate(build(data));

		expect(errors.length).toBeGreaterThan(0);
		expect(JSON.stringify(errors)).toContain(field);
	});

	it.each([
		['port', { port: null }],
		['default_stream_quality', { default_stream_quality: null }],
		['snapshot_min_interval_ms', { snapshot_min_interval_ms: null }],
		['poll_interval_ms', { poll_interval_ms: null }],
		['mode', { tls: { mode: null } }],
		['tls', { tls: null }],
	])('rejects an explicit null for the non-nullable %s', async (field, data) => {
		const errors = await validate(build(data));

		expect(JSON.stringify(errors)).toContain(field);
	});

	it('accepts a complete valid update', async () => {
		const errors = await validate(
			build({
				host: 'unvr.local',
				port: 8443,
				api_key: 'k',
				tls: { mode: 'pinned', server_name: 'x.id.ui.direct', fingerprint_sha256: 'ab'.repeat(32) },
				stream_host_override: '192.168.1.5',
				default_stream_quality: 'high',
				snapshot_min_interval_ms: 500,
				poll_interval_ms: 5000,
			}),
		);

		expect(errors).toEqual([]);
	});

	it('normalizes a colon-separated upper-case fingerprint', async () => {
		const hex = 'ab'.repeat(32);
		const dto = build({ tls: { fingerprint_sha256: hex.toUpperCase().match(/../g).join(':') } });

		expect(dto.tls?.fingerprintSha256).toBe(hex);
		expect(await validate(dto)).toEqual([]);
	});

	it('keeps explicit nulls on nullable fields and leaves omitted ones undefined', async () => {
		const cleared = build({
			host: null,
			api_key: null,
			stream_host_override: null,
			tls: { server_name: null, fingerprint_sha256: null },
		});

		expect(cleared.host).toBeNull();
		expect(cleared.apiKey).toBeNull();
		expect(cleared.streamHostOverride).toBeNull();
		expect(cleared.tls?.serverName).toBeNull();
		expect(cleared.tls?.fingerprintSha256).toBeNull();
		expect(await validate(cleared)).toEqual([]);

		const omitted = build({ tls: {} });

		expect(omitted.host).toBeUndefined();
		expect(omitted.streamHostOverride).toBeUndefined();
		expect(omitted.tls?.serverName).toBeUndefined();
		expect(omitted.tls?.fingerprintSha256).toBeUndefined();
		expect(await validate(omitted)).toEqual([]);
	});

	describe('merging into the stored config', () => {
		const secrets = new ConfigSecretsService();
		const fingerprint = 'cd'.repeat(32);
		const stored = (): ProtectConfigModel =>
			plainToInstance(ProtectConfigModel, {
				type: DEVICES_UNIFI_PROTECT_PLUGIN_NAME,
				host: 'unvr.local',
				stream_host_override: '10.0.0.9',
				tls: { mode: 'pinned', fingerprint_sha256: fingerprint },
			});
		const merge = (update: Record<string, unknown>): ProtectConfigModel =>
			plainToInstance(ProtectConfigModel, secrets.merge(stored(), build(update)));

		it('keeps stored tls fields that a nested update omits', () => {
			const merged = merge({ tls: { server_name: 'x.id.ui.direct' } });

			expect(merged.tls.mode).toBe('pinned');
			expect(merged.tls.fingerprintSha256).toBe(fingerprint);
			expect(merged.tls.serverName).toBe('x.id.ui.direct');
			expect(merged.streamHostOverride).toBe('10.0.0.9');
		});

		it('clears a stored nullable value on an explicit null', () => {
			const merged = merge({ stream_host_override: null, tls: { fingerprint_sha256: null } });

			expect(merged.streamHostOverride).toBeNull();
			expect(merged.tls.fingerprintSha256).toBeNull();
			expect(merged.tls.mode).toBe('pinned');
		});
	});
});
