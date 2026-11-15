import { instanceToPlain } from 'class-transformer';
import { validateSync } from 'class-validator';

import { toInstance } from '../../../common/utils/transform.utils';
import { ConfigSecretsService } from '../../../modules/config/services/config-secrets.service';
import { DEVICES_UNIFI_PROTECT_PLUGIN_NAME } from '../devices-unifi-protect.constants';

import { ProtectConfigModel } from './config.model';

describe('Protect configuration model', () => {
	it('defaults to verify mode on port 443 with the design defaults', () => {
		const c = toInstance(ProtectConfigModel, { type: DEVICES_UNIFI_PROTECT_PLUGIN_NAME });

		expect([
			c.port,
			c.tls.mode,
			c.tls.serverName,
			c.defaultStreamQuality,
			c.snapshotMinIntervalMs,
			c.pollIntervalMs,
		]).toEqual([443, 'verify', null, 'medium', 2000, 30000]);
		expect(c.tls.fingerprintSha256).toBeNull();
		expect(validateSync(c)).toHaveLength(0);
	});

	it('projects the key as api_key_configured and never serializes api_key', () => {
		const secrets = new ConfigSecretsService();
		const config = Object.assign(new ProtectConfigModel(), { host: 'unvr.local', apiKey: 'PROTECT_SENTINEL_KEY' });
		const projected = secrets.toPublic(config, [
			{ path: 'api_key', configuredPath: 'api_key_configured', inputPaths: ['apiKey'] },
		]) as unknown as Record<string, unknown>;

		expect(projected).not.toHaveProperty('api_key');
		expect(projected).not.toHaveProperty('apiKey');
		expect(projected).toHaveProperty('api_key_configured', true);
		expect(JSON.stringify(projected)).not.toContain('PROTECT_SENTINEL_KEY');
	});

	it('uses snake_case wire names for the nested and flat fields', () => {
		const plain = instanceToPlain(new ProtectConfigModel()) as Record<string, unknown>;

		expect(Object.keys(plain)).toEqual(
			expect.arrayContaining([
				'host',
				'port',
				'tls',
				'stream_host_override',
				'default_stream_quality',
				'snapshot_min_interval_ms',
				'poll_interval_ms',
			]),
		);
		expect(Object.keys(plain['tls'] as object).sort()).toEqual(['fingerprint_sha256', 'mode', 'server_name']);
	});

	it('loads a hand-edited config with an invalid host without validation errors', () => {
		const c = toInstance(ProtectConfigModel, { type: DEVICES_UNIFI_PROTECT_PLUGIN_NAME, host: 'https://x' });

		expect(c.host).toBe('https://x');
		expect(validateSync(c)).toHaveLength(0);
	});
});
