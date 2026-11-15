import * as dns from 'dns';
import * as https from 'https';
import { isIP } from 'net';
import * as tls from 'tls';

import { NodeProtectTransport } from '../client/protect-http.transport';
import { planProtectTls } from '../client/protect-tls-policy';
import { ProtectApiError, ProtectErrorCategory } from '../errors/protect-api.error';

import { ProtectProbeHttp } from './protect-discovery-probe';
import {
	PROTECT_PROBE_MAX_BODY_BYTES,
	PROTECT_PROBE_TIMEOUT_MS,
	ProtectTransportErrorKind,
} from './protect-discovery.constants';

export interface ProtectProbeTarget {
	host: string;
	port: number;
}

export type ProtectCertificateCheck =
	| { ok: true; valid: boolean; errorCode: string | null; validTo: string | null }
	| { ok: false; kind: ProtectTransportErrorKind; code: string | null };

export interface ProtectProbeTransport {
	/** Never rejects. */
	get(target: ProtectProbeTarget, path: string, timeoutMs: number): Promise<ProtectProbeHttp>;
	/** Never rejects. */
	checkCertificate(target: ProtectProbeTarget, servername: string, timeoutMs: number): Promise<ProtectCertificateCheck>;
	/** IPs of a name; `[]` on any failure; an IP literal returns itself. */
	resolveAll(hostname: string): Promise<string[]>;
}

/** Certificate verdicts: the handshake reached a peer certificate and the chain or name failed verification. */
const CERTIFICATE_VERDICT_CODES = new Set([
	'CERT_HAS_EXPIRED',
	'CERT_NOT_YET_VALID',
	'DEPTH_ZERO_SELF_SIGNED_CERT',
	'SELF_SIGNED_CERT_IN_CHAIN',
	'UNABLE_TO_VERIFY_LEAF_SIGNATURE',
	'UNABLE_TO_GET_ISSUER_CERT',
	'UNABLE_TO_GET_ISSUER_CERT_LOCALLY',
	'ERR_TLS_CERT_ALTNAME_INVALID',
	'CERT_REVOKED',
]);

const errorCode = (error: unknown): string | null => {
	const code = (error as { code?: unknown } | null)?.code;

	return typeof code === 'string' ? code : null;
};

/** One code to kind mapping for `get` and `checkCertificate`; unknown or missing codes are `unreachable`. */
export const mapProtectTransportErrorCode = (code: string | null): ProtectTransportErrorKind => {
	if (code === null) {
		return 'unreachable';
	}

	if (code === 'ECONNREFUSED') {
		return 'refused';
	}

	if (code === 'ENOTFOUND' || code === 'EAI_AGAIN') {
		return 'dns';
	}

	if (code === 'ETIMEDOUT') {
		return 'timeout';
	}

	if (code === 'EPROTO' || code.startsWith('ERR_SSL_') || code.startsWith('ERR_TLS_')) {
		return 'tls';
	}

	return 'unreachable';
};

export class NodeProtectProbeTransport implements ProtectProbeTransport {
	private readonly ca: (string | Buffer)[] | undefined;

	constructor(options: { extraCa?: string } = {}) {
		this.ca = options.extraCa === undefined ? undefined : [...tls.rootCertificates, options.extraCa];
	}

	async get(target: ProtectProbeTarget, path: string, timeoutMs: number): Promise<ProtectProbeHttp> {
		// Unauthenticated request: nothing secret is sent, so an unverified certificate is acceptable here. The
		// verified check is `checkCertificate`.
		const transport = new NodeProtectTransport({
			host: target.host,
			port: target.port,
			agent: new https.Agent({ rejectUnauthorized: false, keepAlive: false }),
		});

		try {
			const response = await transport.request({
				method: 'GET',
				path,
				headers: { Accept: 'application/json' },
				timeoutMs,
				maxBytes: PROTECT_PROBE_MAX_BODY_BYTES,
			});

			return { ok: true, statusCode: response.status, body: response.body.toString('utf8') };
		} catch (error) {
			if (error instanceof ProtectApiError) {
				if (error.category === ProtectErrorCategory.TIMEOUT) {
					return { ok: false, kind: 'timeout', code: null };
				}

				if (error.category === ProtectErrorCategory.PROTOCOL) {
					return { ok: false, kind: 'protocol', code: 'body_too_large' };
				}

				return { ok: false, kind: 'unreachable', code: null };
			}

			const code = errorCode(error);

			return { ok: false, kind: mapProtectTransportErrorCode(code), code };
		} finally {
			transport.close();
		}
	}

	checkCertificate(
		target: ProtectProbeTarget,
		servername: string,
		timeoutMs: number,
	): Promise<ProtectCertificateCheck> {
		return new Promise((resolve) => {
			let socket: tls.TLSSocket | undefined;
			let settled = false;
			const finish = (result: ProtectCertificateCheck): void => {
				if (settled) {
					return;
				}

				settled = true;
				clearTimeout(timer);
				socket?.destroy();
				resolve(result);
			};
			const timer = setTimeout(() => finish({ ok: false, kind: 'timeout', code: null }), timeoutMs);

			try {
				const plan = planProtectTls(target.host, { mode: 'verify', serverName: servername, fingerprintSha256: null });

				socket = tls.connect({
					host: target.host,
					port: target.port,
					servername: plan.servername,
					rejectUnauthorized: plan.rejectUnauthorized,
					...(this.ca === undefined ? {} : { ca: this.ca }),
				});
			} catch {
				finish({ ok: false, kind: 'protocol', code: 'invalid_servername' });

				return;
			}

			socket.once('secureConnect', () => {
				const validTo = socket?.getPeerCertificate().valid_to;
				const parsed = validTo === undefined ? NaN : new Date(validTo).getTime();

				finish({
					ok: true,
					valid: true,
					errorCode: null,
					validTo: Number.isNaN(parsed) ? null : new Date(parsed).toISOString(),
				});
			});
			socket.on('error', (error) => {
				const code = errorCode(error);

				if (code !== null && CERTIFICATE_VERDICT_CODES.has(code)) {
					finish({ ok: true, valid: false, errorCode: code, validTo: null });

					return;
				}

				finish({ ok: false, kind: mapProtectTransportErrorCode(code), code });
			});
		});
	}

	async resolveAll(hostname: string): Promise<string[]> {
		if (isIP(hostname) !== 0) {
			return [hostname];
		}

		let timer: NodeJS.Timeout | undefined;

		try {
			const timeout = new Promise<string[]>((resolve) => {
				timer = setTimeout(() => resolve([]), PROTECT_PROBE_TIMEOUT_MS);
			});
			const lookup = dns.promises
				.lookup(hostname, { all: true })
				.then((addresses) => addresses.map((entry) => entry.address))
				.catch((): string[] => []);

			return await Promise.race([lookup, timeout]);
		} catch {
			return [];
		} finally {
			clearTimeout(timer);
		}
	}
}
