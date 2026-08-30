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

export const HOMEY_CLOUD_AUTHORIZE_URL = 'https://api.athom.com/oauth2/authorise';

export const HOMEY_CLOUD_API_URL = 'https://api.athom.com';

export const HOMEY_CLOUD_TOKEN_URL = `${HOMEY_CLOUD_API_URL}/oauth2/token`;

export const HOMEY_CLOUD_HOMEY_HOST_SUFFIX = '.connect.athom.com';

export const HOMEY_CLOUD_CALLBACK_PATH = '/api/v1/plugins/devices-homey/oauth/callback';

export const HOMEY_CLOUD_RESULT_PATH = `/config/plugins/${DEVICES_HOMEY_PLUGIN_NAME}`;

export const HOMEY_CLOUD_MAX_TRANSACTION_ID_LENGTH = 128;

export const MAX_HOMEY_CLOUD_CLIENT_VALUE_LENGTH = 2048;

export const HOMEY_CLOUD_SCOPES = [
	'homey.system.readonly',
	'homey.zone.readonly',
	'homey.device.readonly',
	'homey.device.control',
] as const;

export const HOMEY_CLOUD_AUTHORIZATION_STATE_TTL_MS = 5 * 60 * 1000;

export const HOMEY_CLOUD_MAX_PENDING_AUTHORIZATIONS = 32;

export const HOMEY_CLOUD_AUTHORIZATION_STATE_KEY = 'primary';

export const HOMEY_CLOUD_ACTIVE_GRANT_KEY = 'primary';

export const HOMEY_CLOUD_PENDING_GRANT_TTL_MS = 10 * 60 * 1000;

export const HOMEY_CLOUD_CANCELLED_AUTHORIZATION_TTL_MS = HOMEY_CLOUD_PENDING_GRANT_TTL_MS;

export const HOMEY_CLOUD_PENDING_GRANT_CLEANUP_INTERVAL_MS = 60 * 1000;

export const HOMEY_CLOUD_RUNTIME_ACTIVATION_RETRY_INITIAL_MS = 1000;

export const HOMEY_CLOUD_RUNTIME_ACTIVATION_RETRY_MAX_MS = 30000;

export const HOMEY_CLOUD_RUNTIME_TEARDOWN_RETRY_INITIAL_MS = 1000;

export const HOMEY_CLOUD_RUNTIME_TEARDOWN_RETRY_MAX_MS = 30000;

export const HOMEY_CLOUD_PROVIDER_TIMEOUT_MS = 10 * 1000;

export const HOMEY_CLOUD_TOKEN_REFRESH_SKEW_MS = 60 * 1000;

export const HOMEY_CLOUD_MAX_AUTHORIZATION_CODE_LENGTH = 4096;

export const HOMEY_CLOUD_MAX_TOKEN_LENGTH = 16 * 1024;

export const HOMEY_CLOUD_MAX_HOMEY_ID_LENGTH = 255;

export const HOMEY_CLOUD_MAX_HOMEY_NAME_LENGTH = 120;

export enum HomeyConnectionMode {
	LOCAL = 'local',
	CLOUD = 'cloud',
}

export enum HomeyConnectionState {
	STOPPED = 'stopped',
	CONNECTING = 'connecting',
	CONNECTED = 'connected',
	DEGRADED_POLLING = 'degraded_polling',
	RECONNECTING = 'reconnecting',
	AUTHENTICATION_FAILED = 'authentication_failed',
	ERROR = 'error',
}
