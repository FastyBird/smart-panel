export const REMOTE_ACCESS_TAILSCALE_PLUGIN_PREFIX = 'remote-access-tailscale';

export const REMOTE_ACCESS_TAILSCALE_PLUGIN_NAME = 'remote-access-tailscale-plugin';

export const REMOTE_ACCESS_TAILSCALE_PLUGIN_API_TAG_NAME = 'Remote access Tailscale plugin';

export const REMOTE_ACCESS_TAILSCALE_PLUGIN_API_TAG_DESCRIPTION =
	'Endpoints for the Tailscale remote-access provider node: prerequisites, connection state and published endpoints.';

/**
 * Minimum Tailscale client version this plugin supports. The `--json` output
 * of the CLI is explicitly documented upstream as subject to change, so the
 * status mapper only reads the fields it knows about and this floor exists to
 * surface a clear advisory/requirement instead of misinterpreting a
 * differently shaped payload from a much older client.
 */
export const TAILSCALE_MIN_VERSION = '1.66.0';

/** Binary name resolved through PATH — never an absolute/user-supplied path. */
export const TAILSCALE_BINARY = 'tailscale';

/** Default timeout for a non-interactive `tailscale` CLI call. */
export const TAILSCALE_CLI_DEFAULT_TIMEOUT_MS = 15_000;

/** Timeout for the unprivileged `systemctl is-active` prerequisite probe. */
export const TAILSCALE_SYSTEMCTL_PROBE_TIMEOUT_MS = 2_000;

export const TAILSCALE_DEFAULT_LOGIN_SERVER = 'https://controlplane.tailscale.com';

/** Poll interval while the node's state is transitioning (e.g. connecting). */
export const TAILSCALE_POLL_INTERVAL_TRANSITIONING_MS = 5_000;

/** Poll interval once the node's state has settled. */
export const TAILSCALE_POLL_INTERVAL_STABLE_MS = 30_000;

/**
 * Development-platform override. `PlatformService.supportsPrivilegedWorkers()`
 * always treats `development` as unsupported; this plugin-local flag lets a
 * developer opt in with a locally prepared `tailscale` binary and an
 * already-granted operator, skipping the privileged setup step entirely.
 */
export const REMOTE_ACCESS_TAILSCALE_ALLOW_DEV_ENV = 'FB_REMOTE_ACCESS_ALLOW_DEV';

/** `systemd-run --unit` for the privileged Tailscale setup job (RA-5). */
export const TAILSCALE_SETUP_WORKER_UNIT = 'smart-panel-remote-access';

/** Name of the setup job's status file, written under `TAILSCALE_DATA_SUBDIR`. */
export const TAILSCALE_SETUP_STATUS_FILENAME = 'tailscale-setup-status.json';

/**
 * Subdirectory under `FB_DATA_DIR` holding this plugin's on-disk state: the
 * setup job's status file and the sign-in flow's ephemeral auth-key file.
 * Created with mode `0700` — the auth-key file it holds is a secret.
 */
export const TAILSCALE_DATA_SUBDIR = 'remote-access';

/** Matches the `--timeout=120s` flag on the auth-key sign-in `up` call. */
export const TAILSCALE_LOGIN_AUTH_KEY_TIMEOUT_MS = 120_000;

/** Matches the `--timeout=10m` flag on the interactive sign-in `up` call. */
export const TAILSCALE_LOGIN_INTERACTIVE_TIMEOUT_MS = 10 * 60 * 1000;

/** How far ahead of `Self.KeyExpiry` the `key-expiring` advisory starts firing (RA-6). */
export const TAILSCALE_KEY_EXPIRY_ADVISORY_WINDOW_MS = 14 * 24 * 60 * 60 * 1000;
