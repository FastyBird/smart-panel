import { timingSafeEqual } from 'crypto';
import { isIP } from 'net';

import { PROTECT_TLS_MODES, ProtectTlsMode } from '../devices-unifi-protect.constants';
import { ProtectApiError, ProtectErrorCategory } from '../errors/protect-api.error';
import { isValidProtectServerName, normalizeProtectFingerprint } from '../validators/protect-config.validators';

export interface ProtectTlsSettings {
	mode: ProtectTlsMode;
	serverName: string | null;
	fingerprintSha256: string | null;
}

export interface ProtectTlsConnectPlan {
	servername: string | undefined;
	rejectUnauthorized: boolean;
	pinnedFingerprint: string | null;
}

/** SNI and certificate name: the admin-confirmed server name, else the host when it is a DNS name, else none. */
export function resolveProtectServername(host: string, serverName: string | null): string | undefined {
	return serverName ?? (isIP(host) !== 0 ? undefined : host);
}

/**
 * The only two ways a Protect connection may be trusted: the chain and name verify (`verify`), or the presented leaf
 * equals the pinned SHA-256 (`pinned`). Anything else is a validation error; there is no unverified mode.
 */
export function planProtectTls(host: string, settings: ProtectTlsSettings): ProtectTlsConnectPlan {
	if (!(PROTECT_TLS_MODES as readonly unknown[]).includes(settings.mode)) {
		throw new ProtectApiError(ProtectErrorCategory.VALIDATION, 'tls');
	}

	if (settings.serverName !== null && !isValidProtectServerName(settings.serverName)) {
		throw new ProtectApiError(ProtectErrorCategory.VALIDATION, 'tls');
	}

	const servername = resolveProtectServername(host, settings.serverName);

	if (settings.mode === 'verify') {
		return { servername, rejectUnauthorized: true, pinnedFingerprint: null };
	}

	const pinnedFingerprint = normalizeProtectFingerprint(settings.fingerprintSha256);

	if (pinnedFingerprint === null) {
		throw new ProtectApiError(ProtectErrorCategory.VALIDATION, 'tls');
	}

	return { servername, rejectUnauthorized: false, pinnedFingerprint };
}

/** Normalized SHA-256 of the presented certificate, or null when Node did not report one. */
export function peerFingerprint(certificate: { fingerprint256?: string }): string | null {
	return normalizeProtectFingerprint(certificate.fingerprint256);
}

/** Constant-time comparison of two fingerprints; malformed input never matches. */
export function fingerprintsEqual(a: string, b: string): boolean {
	const left = normalizeProtectFingerprint(a);
	const right = normalizeProtectFingerprint(b);

	if (left === null || right === null) {
		return false;
	}

	return timingSafeEqual(Buffer.from(left, 'hex'), Buffer.from(right, 'hex'));
}
