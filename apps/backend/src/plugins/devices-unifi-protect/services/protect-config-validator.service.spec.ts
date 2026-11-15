import { PluginConfigValidatorService } from '../../../modules/config/services/plugin-config-validator.service';

import { ProtectConfigValidatorService } from './protect-config-validator.service';

describe('ProtectConfigValidatorService', () => {
	let register: jest.Mock;
	let service: ProtectConfigValidatorService;

	beforeEach(() => {
		register = jest.fn();
		service = new ProtectConfigValidatorService({ register } as unknown as PluginConfigValidatorService);
	});

	it('registers itself for the plugin type', () => {
		service.onModuleInit();

		expect(register).toHaveBeenCalledWith(service);
		expect(service.pluginType).toBe('devices-unifi-protect-plugin');
	});

	it('accepts an incomplete disabled configuration', async () =>
		expect(await service.validate({ enabled: false })).toEqual({ valid: true }));

	it.each([
		[{ api_key: 'k' }, 'host', 'UniFi Protect host is required'],
		[{ host: 'https://h', api_key: 'k' }, 'host', 'UniFi Protect host must be a hostname or IP address'],
		[{ host: 'h.local' }, 'api_key', 'UniFi Protect API key is required'],
		[{ host: 'h.local', api_key: 'k', port: 70000 }, 'port', 'UniFi Protect port must be between 1 and 65535'],
		[
			{ host: 'h.local', api_key: 'k', tls: { mode: 'pinned' } },
			'tls.fingerprint_sha256',
			'Pinned TLS mode requires a SHA-256 certificate fingerprint',
		],
		[
			{ host: 'h.local', api_key: 'k', tls: { mode: 'verify', server_name: '10.0.0.1' } },
			'tls.server_name',
			'TLS server name must be a DNS name',
		],
		[
			{ host: '10.0.0.2', api_key: 'k', tls: { mode: 'verify' } },
			'tls.server_name',
			'TLS server name is required when the host is an IP address',
		],
		[{ host: 'h.local', api_key: 'k', tls: { mode: 'insecure' } }, 'tls.mode', 'Unknown TLS mode'],
	])('blocks an enabled config missing %j', async (config, field, message) => {
		const result = await service.validate({ enabled: true, ...config });

		expect(result.valid).toBe(false);
		expect(result.errors?.[0]?.field).toBe(field);
		expect(result.errors?.[0]?.message).toBe(message);
	});

	it.each([
		[{ host: 'h.local', api_key: 'k' }],
		[{ host: '10.0.0.2', apiKey: 'k', tls: { mode: 'verify', serverName: 'x.id.ui.direct' } }],
		[{ host: '10.0.0.2', api_key: 'k', tls: { mode: 'pinned', fingerprint_sha256: 'AB:'.repeat(31) + 'AB' } }],
	])('accepts the ready config %j', async (config) => {
		expect(await service.validate({ enabled: true, ...config })).toEqual({ valid: true });
	});

	it('never echoes a submitted value in a message', async () => {
		const result = await service.validate({
			enabled: true,
			host: 'https://PROTECT_SENTINEL',
			api_key: 'PROTECT_SENTINEL_KEY_7f3a9c0d1e2b4a6f',
		});

		expect(result.valid).toBe(false);
		expect(JSON.stringify(result)).not.toContain('PROTECT_SENTINEL');
	});
});
