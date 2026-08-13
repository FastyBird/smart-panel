export enum HomeyConnectorErrorCategory {
	AUTHENTICATION = 'authentication',
	AUTHORIZATION = 'authorization',
	TIMEOUT = 'timeout',
	UNAVAILABLE = 'unavailable',
	PROTOCOL = 'protocol',
	VALIDATION = 'validation',
	UNSUPPORTED = 'unsupported',
}

export enum HomeyConnectorOperation {
	CONNECT = 'connect',
	DISCONNECT = 'disconnect',
	GET_SYSTEM_INFO = 'get_system_info',
	GET_ZONES = 'get_zones',
	GET_DEVICES = 'get_devices',
	GET_DEVICE = 'get_device',
	SET_CAPABILITY_VALUE = 'set_capability_value',
	SUBSCRIBE = 'subscribe',
}

const RETRYABLE_CATEGORIES = new Set<HomeyConnectorErrorCategory>([
	HomeyConnectorErrorCategory.TIMEOUT,
	HomeyConnectorErrorCategory.UNAVAILABLE,
]);

/**
 * Sanitized connector failure exposed to downstream services. Transport errors
 * and their messages must be logged only inside the connector after redaction.
 */
export class HomeyConnectorError extends Error {
	readonly category: HomeyConnectorErrorCategory;
	readonly operation: HomeyConnectorOperation;
	readonly retryable: boolean;

	constructor(category: HomeyConnectorErrorCategory, operation: HomeyConnectorOperation) {
		super(`Homey connector operation '${operation}' failed (${category})`);

		this.name = 'HomeyConnectorError';
		this.category = category;
		this.operation = operation;
		this.retryable = RETRYABLE_CATEGORIES.has(category);
	}
}
