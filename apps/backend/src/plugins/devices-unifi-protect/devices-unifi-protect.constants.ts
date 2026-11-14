export const DEVICES_UNIFI_PROTECT_PLUGIN_PREFIX = 'devices-unifi-protect';

export const DEVICES_UNIFI_PROTECT_PLUGIN_NAME = 'devices-unifi-protect-plugin';

export const DEVICES_UNIFI_PROTECT_TYPE = 'devices-unifi-protect';

export const DEVICES_UNIFI_PROTECT_CONNECTOR_SERVICE_ID = 'connector';

export const DEVICES_UNIFI_PROTECT_PLUGIN_API_TAG_NAME = 'Devices UniFi Protect plugin';

export const DEVICES_UNIFI_PROTECT_PLUGIN_API_TAG_DESCRIPTION =
	'Endpoints for configuring and monitoring the UniFi Protect device provider integration.';

export const PROTECT_MIN_VERSION = '7.2.105';

export const PROTECT_INTEGRATION_BASE_PATH = '/proxy/protect/integration';

export const PROTECT_DEFAULT_PORT = 443;

export const PROTECT_DEFAULT_SNAPSHOT_MIN_INTERVAL_MS = 2000;
export const PROTECT_MIN_SNAPSHOT_MIN_INTERVAL_MS = 500;
export const PROTECT_MAX_SNAPSHOT_MIN_INTERVAL_MS = 60000;

export const PROTECT_DEFAULT_POLL_INTERVAL_MS = 30000;
export const PROTECT_MIN_POLL_INTERVAL_MS = 5000;
export const PROTECT_MAX_POLL_INTERVAL_MS = 600000;

export const PROTECT_REQUEST_TIMEOUT_MS = 10000;
export const PROTECT_REQUEST_DEADLINE_MS = 30000;
export const PROTECT_MAX_ATTEMPTS = 3;
export const PROTECT_RETRY_BASE_DELAY_MS = 500;
export const PROTECT_MAX_RETRY_AFTER_MS = 60000;
export const PROTECT_TLS_INSPECT_TIMEOUT_MS = 5000;
export const PROTECT_MAX_JSON_BYTES = 2 * 1024 * 1024;
export const PROTECT_MAX_IMAGE_BYTES = 8 * 1024 * 1024;

export const PROTECT_RATE_UTILISATION = 0.8;
export const PROTECT_DEFAULT_RATE_POLICY = { quota: 10, windowSeconds: 1 } as const;

export const PROTECT_RECONNECT_INITIAL_DELAY_MS = 1000;
export const PROTECT_RECONNECT_MAX_DELAY_MS = 60000;
export const PROTECT_RECONNECT_JITTER_RATIO = 0.2;
export const PROTECT_HEALTH_CHECK_INTERVAL_MS = 60000;

export const PROTECT_TLS_MODES = ['verify', 'pinned'] as const;

export type ProtectTlsMode = (typeof PROTECT_TLS_MODES)[number];

export const PROTECT_STREAM_QUALITIES = ['high', 'medium', 'low'] as const;

export type ProtectStreamQuality = (typeof PROTECT_STREAM_QUALITIES)[number];

export enum ProtectConnectionState {
	DISCONNECTED = 'disconnected',
	CONNECTING = 'connecting',
	CONNECTED = 'connected',
	DEGRADED = 'degraded',
	AUTH_FAILED = 'auth_failed',
	VERSION_UNSUPPORTED = 'version_unsupported',
	ERROR = 'error',
}

// Plan 5 appends; the client never builds 'cameras/{id}/disable-mic-permanently'.
export const PROTECT_ENDPOINTS = [
	'meta/info',
	'nvrs',
	'cameras',
	'cameras/{id}',
	'cameras/{id}/rtsps-stream',
	'cameras/{id}/snapshot',
	'sensors',
	'lights',
] as const;

export type ProtectEndpoint = (typeof PROTECT_ENDPOINTS)[number];

/**
 * Injection token for an extra trusted CA (PEM) used by tests. The module registers it with `useValue: undefined`
 * so that tests can override it; production never sets it.
 */
export const PROTECT_TRUSTED_CA = Symbol('PROTECT_TRUSTED_CA');
