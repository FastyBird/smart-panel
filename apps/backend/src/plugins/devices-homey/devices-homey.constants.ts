export const DEVICES_HOMEY_PLUGIN_PREFIX = 'devices-homey';

export const DEVICES_HOMEY_PLUGIN_NAME = 'devices-homey-plugin';

export const DEVICES_HOMEY_TYPE = 'devices-homey';

export const DEVICES_HOMEY_CONNECTOR_SERVICE_ID = 'connector';

export const HOMEY_CONNECTOR_FACTORY = Symbol('HOMEY_CONNECTOR_FACTORY');

export const DEVICES_HOMEY_PLUGIN_API_TAG_NAME = 'Devices Homey plugin';

export const DEVICES_HOMEY_PLUGIN_API_TAG_DESCRIPTION =
	'Endpoints for configuring and monitoring the Homey device provider integration.';

export const DEFAULT_HOMEY_CONNECTION_TIMEOUT_MS = 10000;

export const MIN_HOMEY_CONNECTION_TIMEOUT_MS = 1000;

export const MAX_HOMEY_CONNECTION_TIMEOUT_MS = 60000;

export const DEFAULT_HOMEY_RECONCILIATION_INTERVAL_MS = 300000;

export const MIN_HOMEY_RECONCILIATION_INTERVAL_MS = 30000;

export const MAX_HOMEY_RECONCILIATION_INTERVAL_MS = 3600000;

export const HOMEY_COMMAND_WRITE_TIMEOUT_MS = 10000;

export const HOMEY_COMMAND_CONFIRMATION_TIMEOUT_MS = 2000;

export const HOMEY_COMMAND_MAX_DURATION_MS = HOMEY_COMMAND_WRITE_TIMEOUT_MS * 4 + HOMEY_COMMAND_CONFIRMATION_TIMEOUT_MS;

export const HOMEY_FAILURE_LOG_INTERVAL_MS = 60000;

export const HOMEY_RECONNECT_INITIAL_DELAY_MS = 1000;

export const HOMEY_RECONNECT_MAX_DELAY_MS = 30000;

export const HOMEY_RECONNECT_JITTER_RATIO = 0.2;

export enum HomeyConnectionState {
	STOPPED = 'stopped',
	CONNECTING = 'connecting',
	CONNECTED = 'connected',
	DEGRADED_POLLING = 'degraded_polling',
	RECONNECTING = 'reconnecting',
	AUTHENTICATION_FAILED = 'authentication_failed',
	ERROR = 'error',
}
