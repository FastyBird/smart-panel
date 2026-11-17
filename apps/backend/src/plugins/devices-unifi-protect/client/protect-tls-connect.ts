import * as tls from 'tls';

import { ProtectApiError, ProtectErrorCategory, toProtectApiError } from '../errors/protect-api.error';

import { ProtectTlsConnectPlan, fingerprintsEqual, peerFingerprint } from './protect-tls-policy';

export interface ProtectVerifiedTlsOptions {
	host: string;
	port: number;
	/** From `planProtectTls(host, settings)`, never built by hand. */
	plan: ProtectTlsConnectPlan;
	/** Trusted CAs (PEM); tests only (`PROTECT_TRUSTED_CA`). */
	ca?: (string | Buffer)[];
	handshakeTimeoutMs: number;
	signal?: AbortSignal;
	keepAlive?: { enabled: boolean; initialDelayMs: number };
	/** Called on `secureConnect` with the presented leaf's fingerprint, before the pin or chain check. */
	onPeerFingerprint?: (fingerprint: string | null) => void;
}

export interface ProtectVerifiedTlsConnection {
	socket: tls.TLSSocket;
	fingerprint: string | null;
}

/**
 * Resolves only with a socket whose leaf equals the pin (`pinned`) or that Node authorized (`verify`), renegotiation
 * disabled. Otherwise rejects ProtectApiError (operation 'tls'): tls_fingerprint_mismatch, tls_untrusted, timeout,
 * unreachable or cancelled, with the socket destroyed. Never resolves an unverified socket.
 *
 * Writes nothing: in `pinned` mode Node completes the handshake without a chain check (`rejectUnauthorized: false`), so
 * the socket is handed out only after the pin check below has passed.
 */
export function connectVerifiedProtectTls(options: ProtectVerifiedTlsOptions): Promise<ProtectVerifiedTlsConnection> {
	const { plan, signal } = options;

	if (signal?.aborted === true) {
		return Promise.reject(new ProtectApiError(ProtectErrorCategory.CANCELLED, 'tls'));
	}

	return new Promise((resolve, reject) => {
		let settled = false;

		const settle = (result: ProtectApiError | ProtectVerifiedTlsConnection): void => {
			if (settled) {
				return;
			}

			settled = true;
			clearTimeout(timer);
			signal?.removeEventListener('abort', onAbort);
			connection.removeListener('error', onError);
			connection.removeListener('secureConnect', onSecureConnect);
			// A late error (a reset after settling, or while the socket is being destroyed) must never go unhandled.
			connection.on('error', () => undefined);

			if (result instanceof ProtectApiError) {
				connection.destroy();
				reject(result);

				return;
			}

			// A renegotiating peer could swap the certificate we just verified.
			connection.disableRenegotiation();
			resolve(result);
		};

		const onError = (error: Error): void => settle(toProtectApiError(error, 'tls'));

		const onAbort = (): void => settle(new ProtectApiError(ProtectErrorCategory.CANCELLED, 'tls'));

		const onSecureConnect = (): void => {
			const fingerprint = peerFingerprint(connection.getPeerCertificate());

			options.onPeerFingerprint?.(fingerprint);

			if (plan.pinnedFingerprint !== null) {
				if (fingerprint === null || !fingerprintsEqual(fingerprint, plan.pinnedFingerprint)) {
					settle(new ProtectApiError(ProtectErrorCategory.TLS_FINGERPRINT_MISMATCH, 'tls'));

					return;
				}
			} else if (!connection.authorized) {
				// rejectUnauthorized already failed the handshake; this guards against an unverified verify-mode socket.
				settle(new ProtectApiError(ProtectErrorCategory.TLS_UNTRUSTED, 'tls'));

				return;
			}

			settle({ socket: connection, fingerprint });
		};

		const connection = tls.connect({
			host: options.host,
			port: options.port,
			servername: plan.servername,
			rejectUnauthorized: plan.rejectUnauthorized,
			ca: options.ca,
		});

		if (options.keepAlive !== undefined) {
			connection.setKeepAlive(options.keepAlive.enabled, options.keepAlive.initialDelayMs);
		}

		const timer = setTimeout(
			() => settle(new ProtectApiError(ProtectErrorCategory.TIMEOUT, 'tls')),
			options.handshakeTimeoutMs,
		);

		timer.unref();

		connection.once('error', onError);
		connection.once('secureConnect', onSecureConnect);
		signal?.addEventListener('abort', onAbort, { once: true });
	});
}
