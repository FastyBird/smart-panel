import { HomeyTransportConnector } from './homey-local.connector';
import { HomeyTransport } from './homey-transport.interface';

/**
 * Cloud connector identity over the shared normalized connector core.
 * The cloud SDK session transport is supplied by the production factory in a
 * later Task 7.3 slice; no cloud concern enters mapping or device services.
 */
export class HomeyCloudConnector extends HomeyTransportConnector {
	constructor(transport: HomeyTransport) {
		super(transport);
	}
}
