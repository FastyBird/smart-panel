import { Injectable } from '@nestjs/common';

import { createExtensionLogger } from '../../../common/logger';
import {
	CLOUDFLARED_METRICS_TIMEOUT_MS,
	REMOTE_ACCESS_CLOUDFLARE_TUNNEL_PLUGIN_NAME,
} from '../remote-access-cloudflare-tunnel.constants';

export interface CloudflaredReadyInfo {
	readyConnections: number;
	connectorId: string;
}

/**
 * Reads `cloudflared`'s own local `/ready` metrics endpoint
 * (`http://<CLOUDFLARED_METRICS_ADDRESS>/ready`) — the source of truth for whether the tunnel
 * has an active edge connection. Never throws: any failure (unreachable, non-2xx, malformed
 * body, timeout) resolves to `null`, which callers treat as "not ready yet" rather than an
 * error in its own right.
 */
@Injectable()
export class CloudflaredMetricsService {
	private readonly logger = createExtensionLogger(
		REMOTE_ACCESS_CLOUDFLARE_TUNNEL_PLUGIN_NAME,
		'CloudflaredMetricsService',
	);

	async fetchReady(address: string): Promise<CloudflaredReadyInfo | null> {
		try {
			const response = await fetch(`http://${address}/ready`, {
				signal: AbortSignal.timeout(CLOUDFLARED_METRICS_TIMEOUT_MS),
			});

			if (!response.ok) {
				return null;
			}

			const data = (await response.json()) as Record<string, unknown>;

			const readyConnections = typeof data.readyConnections === 'number' ? data.readyConnections : 0;
			const connectorId =
				typeof data.connectorId === 'string'
					? data.connectorId
					: typeof data.connectorID === 'string'
						? data.connectorID
						: '';

			return { readyConnections, connectorId };
		} catch (error) {
			this.logger.debug('Failed to fetch the cloudflared /ready endpoint', {
				message: error instanceof Error ? error.message : String(error),
			});

			return null;
		}
	}
}
