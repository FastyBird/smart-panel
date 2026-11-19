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
 * How often the relay status is polled while the cameras page is open.
 */
export const RELAY_STATUS_POLL_MS = 10_000;

/**
 * Backoff between live view reconnect attempts; after the last one the player stops and offers Retry.
 */
export const LIVE_RETRY_DELAYS_MS = [2000, 4000, 8000, 16000, 30000] as const;
