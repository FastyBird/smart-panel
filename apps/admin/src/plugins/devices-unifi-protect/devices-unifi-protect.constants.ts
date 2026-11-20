export const DEVICES_UNIFI_PROTECT_PLUGIN_PREFIX = 'devices-unifi-protect';

export const DEVICES_UNIFI_PROTECT_PLUGIN_NAME = 'devices-unifi-protect-plugin';

export const DEVICES_UNIFI_PROTECT_TYPE = 'devices-unifi-protect';

// Mirrors PROTECT_* in apps/backend/src/plugins/devices-unifi-protect/devices-unifi-protect.constants.ts.
export const PROTECT_DEFAULT_PORT = 443;

export const MAX_PROTECT_HOST_LENGTH = 253;

export const MIN_PROTECT_SNAPSHOT_MIN_INTERVAL_MS = 500;

export const MAX_PROTECT_SNAPSHOT_MIN_INTERVAL_MS = 60_000;

export const MIN_PROTECT_POLL_INTERVAL_MS = 5_000;

export const MAX_PROTECT_POLL_INTERVAL_MS = 600_000;

// Client-side request deadlines. A deadline expiring is not a failure of the backend operation.
export const PROTECT_STATUS_DEADLINE_MS = 8_000;

export const PROTECT_PROBE_DEADLINE_MS = 15_000;

export const PROTECT_TEST_CONNECTION_DEADLINE_MS = 20_000;

// The backend's worst case for a discovery scan is about 53 s.
export const PROTECT_DISCOVERY_SCAN_DEADLINE_MS = 60_000;

export const STATUS_POLL_MS = 5_000;
