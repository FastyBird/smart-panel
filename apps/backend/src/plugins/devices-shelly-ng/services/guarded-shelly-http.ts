import { request as httpRequest } from 'node:http';

/**
 * Send one nonce-correlated guard request within the caller's absolute deadline and live authority.
 * Recheck authority after connect, then notify onSend immediately before end() can send headers.
 * A matching response identifies this request; callers must still validate its action-specific evidence.
 */
export async function guardedShellyHttp<T>(
	url: URL,
	deadline: number,
	isCurrent: () => boolean,
	createRequest: typeof httpRequest = httpRequest,
	onSend?: () => void,
): Promise<T> {
	if (url.protocol !== 'http:' || url.username || url.password || !isCurrent() || Date.now() >= deadline)
		throw new Error('Shelly HTTP request is not admitted');
	const nonce = url.searchParams.get('nonce');
	if (!nonce) throw new Error('Shelly HTTP correlation missing');
	return new Promise<T>((resolve, reject) => {
		let pending = true;
		const request = createRequest(url, { method: 'GET', agent: false }, (response) => {
			if (response.statusCode !== 200 || response.headers['content-type']?.split(';')[0] !== 'application/json') {
				response.resume();
				request.destroy(new Error('Shelly guard endpoint refused or is unauthenticated'));
				return;
			}
			let body = '';
			response.setEncoding('utf8');
			response.on('data', (chunk: string) => {
				body += chunk;
				if (Buffer.byteLength(body, 'utf8') > 8192) request.destroy(new Error('Shelly guard response too large'));
			});
			response.on('error', (error) => finish(error));
			response.on('end', () => {
				try {
					if (!isCurrent() || Date.now() >= deadline) throw new Error('Shelly HTTP lease expired');
					const envelope = JSON.parse(body) as { result?: T; error?: unknown; nonce?: unknown };
					if (!Object.hasOwn(envelope, 'result') || envelope.error !== undefined || envelope.nonce !== nonce)
						throw new Error('Shelly guard error');
					finish(null, envelope.result);
				} catch (error) {
					finish(error as Error);
				}
			});
		});
		/** Settle once and retire the deadline timer so late response events cannot change the result. */
		function finish(error: Error | null, value?: T): void {
			if (!pending) return;
			pending = false;
			clearTimeout(timer);
			if (error) reject(error);
			else resolve(value);
		}
		/** Fence the header write after connect; once onSend runs, a failed write may still have reached the device. */
		const send = (): void => {
			try {
				if (!pending || !isCurrent() || Date.now() >= deadline) {
					request.destroy(new Error('Shelly HTTP authority expired before send'));
					return;
				}
				// From this boundary onward, an exception cannot prove that headers were not sent.
				onSend?.();
				request.end();
			} catch (error) {
				finish(error instanceof Error ? error : new Error('Shelly HTTP send failed'));
				request.destroy();
			}
		};
		request.on('error', (error) => finish(error));
		request.once('socket', (socket) => {
			if (socket.connecting) socket.once('connect', send);
			else send();
		});
		const timer = setTimeout(
			() => {
				finish(new Error('Shelly HTTP deadline expired'));
				request.destroy();
			},
			Math.max(0, deadline - Date.now()),
		);
	});
}
