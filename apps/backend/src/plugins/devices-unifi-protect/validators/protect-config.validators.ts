import { ValidationOptions, registerDecorator } from 'class-validator';
import { isIP } from 'net';

import { PROTECT_DEFAULT_PORT, PROTECT_TLS_MODES } from '../devices-unifi-protect.constants';

export const MAX_PROTECT_HOST_LENGTH = 253;

const DNS_LABEL = /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$/i;
const FINGERPRINT = /^[0-9a-f]{64}$/;

function isDnsName(value: string): boolean {
	if (value.length === 0 || value.length > MAX_PROTECT_HOST_LENGTH) {
		return false;
	}

	const labels = value.split('.');

	// An all-numeric last label would make a malformed IPv4 address (999.1.1.1) pass as a name.
	if (/^\d+$/.test(labels[labels.length - 1])) {
		return false;
	}

	return labels.every((label) => DNS_LABEL.test(label));
}

/** IPv4, IPv6 (no brackets) or RFC 1123 name; no scheme, port, path, userinfo or whitespace. */
export function isValidProtectHost(value: unknown): value is string {
	if (typeof value !== 'string' || value.length === 0 || value.length > MAX_PROTECT_HOST_LENGTH) {
		return false;
	}

	return isIP(value) !== 0 || isDnsName(value);
}

/** RFC 1123 DNS name only, never an IP address. */
export function isValidProtectServerName(value: unknown): value is string {
	return typeof value === 'string' && isIP(value) === 0 && isDnsName(value);
}

/** Strips colons and lower-cases; returns the 64 hex characters or null. */
export function normalizeProtectFingerprint(value: unknown): string | null {
	if (typeof value !== 'string') {
		return null;
	}

	const normalized = value.replace(/:/g, '').toLowerCase();

	return FINGERPRINT.test(normalized) ? normalized : null;
}

export function IsProtectHost(validationOptions?: ValidationOptions): PropertyDecorator {
	return (object: object, propertyName: string | symbol): void => {
		registerDecorator({
			name: 'isProtectHost',
			target: object.constructor,
			propertyName: propertyName as string,
			options: validationOptions,
			validator: { validate: (value: unknown): boolean => isValidProtectHost(value) },
		});
	};
}

export function IsProtectServerName(validationOptions?: ValidationOptions): PropertyDecorator {
	return (object: object, propertyName: string | symbol): void => {
		registerDecorator({
			name: 'isProtectServerName',
			target: object.constructor,
			propertyName: propertyName as string,
			options: validationOptions,
			validator: { validate: (value: unknown): boolean => isValidProtectServerName(value) },
		});
	};
}

export interface ProtectConfigError {
	message: string;
	field: string;
}

const asRecord = (value: unknown): Record<string, unknown> =>
	typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : {};

/**
 * First reason an enabled Protect config cannot start, or null when it is ready. Accepts the saved model (camelCase)
 * and the raw config (snake_case). Messages are fixed texts: they never carry a value.
 */
export function findProtectConfigError(config: Record<string, unknown>): ProtectConfigError | null {
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

	const tls = asRecord(config['tls']);
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
