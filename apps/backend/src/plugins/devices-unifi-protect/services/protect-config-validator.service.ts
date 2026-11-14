import { isIP } from 'net';

import { Injectable, OnModuleInit } from '@nestjs/common';

import type {
	IConfigValidationResult,
	IPluginConfigValidator,
} from '../../../modules/config/services/plugin-config-validator.service';
import { PluginConfigValidatorService } from '../../../modules/config/services/plugin-config-validator.service';
import {
	DEVICES_UNIFI_PROTECT_PLUGIN_NAME,
	PROTECT_DEFAULT_PORT,
	PROTECT_TLS_MODES,
} from '../devices-unifi-protect.constants';
import {
	isValidProtectHost,
	isValidProtectServerName,
	normalizeProtectFingerprint,
} from '../validators/protect-config.validators';

// Messages are fixed texts: the manager logs them and stores them as lastError, so they never carry a value.
@Injectable()
export class ProtectConfigValidatorService implements IPluginConfigValidator, OnModuleInit {
	readonly pluginType = DEVICES_UNIFI_PROTECT_PLUGIN_NAME;

	constructor(private readonly pluginConfigValidator: PluginConfigValidatorService) {}

	onModuleInit(): void {
		this.pluginConfigValidator.register(this);
	}

	validate(config: Record<string, unknown>): Promise<IConfigValidationResult> {
		if (config['enabled'] !== true) {
			return Promise.resolve({ valid: true });
		}

		const error = this.firstError(config);

		return Promise.resolve(error ? { valid: false, errors: [error] } : { valid: true });
	}

	private firstError(config: Record<string, unknown>): { message: string; field: string } | null {
		const host = config['host'];

		if (typeof host !== 'string' || host.trim().length === 0) {
			return { message: 'UniFi Protect host is required', field: 'host' };
		}

		if (!isValidProtectHost(host)) {
			return { message: 'UniFi Protect host must be a hostname or IP address', field: 'host' };
		}

		const port = config['port'] ?? PROTECT_DEFAULT_PORT;

		if (typeof port !== 'number' || !Number.isInteger(port) || port < 1 || port > 65535) {
			return { message: 'UniFi Protect port must be between 1 and 65535', field: 'port' };
		}

		const apiKey = config['apiKey'] ?? config['api_key'];

		if (typeof apiKey !== 'string' || apiKey.trim().length === 0) {
			return { message: 'UniFi Protect API key is required', field: 'api_key' };
		}

		const tls = this.asRecord(config['tls']);
		const mode = tls['mode'] ?? 'verify';
		const serverName = tls['serverName'] ?? tls['server_name'] ?? null;
		const fingerprint = tls['fingerprintSha256'] ?? tls['fingerprint_sha256'] ?? null;

		if (typeof mode !== 'string' || !(PROTECT_TLS_MODES as readonly string[]).includes(mode)) {
			return { message: 'Unknown TLS mode', field: 'tls.mode' };
		}

		if (serverName !== null && !isValidProtectServerName(serverName)) {
			return { message: 'TLS server name must be a DNS name', field: 'tls.server_name' };
		}

		if (mode === 'verify' && serverName === null && isIP(host) !== 0) {
			return { message: 'TLS server name is required when the host is an IP address', field: 'tls.server_name' };
		}

		if (mode === 'pinned' && normalizeProtectFingerprint(fingerprint) === null) {
			return {
				message: 'Pinned TLS mode requires a SHA-256 certificate fingerprint',
				field: 'tls.fingerprint_sha256',
			};
		}

		return null;
	}

	private asRecord(value: unknown): Record<string, unknown> {
		return typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : {};
	}
}
