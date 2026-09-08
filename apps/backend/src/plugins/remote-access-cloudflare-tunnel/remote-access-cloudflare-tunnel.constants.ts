export const REMOTE_ACCESS_CLOUDFLARE_TUNNEL_PLUGIN_PREFIX = 'remote-access-cloudflare-tunnel';

export const REMOTE_ACCESS_CLOUDFLARE_TUNNEL_PLUGIN_NAME = 'remote-access-cloudflare-tunnel-plugin';

export const REMOTE_ACCESS_CLOUDFLARE_TUNNEL_PLUGIN_API_TAG_NAME = 'Remote access Cloudflare Tunnel plugin';

export const REMOTE_ACCESS_CLOUDFLARE_TUNNEL_PLUGIN_API_TAG_DESCRIPTION =
	'Endpoints for the Cloudflare Tunnel remote-access provider: prerequisites, connection state and published endpoints.';

/**
 * Minimum `cloudflared` version this plugin supports. The `/ready` metrics
 * endpoint and the `TUNNEL_TOKEN` child-process model (D9) are both assumed
 * stable from this release onward.
 */
export const CLOUDFLARED_MIN_VERSION = '2024.1.0';

/** Binary name resolved through PATH — never an absolute/user-supplied path. */
export const CLOUDFLARED_BINARY = 'cloudflared';

/** Default timeout for a non-interactive `cloudflared` CLI call (e.g. `--version`). */
export const CLOUDFLARED_CLI_DEFAULT_TIMEOUT_MS = 15_000;

/**
 * Loopback address:port `cloudflared` exposes its own `/metrics` and
 * `/ready` HTTP endpoints on. Deliberately outside cloudflared's own default
 * range (20241-20245) so this instance never collides with another
 * `cloudflared` process already running on the host (e.g. one the operator
 * set up by hand outside Smart Panel). Overridable per-installation via
 * `FB_REMOTE_ACCESS_CLOUDFLARE_METRICS_ADDRESS`.
 */
export const CLOUDFLARED_METRICS_ADDRESS = '127.0.0.1:20246';

/** Env var overriding {@link CLOUDFLARED_METRICS_ADDRESS}. */
export const REMOTE_ACCESS_CLOUDFLARE_METRICS_ADDRESS_ENV = 'FB_REMOTE_ACCESS_CLOUDFLARE_METRICS_ADDRESS';

/** Timeout for a single `GET /ready` probe against the metrics endpoint above. */
export const CLOUDFLARED_METRICS_TIMEOUT_MS = 2_000;

/** Poll interval while the tunnel's state is transitioning (e.g. connecting). */
export const CLOUDFLARED_POLL_INTERVAL_TRANSITIONING_MS = 5_000;

/** Poll interval once the tunnel's state has settled. */
export const CLOUDFLARED_POLL_INTERVAL_STABLE_MS = 30_000;

/**
 * How long a freshly spawned `cloudflared` process is given to report ready
 * (`/ready` returning 200) before an unreachable/503 metrics endpoint is
 * treated as a genuine failure (`error`) rather than the ordinary
 * connection-establishment window (`connecting`).
 */
export const CLOUDFLARED_READY_GRACE_MS = 60_000;

/** Grace period between SIGTERM and SIGKILL when stopping the `cloudflared` child process. */
export const CLOUDFLARED_STOP_GRACE_MS = 10_000;

/** Number of most-recent stderr lines retained from the `cloudflared` child process, token-redacted. */
export const CLOUDFLARED_STDERR_RING_SIZE = 64;

/** `systemd-run --unit` for the privileged Cloudflare Tunnel install job (RA-13). */
export const CLOUDFLARE_TUNNEL_SETUP_WORKER_UNIT = 'smart-panel-remote-access-cloudflare';

/** Name of the setup job's status file, written under `CLOUDFLARE_TUNNEL_DATA_SUBDIR`. */
export const CLOUDFLARE_TUNNEL_SETUP_STATUS_FILENAME = 'cloudflare-tunnel-setup-status.json';

/** Subdirectory under `FB_DATA_DIR` holding this plugin's on-disk state: the setup job's status file. */
export const CLOUDFLARE_TUNNEL_DATA_SUBDIR = 'remote-access-cloudflare-tunnel';

/** Timeout for the unprivileged `cloudflared-setup.sh --print-plan` probe — a local file read and a few `echo`s. */
export const CLOUDFLARE_TUNNEL_PRINT_PLAN_TIMEOUT_MS = 2_000;

/** `platform-supported`'s remedy note — this plugin's own documentation, listing unsupported platforms. */
export const CLOUDFLARE_TUNNEL_DOCUMENTATION_URL = 'https://smart-panel.fastybird.com/docs';

/** `binary-installed`/`version-supported`'s remedy note when the script reports an unsupported (non-Debian-family) distribution. */
export const CLOUDFLARE_TUNNEL_VENDOR_DOWNLOAD_URL = 'https://pkg.cloudflare.com/index.html';

/** `cloudflared tunnel run --protocol` accepted values. */
export type CloudflareTunnelProtocol = 'auto' | 'http2' | 'quic';

export const CLOUDFLARE_TUNNEL_PROTOCOLS: CloudflareTunnelProtocol[] = ['auto', 'http2', 'quic'];

export const CLOUDFLARE_TUNNEL_DEFAULT_PROTOCOL: CloudflareTunnelProtocol = 'auto';
