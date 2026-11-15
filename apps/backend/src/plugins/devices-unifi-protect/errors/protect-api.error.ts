import { PROTECT_MIN_VERSION, ProtectEndpoint } from '../devices-unifi-protect.constants';

export enum ProtectErrorCategory {
	VALIDATION = 'validation',
	UNREACHABLE = 'unreachable',
	TIMEOUT = 'timeout',
	TLS_UNTRUSTED = 'tls_untrusted',
	TLS_FINGERPRINT_MISMATCH = 'tls_fingerprint_mismatch',
	AUTHENTICATION = 'authentication',
	AUTHORIZATION = 'authorization',
	NOT_FOUND = 'not_found',
	BAD_REQUEST = 'bad_request',
	UNSUPPORTED = 'unsupported',
	RATE_LIMITED = 'rate_limited',
	UNAVAILABLE = 'unavailable',
	PROTOCOL = 'protocol',
	VERSION_UNSUPPORTED = 'version_unsupported',
	CANCELLED = 'cancelled',
}

export type ProtectOperation = ProtectEndpoint | 'tls' | 'system';

const RETRYABLE_CATEGORIES = new Set<ProtectErrorCategory>([
	ProtectErrorCategory.TIMEOUT,
	ProtectErrorCategory.UNREACHABLE,
	ProtectErrorCategory.UNAVAILABLE,
	ProtectErrorCategory.RATE_LIMITED,
	ProtectErrorCategory.PROTOCOL,
]);

/** Fixed user-facing texts; they never carry URLs, credentials, certificate data or transport messages. */
export const PROTECT_ERROR_MESSAGES: Record<ProtectErrorCategory, string> = {
	[ProtectErrorCategory.VALIDATION]: 'The UniFi Protect connection configuration is incomplete or invalid',
	[ProtectErrorCategory.UNREACHABLE]: 'The UniFi Protect console cannot be reached',
	[ProtectErrorCategory.TIMEOUT]: 'The UniFi Protect console did not answer in time',
	[ProtectErrorCategory.TLS_UNTRUSTED]: 'The certificate presented by the UniFi Protect console is not trusted',
	[ProtectErrorCategory.TLS_FINGERPRINT_MISMATCH]:
		'The certificate presented by the UniFi Protect console does not match the pinned fingerprint',
	[ProtectErrorCategory.AUTHENTICATION]: 'UniFi Protect rejected the API key',
	[ProtectErrorCategory.AUTHORIZATION]: 'The UniFi Protect API key does not have the required permissions',
	[ProtectErrorCategory.NOT_FOUND]: 'The requested UniFi Protect resource was not found',
	[ProtectErrorCategory.BAD_REQUEST]: 'UniFi Protect rejected the request',
	[ProtectErrorCategory.UNSUPPORTED]: 'The UniFi Protect console does not support this operation',
	[ProtectErrorCategory.RATE_LIMITED]: 'The UniFi Protect console is limiting requests, try again shortly',
	[ProtectErrorCategory.UNAVAILABLE]: 'The UniFi Protect console is unavailable',
	[ProtectErrorCategory.PROTOCOL]: 'The UniFi Protect console returned an unexpected response',
	[ProtectErrorCategory.VERSION_UNSUPPORTED]: `UniFi Protect ${PROTECT_MIN_VERSION} or newer is required`,
	[ProtectErrorCategory.CANCELLED]: 'The UniFi Protect request was cancelled',
};

export interface ProtectApiErrorDetails {
	status?: number | null;
	retryAfterMs?: number | null;
}

/**
 * Sanitized client failure. The message is built from the operation template and the category only; transport errors
 * (which can embed hosts, URLs or certificate data) are logged inside the client after redaction, never carried here.
 */
export class ProtectApiError extends Error {
	readonly category: ProtectErrorCategory;
	readonly operation: ProtectOperation;
	readonly status: number | null;
	readonly retryAfterMs: number | null;
	readonly retryable: boolean;

	constructor(category: ProtectErrorCategory, operation: ProtectOperation, details: ProtectApiErrorDetails = {}) {
		super(`UniFi Protect request '${operation}' failed (${category})`);

		this.name = 'ProtectApiError';
		this.category = category;
		this.operation = operation;
		this.status = details.status ?? null;
		this.retryAfterMs = details.retryAfterMs ?? null;
		this.retryable = RETRYABLE_CATEGORIES.has(category);
	}
}

const TLS_UNTRUSTED_CODES = new Set([
	'DEPTH_ZERO_SELF_SIGNED_CERT',
	'SELF_SIGNED_CERT_IN_CHAIN',
	'UNABLE_TO_VERIFY_LEAF_SIGNATURE',
	'UNABLE_TO_GET_ISSUER_CERT',
	'UNABLE_TO_GET_ISSUER_CERT_LOCALLY',
	'CERT_HAS_EXPIRED',
	'CERT_NOT_YET_VALID',
	'CERT_UNTRUSTED',
	'CERT_REVOKED',
	'ERR_TLS_CERT_ALTNAME_INVALID',
]);

const UNREACHABLE_CODES = new Set([
	'ECONNREFUSED',
	'EHOSTUNREACH',
	'ENETUNREACH',
	'ENOTFOUND',
	'EAI_AGAIN',
	'ECONNRESET',
	'EPIPE',
]);

const TIMEOUT_CODES = new Set(['ETIMEDOUT', 'ESOCKETTIMEDOUT', 'UND_ERR_CONNECT_TIMEOUT', 'UND_ERR_HEADERS_TIMEOUT']);

/** Maps a transport failure to a typed error; unknown failures become `unavailable`. */
export function toProtectApiError(error: unknown, operation: ProtectOperation): ProtectApiError {
	if (error instanceof ProtectApiError) {
		return error;
	}

	const code = typeof (error as { code?: unknown } | null)?.code === 'string' ? (error as { code: string }).code : null;
	const name = typeof (error as { name?: unknown } | null)?.name === 'string' ? (error as { name: string }).name : null;

	// A handshake the peer cannot complete (plain HTTP on the port, unsupported protocol) never improves by retrying.
	if (code !== null && (TLS_UNTRUSTED_CODES.has(code) || code === 'EPROTO' || code.startsWith('ERR_SSL_'))) {
		return new ProtectApiError(ProtectErrorCategory.TLS_UNTRUSTED, operation);
	}

	if (code !== null && TIMEOUT_CODES.has(code)) {
		return new ProtectApiError(ProtectErrorCategory.TIMEOUT, operation);
	}

	if (code !== null && UNREACHABLE_CODES.has(code)) {
		return new ProtectApiError(ProtectErrorCategory.UNREACHABLE, operation);
	}

	if (name === 'TimeoutError') {
		return new ProtectApiError(ProtectErrorCategory.TIMEOUT, operation);
	}

	if (name === 'AbortError' || code === 'ABORT_ERR') {
		return new ProtectApiError(ProtectErrorCategory.CANCELLED, operation);
	}

	return new ProtectApiError(ProtectErrorCategory.UNAVAILABLE, operation);
}
