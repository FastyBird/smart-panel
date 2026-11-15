import * as https from 'https';

import { PROTECT_TLS_INSPECT_TIMEOUT_MS } from '../devices-unifi-protect.constants';
import { ProtectApiError, ProtectErrorCategory, toProtectApiError } from '../errors/protect-api.error';

import { mapProtectHttpStatus } from './protect-api.client';
import { ProtectConsoleSystem } from './protect-api.types';
import { NodeProtectTransport } from './protect-http.transport';

const SYSTEM_PATH = '/api/system';
const SYSTEM_MAX_BYTES = 64 * 1024;

const stringOrNull = (value: unknown): string | null => (typeof value === 'string' ? value : null);

/**
 * Reads the console's unauthenticated `GET /api/system` (name, MAC, direct-connect domain) so setup can offer a
 * verifiable server name. The connection is deliberately unverified and carries no credential; nothing read here is
 * ever trusted for anything but pre-filling a form the administrator confirms.
 */
export async function fetchProtectConsoleSystem(input: {
	host: string;
	port: number;
	timeoutMs?: number;
}): Promise<ProtectConsoleSystem> {
	const agent = new https.Agent({ rejectUnauthorized: false, keepAlive: false });
	const transport = new NodeProtectTransport({ host: input.host, port: input.port, agent });

	try {
		const response = await transport.request({
			method: 'GET',
			path: SYSTEM_PATH,
			headers: { Accept: 'application/json' },
			timeoutMs: input.timeoutMs ?? PROTECT_TLS_INSPECT_TIMEOUT_MS,
			maxBytes: SYSTEM_MAX_BYTES,
		});

		if (response.status < 200 || response.status >= 300) {
			throw mapProtectHttpStatus('system', response.status, response.headers, response.body);
		}

		let parsed: unknown;

		try {
			parsed = JSON.parse(response.body.toString('utf8')) as unknown;
		} catch {
			throw new ProtectApiError(ProtectErrorCategory.PROTOCOL, 'system', { status: response.status });
		}

		if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
			throw new ProtectApiError(ProtectErrorCategory.PROTOCOL, 'system', { status: response.status });
		}

		const system = parsed as Record<string, unknown>;
		const hardware = system.hardware;

		return {
			name: stringOrNull(system.name),
			mac: stringOrNull(system.mac),
			shortname:
				typeof hardware === 'object' && hardware !== null
					? stringOrNull((hardware as Record<string, unknown>).shortname)
					: null,
			directConnectDomain: stringOrNull(system.directConnectDomain),
			deviceState: stringOrNull(system.deviceState),
		};
	} catch (error) {
		const typed = toProtectApiError(error, 'system');

		throw typed.operation === 'system'
			? typed
			: new ProtectApiError(typed.category, 'system', { status: typed.status, retryAfterMs: typed.retryAfterMs });
	} finally {
		transport.close();
	}
}
