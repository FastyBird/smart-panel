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

export const PROTECT_SUBSCRIPTION_TOPICS = ['devices', 'events'] as const;

export type ProtectSubscriptionTopic = (typeof PROTECT_SUBSCRIPTION_TOPICS)[number];

export const PROTECT_WS_PING_INTERVAL_MS = 180_000;
export const PROTECT_WS_PONG_TIMEOUT_MS = 30_000;
export const PROTECT_MAX_FRAME_BYTES = 256 * 1024;
export const PROTECT_MAX_BUFFERED_FRAMES = 1000;
export const PROTECT_MAX_PENDING_FRAMES = 1000;
export const PROTECT_FAILURE_LOG_INTERVAL_MS = 60_000;
export const PROTECT_DEGRADED_AFTER_FAILURES = 3;
/** A streaming session that ends sooner counts as a failed cycle; the realtime issue resolves after this long. */
export const PROTECT_STABLE_STREAM_MS = 30_000;
export const PROTECT_EVENT_SAFETY_TIMEOUT_MS = 60_000;
export const PROTECT_MAX_SEEN_EVENTS = 1024;
export const PROTECT_MAX_OPEN_EVENTS = 256;

export const PROTECT_REALTIME_STATES = ['stopped', 'connecting', 'priming', 'streaming', 'polling'] as const;

export type ProtectRealtimeState = (typeof PROTECT_REALTIME_STATES)[number];

export const PROTECT_TLS_MODES = ['verify', 'pinned'] as const;

export type ProtectTlsMode = (typeof PROTECT_TLS_MODES)[number];

export const PROTECT_STREAM_QUALITIES = ['high', 'medium', 'low'] as const;

export type ProtectStreamQuality = (typeof PROTECT_STREAM_QUALITIES)[number];

export const PROTECT_RTSPS_QUALITIES = ['high', 'medium', 'low', 'package'] as const;

export type ProtectRtspsQuality = (typeof PROTECT_RTSPS_QUALITIES)[number];

export enum ProtectConnectionState {
	DISCONNECTED = 'disconnected',
	CONNECTING = 'connecting',
	CONNECTED = 'connected',
	DEGRADED = 'degraded',
	AUTH_FAILED = 'auth_failed',
	VERSION_UNSUPPORTED = 'version_unsupported',
	ERROR = 'error',
}

// Plan 5 appended the two subscriptions; the client never builds 'cameras/{id}/disable-mic-permanently'.
export const PROTECT_ENDPOINTS = [
	'meta/info',
	'nvrs',
	'cameras',
	'cameras/{id}',
	'cameras/{id}/rtsps-stream',
	'cameras/{id}/snapshot',
	'sensors',
	'sensors/{id}',
	'lights',
	'lights/{id}',
	'subscribe/devices',
	'subscribe/events',
] as const;

export type ProtectEndpoint = (typeof PROTECT_ENDPOINTS)[number];

/**
 * Injection token for an extra trusted CA (PEM) used by tests. The module registers it with `useValue: undefined`
 * so that tests can override it; production never sets it.
 */
export const PROTECT_TRUSTED_CA = Symbol('PROTECT_TRUSTED_CA');

/** Command budget (C7, C9): queue wait + PATCH + frame wait + readback = PROTECT_COMMAND_TIMEOUT_MS. */
export const PROTECT_COMMAND_PATCH_DEADLINE_MS = 5_000;
export const PROTECT_COMMAND_CONFIRM_TIMEOUT_MS = 3_000;
export const PROTECT_COMMAND_SETTLE_MS = 500;
export const PROTECT_COMMAND_READBACK_DEADLINE_MS = 4_000;
export const PROTECT_COMMAND_QUEUE_WAIT_MS = 12_000;
export const PROTECT_COMMAND_MAX_WAITING_PER_DEVICE = 4;
export const PROTECT_COMMAND_MAX_WAITERS = 64;
export const PROTECT_COMMAND_TIMEOUT_MS = 24_000;

export const PROTECT_STREAM_READ_DEADLINE_MS = 8_000;
export const PROTECT_SNAPSHOT_DEADLINE_MS = 8_000;
/** The core gives a provider 10 s to resolve a source; one shared budget stays below it. */
export const PROTECT_STREAM_SOURCE_BUDGET_MS = 9_000;
export const PROTECT_STREAM_AVAILABILITY_TTL_MS = 60_000;
export const PROTECT_STREAM_REFRESH_MAX_QUEUED = 256;
export const PROTECT_RTSPS_DEFAULT_PORT = 7441;
export const PROTECT_STREAM_ALIAS_PATTERN = /^[A-Za-z0-9_-]{8,128}$/;
export const PROTECT_STREAM_BRIDGE_MAX_CONNECTIONS = 16;
/** Below go2rtc's own 5 s RTSP read deadline, so the bridge fails before go2rtc gives up. */
export const PROTECT_STREAM_BRIDGE_HANDSHAKE_TIMEOUT_MS = 4_000;
export const PROTECT_STREAM_BRIDGE_IDLE_TIMEOUT_MS = 60_000;
export const PROTECT_RTSP_MAX_HEADER_BYTES = 16 * 1024;
export const PROTECT_RTSP_MAX_BODY_BYTES = 64 * 1024;

export const PROTECT_PROFILE_UNAVAILABLE_REASONS = [
	'stream_not_enabled',
	'camera_offline',
	'console_unavailable',
	'stream_state_unknown',
	'stream_tls_unverified',
] as const;

export type ProtectProfileUnavailableReason = (typeof PROTECT_PROFILE_UNAVAILABLE_REASONS)[number];
