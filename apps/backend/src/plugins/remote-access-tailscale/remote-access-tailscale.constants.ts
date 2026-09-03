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
