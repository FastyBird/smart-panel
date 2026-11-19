export const CAMERAS_MODULE_PREFIX = 'cameras';

export const CAMERAS_MODULE_NAME = 'cameras-module';

export const CAMERAS_MODULE_EVENT_PREFIX = 'CamerasModule.';

export enum RouteNames {
	CAMERAS = 'cameras_module-cameras',
}

/**
 * How often a visible camera tile refreshes its snapshot.
 */
export const SNAPSHOT_REFRESH_MS = 10_000;

/**
 * How long one snapshot request may take before it is aborted as a retryable failure, so the next refresh can run.
 */
export const SNAPSHOT_REQUEST_TIMEOUT_MS = 10_000;

/**
 * How often the relay status is polled while the cameras page is open.
 */
export const RELAY_STATUS_POLL_MS = 10_000;

/**
 * Backoff between live view reconnect attempts; after the last one the player stops and offers Retry.
 */
export const LIVE_RETRY_DELAYS_MS = [2000, 4000, 8000, 16000, 30000] as const;

/**
 * Playback must run this long before the live view counts as stable and the retry budget is reset.
 */
export const LIVE_STABLE_AFTER_MS = 10_000;

/**
 * How long a live socket may stay in `connecting` without media before it counts as a failed attempt.
 */
export const LIVE_CONNECT_TIMEOUT_MS = 15_000;

/**
 * How long a live view may stay in `requesting` (the session request, plus any relay status read or profile fallback
 * it needs) before the attempt counts as a retryable failure.
 */
export const LIVE_SESSION_REQUEST_TIMEOUT_MS = 10_000;

/**
 * How long one relay status read may take before it is aborted, so polling can start a new one.
 */
export const RELAY_STATUS_TIMEOUT_MS = 8_000;
