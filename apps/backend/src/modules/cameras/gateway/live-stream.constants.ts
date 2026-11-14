export const LIVE_MAX_LIFETIME_MS = 4 * 60 * 60 * 1000;
export const LIVE_HEARTBEAT_INTERVAL_MS = 30_000;
export const LIVE_CLIENT_MAX_PAYLOAD_BYTES = 4096;
export const LIVE_HIGH_WATER_BYTES = 4 * 1024 * 1024;
export const LIVE_LOW_WATER_BYTES = 1024 * 1024;
export const LIVE_STALL_TIMEOUT_MS = 10_000;
export const LIVE_UPSTREAM_CONNECT_TIMEOUT_MS = 10_000;
/**
 * Bounds the camera lookup and the lease (provider source resolution plus the go2rtc `PUT`) of one admitted socket:
 * the provider timeout (10 s) and the go2rtc HTTP timeout (5 s), plus margin for queued calls of the same stream.
 */
export const LIVE_UPSTREAM_ACQUIRE_TIMEOUT_MS = 20_000;
export const LIVE_UPSTREAM_MAX_PAYLOAD_BYTES = 16 * 1024 * 1024;

/** Close codes and fixed reasons of a live socket. The reasons are the only text a client ever receives. */
export const LIVE_CLOSE = {
	SERVER_SHUTDOWN: [1001, 'server_shutdown'],
	UNSUPPORTED_DATA: [1003, 'unsupported_data'],
	PROTOCOL_VIOLATION: [1008, 'protocol_violation'],
	UPSTREAM_FAILED: [1011, 'upstream_failed'],
	UPSTREAM_CLOSED: [1011, 'upstream_closed'],
	RELAY_UNAVAILABLE: [1013, 'relay_unavailable'],
	SESSION_LIMIT: [1013, 'session_limit'],
	CAMERA_SESSION_LIMIT: [1013, 'camera_session_limit'],
	SLOW_CONSUMER: [1013, 'slow_consumer'],
	REVOKED: [4000, 'revoked'],
	MODULE_DISABLED: [4001, 'module_disabled'],
	MAX_LIFETIME: [4002, 'max_lifetime'],
} as const;

export type LiveCloseKind = keyof typeof LIVE_CLOSE;
