import { Injectable } from '@nestjs/common';

import { EndpointHealth } from '../runtime/endpoint-connection';

/**
 * Owns the live endpoint connections. The pool itself is implemented later; the signatures below are the
 * stable contract used by the endpoints service and controller.
 */
@Injectable()
export class ModbusConnectionsService {
	/** Brings the running connections in line with the stored endpoints. */
	async reconcile(): Promise<void> {
		// Implemented with the connection pool
	}

	/** Returns the live health of an endpoint, or `null` when it is not running. */
	getHealth(_endpointId: string): EndpointHealth | null {
		return null;
	}
}
