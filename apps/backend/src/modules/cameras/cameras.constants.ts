export const CAMERAS_MODULE_PREFIX = 'cameras';

export const CAMERAS_MODULE_NAME = 'cameras-module';

export const CAMERAS_MODULE_API_TAG_NAME = 'Cameras module';

export const CAMERAS_MODULE_API_TAG_DESCRIPTION =
	'Endpoints for listing cameras, fetching snapshots and opening live view sessions.';

export enum EventType {
	SESSION_REVOKED = 'CamerasModule.Session.Revoked',
}

export const CAMERAS_LIVE_PATH = '/api/v1/modules/cameras/live';

export const CAMERAS_DEFAULT_MAX_SESSIONS = 8;

export const CAMERAS_DEFAULT_MAX_SESSIONS_PER_CAMERA = 4;

export type Go2rtcMode = 'managed' | 'external' | 'disabled';

export const GO2RTC_MODES: Go2rtcMode[] = ['managed', 'external', 'disabled'];

export const GO2RTC_INSTALL_DIR = '/usr/local/lib/smart-panel/go2rtc';

export const GO2RTC_DEFAULT_BINARY_PATH = '/usr/local/lib/smart-panel/go2rtc/go2rtc';

export const GO2RTC_DEFAULT_API_PORT = 11984;

export const GO2RTC_DEFAULT_RTSP_PORT = 18554;

export const GO2RTC_API_USERNAME = 'smart-panel';

export const GO2RTC_CONFIG_DIRNAME = 'go2rtc';

/** A spawn writes `<prefix><random nonce><suffix>`: the name is the proof that a service on the api port is our child. */
export const GO2RTC_CONFIG_FILE_PREFIX = 'go2rtc-';

export const GO2RTC_CONFIG_FILE_SUFFIX = '.yaml';

export const GO2RTC_STOP_GRACE_MS = 5_000;

export const GO2RTC_STOP_KILL_TIMEOUT_MS = 2_000;

export const GO2RTC_OUTPUT_RING_SIZE = 64;

export const GO2RTC_READY_TIMEOUT_MS = 10_000;

export const GO2RTC_READY_POLL_MS = 250;

export const GO2RTC_RESTART_BACKOFF_MS = [1_000, 2_000, 4_000, 8_000, 16_000];

export const GO2RTC_STABLE_RUN_MS = 60_000;

export const GO2RTC_PROBE_INTERVAL_MS = 30_000;

export const GO2RTC_HTTP_TIMEOUT_MS = 5_000;

export const GO2RTC_STREAM_IDLE_GRACE_MS = 30_000;

export const GO2RTC_STREAM_NAME_PREFIX = 'smart-panel_';

/**
 * Persisted in the go2rtc config directory (never matched by the per-spawn config file pattern). Its content scopes the
 * stream names of this installation, so an orphan sweep on a shared external go2rtc never touches another installation.
 */
export const GO2RTC_INSTALLATION_ID_FILENAME = 'installation-id';
