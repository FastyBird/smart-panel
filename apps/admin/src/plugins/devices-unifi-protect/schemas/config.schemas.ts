import { z } from 'zod';

import { ConfigPluginEditFormSchema } from '../../../modules/config';
import {
	MAX_PROTECT_HOST_LENGTH,
	MAX_PROTECT_POLL_INTERVAL_MS,
	MAX_PROTECT_SNAPSHOT_MIN_INTERVAL_MS,
	MIN_PROTECT_POLL_INTERVAL_MS,
	MIN_PROTECT_SNAPSHOT_MIN_INTERVAL_MS,
} from '../devices-unifi-protect.constants';

// The rules below mirror the backend: apps/backend/src/plugins/devices-unifi-protect/dto/update-config.dto.ts and
// validators/protect-config.validators.ts (isValidProtectHost, isValidProtectServerName, normalizeProtectFingerprint,
// findProtectConfigError).

const DNS_LABEL = /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$/i;
const IPV4 = /^(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}$/;
const FINGERPRINT = /^[0-9a-f]{64}$/;

const isIpv6 = (value: string): boolean => {
	if (!value.includes(':') || !/^[0-9a-f:.]+$/i.test(value)) {
		return false;
	}

	try {
		return new URL(`http://[${value}]/`).hostname !== '';
	} catch {
		return false;
	}
};

export const isIpAddress = (value: string): boolean => IPV4.test(value) || isIpv6(value);

const isDnsName = (value: string): boolean => {
	if (value.length === 0 || value.length > MAX_PROTECT_HOST_LENGTH) {
		return false;
	}

	const labels = value.split('.');

	// An all-numeric last label would make a malformed IPv4 address (999.1.1.1) pass as a name.
	if (/^\d+$/.test(labels[labels.length - 1])) {
		return false;
	}

	return labels.every((label) => DNS_LABEL.test(label));
};

/** IPv4, IPv6 (no brackets) or RFC 1123 name; no scheme, port, path, userinfo or whitespace. */
export const isValidProtectHost = (value: string): boolean => value.length <= MAX_PROTECT_HOST_LENGTH && (isIpAddress(value) || isDnsName(value));

/** RFC 1123 DNS name only, never an IP address. */
export const isValidProtectServerName = (value: string): boolean => !isIpAddress(value) && isDnsName(value);

/** Strips colons and lower-cases; returns the 64 hex characters or null. */
export const normalizeProtectFingerprint = (value: unknown): string | null => {
	if (typeof value !== 'string') {
		return null;
	}

	const normalized = value.trim().replace(/:/g, '').toLowerCase();

	return FINGERPRINT.test(normalized) ? normalized : null;
};

export const isBlankProtectApiKeyReplacement = (value: string | null | undefined): boolean => typeof value === 'string' && value.trim() === '';

const blankToNull = (value: string | null | undefined): string | null | undefined =>
	typeof value === 'string' && value.trim() === '' ? null : value;

/**
 * The server name a config is saved and tested with, trimmed (null when blank). The form shows the field only in verify
 * mode, while the backend validates and uses (as SNI) a server name in either mode, so in pinned mode a name that is not
 * a valid DNS name, which the user can no longer see or fix, is dropped instead of having the backend refuse the save.
 */
export const protectServerNameFor = (tls: { mode: string; serverName?: string | null }): string | null => {
	const serverName = (tls.serverName ?? '').trim();

	if (serverName === '') {
		return null;
	}

	return tls.mode === 'pinned' && !isValidProtectServerName(serverName) ? null : serverName;
};

export const ProtectConfigEditFormSchema = ConfigPluginEditFormSchema.extend({
	host: z.string().nullable().optional(),
	// Backend: IsInt, Min(1), Max(65535).
	port: z.coerce.number().int().min(1).max(65535),
	apiKey: z.string().nullable().optional(),
	apiKeyConfigured: z.boolean().optional(),
	tls: z.object({
		mode: z.enum(['verify', 'pinned']),
		serverName: z.string().nullable().optional(),
		fingerprintSha256: z.string().nullable().optional(),
	}),
	streamHostOverride: z.string().nullable().optional(),
	defaultStreamQuality: z.enum(['high', 'medium', 'low']),
	snapshotMinIntervalMs: z.coerce.number().int().min(MIN_PROTECT_SNAPSHOT_MIN_INTERVAL_MS).max(MAX_PROTECT_SNAPSHOT_MIN_INTERVAL_MS),
	pollIntervalMs: z.coerce.number().int().min(MIN_PROTECT_POLL_INTERVAL_MS).max(MAX_PROTECT_POLL_INTERVAL_MS),
})
	.superRefine((value, context) => {
		const host = blankToNull(value.host);
		const serverName = blankToNull(value.tls.serverName);
		const streamHost = blankToNull(value.streamHostOverride);

		if (typeof host === 'string' && !isValidProtectHost(host.trim())) {
			context.addIssue({
				code: 'custom',
				path: ['host'],
				message: 'Host must be a host name or IP address without scheme, port, path or credentials',
			});
		}

		if (typeof streamHost === 'string' && !isValidProtectHost(streamHost.trim())) {
			context.addIssue({
				code: 'custom',
				path: ['streamHostOverride'],
				message: 'Stream host must be a host name or IP address without scheme, port, path or credentials',
			});
		}

		// Only verify mode shows the field; in pinned mode an invalid name is dropped (protectServerNameFor), not refused.
		if (value.tls.mode === 'verify' && typeof serverName === 'string' && !isValidProtectServerName(serverName.trim())) {
			context.addIssue({ code: 'custom', path: ['tls', 'serverName'], message: 'TLS server name must be a DNS name, not an IP address' });
		}

		// findProtectConfigError: a verify config with an IP host and no server name cannot start.
		if (value.tls.mode === 'verify' && serverName == null && typeof host === 'string' && isIpAddress(host.trim())) {
			context.addIssue({ code: 'custom', path: ['tls', 'serverName'], message: 'TLS server name is required when the host is an IP address' });
		}

		if (value.tls.mode === 'pinned' && normalizeProtectFingerprint(value.tls.fingerprintSha256) === null) {
			context.addIssue({
				code: 'custom',
				path: ['tls', 'fingerprintSha256'],
				message: 'Pinned TLS mode requires a SHA-256 certificate fingerprint',
			});
		}

		if (isBlankProtectApiKeyReplacement(value.apiKey)) {
			context.addIssue({ code: 'custom', path: ['apiKey'], message: 'A UniFi Protect API key replacement must not be blank' });
		}
	})
	.overwrite((value) => {
		const { apiKey, ...rest } = value;

		return {
			...rest,
			// `undefined` keeps the stored key, so the property must not reach the wire at all.
			...(apiKey === undefined ? {} : { apiKey }),
			host: typeof value.host === 'string' ? (blankToNull(value.host.trim()) ?? null) : value.host,
			streamHostOverride:
				typeof value.streamHostOverride === 'string' ? (blankToNull(value.streamHostOverride.trim()) ?? null) : value.streamHostOverride,
			tls: {
				mode: value.tls.mode,
				serverName: typeof value.tls.serverName === 'string' ? protectServerNameFor(value.tls) : value.tls.serverName,
				// A pin left over from an earlier pinned mode must not outlive the switch back to verify.
				fingerprintSha256: value.tls.mode === 'verify' ? null : normalizeProtectFingerprint(value.tls.fingerprintSha256),
			},
		};
	});
