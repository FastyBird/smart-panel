import * as https from 'https';
import { Duplex } from 'stream';
import { PeerCertificate } from 'tls';
import * as tls from 'tls';

import { PROTECT_TLS_INSPECT_TIMEOUT_MS } from '../devices-unifi-protect.constants';
import { ProtectApiError, ProtectErrorCategory, toProtectApiError } from '../errors/protect-api.error';

import { connectVerifiedProtectTls } from './protect-tls-connect';
import {
	ProtectTlsConnectPlan,
	ProtectTlsSettings,
	peerFingerprint,
	planProtectTls,
	resolveProtectServername,
} from './protect-tls-policy';

export interface ProtectAgentOptions {
	host: string;
	port: number;
	tls: ProtectTlsSettings;
	/** Extra trusted CA (PEM) next to the system roots; used by tests only. */
	trustedCa?: string | Buffer;
	handshakeTimeoutMs?: number;
	/** TCP keep-alive probe delay of pooled sockets; the agent's `keepAlive` setting is always on. */
	keepAliveInitialDelayMs?: number;
}

const DEFAULT_KEEP_ALIVE_INITIAL_DELAY_MS = 30_000;

/** System roots plus the extra trusted CA (tests only); undefined keeps Node's default store. */
export const withExtraCa = (trustedCa: string | Buffer | undefined): (string | Buffer)[] | undefined =>
	trustedCa === undefined ? undefined : [...tls.rootCertificates, trustedCa];

/**
 * Per-instance agent that verifies the console certificate (chain and name, or SHA-256 pin) before the HTTP request
 * is released onto the socket. The connection always goes to the configured host and port, never to the request's.
 * Node's `http.Agent` writes nothing until `createConnection` calls back, so no request byte, header or API key
 * reaches an unverified peer.
 */
export class ProtectHttpsAgent extends https.Agent {
	readonly plan: ProtectTlsConnectPlan;

	private readonly host: string;
	private readonly port: number;
	private readonly ca: (string | Buffer)[] | undefined;
	private readonly handshakeTimeoutMs: number;
	private peerFingerprintValue: string | null = null;
	private closed = false;

	constructor(options: ProtectAgentOptions) {
		super({
			keepAlive: true,
			keepAliveInitialDelay: options.keepAliveInitialDelayMs ?? DEFAULT_KEEP_ALIVE_INITIAL_DELAY_MS,
			maxSockets: 4,
		});

		this.plan = planProtectTls(options.host, options.tls);
		this.host = options.host;
		this.port = options.port;
		this.ca = withExtraCa(options.trustedCa);
		this.handshakeTimeoutMs = options.handshakeTimeoutMs ?? PROTECT_TLS_INSPECT_TIMEOUT_MS;
	}

	get lastPeerFingerprint(): string | null {
		return this.peerFingerprintValue;
	}

	/** Marks the agent closed so a handshake still in flight cannot hand its socket to the pool afterwards. */
	destroy(): void {
		this.closed = true;
		super.destroy();
	}

	createConnection(
		_options: tls.ConnectionOptions,
		callback?: (error: Error | null, socket?: Duplex) => void,
	): undefined {
		connectVerifiedProtectTls({
			host: this.host,
			port: this.port,
			plan: this.plan,
			ca: this.ca,
			handshakeTimeoutMs: this.handshakeTimeoutMs,
			keepAlive: { enabled: this.options.keepAlive === true, initialDelayMs: this.options.keepAliveInitialDelay ?? 0 },
			onPeerFingerprint: (fingerprint) => {
				this.peerFingerprintValue = fingerprint;
			},
		}).then(
			({ socket }) => {
				if (this.closed) {
					// The agent was closed during the handshake; Node would otherwise pool the finished socket.
					socket.destroy();
					callback?.(new ProtectApiError(ProtectErrorCategory.CANCELLED, 'tls'));

					return;
				}

				callback?.(null, socket);
			},
			(error: unknown) => {
				callback?.(error instanceof Error ? error : toProtectApiError(error, 'tls'));
			},
		);

		return undefined;
	}
}

export interface ProtectCertificateInfo {
	fingerprintSha256: string;
	subjectCommonName: string | null;
	issuerCommonName: string | null;
	subjectAltNames: string[];
	validFrom: string;
	validTo: string;
	selfSigned: boolean;
	trusted: boolean;
	trustError: string | null;
}

const commonName = (name: PeerCertificate['subject'] | undefined): string | null => {
	const value: unknown = name?.CN;
	const first: unknown = Array.isArray(value) ? (value[0] as unknown) : value;

	return typeof first === 'string' && first.length > 0 ? first : null;
};

// "DNS:a.example, IP Address:10.0.0.2" -> ['a.example', '10.0.0.2']
const subjectAltNames = (value: string | undefined): string[] =>
	(value ?? '')
		.split(',')
		.map((entry) => entry.trim())
		.map((entry) => /^(?:DNS|IP Address):(.+)$/.exec(entry)?.[1] ?? null)
		.filter((entry): entry is string => entry !== null);

const toIso = (value: string): string => {
	const date = new Date(value);

	return Number.isNaN(date.getTime()) ? value : date.toISOString();
};

/**
 * Opens one TLS connection without verification, reads the presented leaf and reports whether it would have been
 * trusted. Writes nothing and always destroys the socket; nothing derived from it is ever trusted.
 */
export function inspectProtectCertificate(input: {
	host: string;
	port: number;
	serverName: string | null;
	trustedCa?: string | Buffer;
	timeoutMs?: number;
}): Promise<ProtectCertificateInfo> {
	return new Promise((resolve, reject) => {
		let settled = false;

		const finish = (result: ProtectApiError | ProtectCertificateInfo): void => {
			if (settled) {
				return;
			}

			settled = true;
			clearTimeout(timer);
			socket.destroy();

			if (result instanceof ProtectApiError) {
				reject(result);
			} else {
				resolve(result);
			}
		};

		const socket = tls.connect({
			host: input.host,
			port: input.port,
			servername: resolveProtectServername(input.host, input.serverName),
			rejectUnauthorized: false,
			ca: withExtraCa(input.trustedCa),
		});
		const timer = setTimeout(
			() => finish(new ProtectApiError(ProtectErrorCategory.TIMEOUT, 'tls')),
			input.timeoutMs ?? PROTECT_TLS_INSPECT_TIMEOUT_MS,
		);

		socket.once('error', (error) => finish(toProtectApiError(error, 'tls')));
		socket.once('secureConnect', () => {
			const certificate = socket.getPeerCertificate();
			const x509 = socket.getPeerX509Certificate();
			const fingerprint = peerFingerprint(certificate);

			if (fingerprint === null || x509 === undefined) {
				finish(new ProtectApiError(ProtectErrorCategory.PROTOCOL, 'tls'));

				return;
			}

			const authorizationError: unknown = socket.authorizationError;
			const trustError = socket.authorized
				? null
				: typeof authorizationError === 'string' && /^[A-Z0-9_]{1,64}$/.test(authorizationError)
					? authorizationError
					: 'UNKNOWN';

			finish({
				fingerprintSha256: fingerprint,
				subjectCommonName: commonName(certificate.subject),
				issuerCommonName: commonName(certificate.issuer),
				subjectAltNames: subjectAltNames(certificate.subjectaltname),
				validFrom: toIso(certificate.valid_from),
				validTo: toIso(certificate.valid_to),
				selfSigned: x509.subject === x509.issuer && x509.verify(x509.publicKey),
				trusted: socket.authorized,
				trustError,
			});
		});
	});
}
