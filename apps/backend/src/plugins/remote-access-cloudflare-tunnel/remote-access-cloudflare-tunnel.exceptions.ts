/**
 * Discriminates why `CloudflareTunnelSetupService.install()` refused to start a setup job —
 * surfaced verbatim as `code` in `SetupController`'s `422 Unprocessable Entity` response body
 * (D13):
 *  - `platform-unsupported`: the platform architecturally cannot run privileged workers (docker,
 *    home-assistant, development). Retrying never helps without changing the deployment.
 *  - `privileged-worker-unavailable`: the platform IS capable, but `PlatformService`'s own
 *    sudo/systemd-run probe currently fails (e.g. a missing sudoers grant). This can resolve
 *    itself once the grant is added, without any code change — see the negative-cache TTL on
 *    `PlatformService.getPrivilegedWorkerSupport()`.
 */
export type CloudflareTunnelSetupUnavailableCode = 'privileged-worker-unavailable' | 'platform-unsupported';

/**
 * Raised by `CloudflareTunnelSetupService.install()` before any privileged worker is spawned,
 * for a *permanent* reason that will not resolve itself by merely retrying the same request.
 * `SetupController` maps this to `422 Unprocessable Entity` with body `{ code, message }` —
 * `message` already carries the actionable "here's the fix" text. A job already running is a
 * *transient* condition instead, mapped to `409 Conflict` (see `PrivilegedWorkerUnavailableException`).
 */
export class CloudflareTunnelSetupUnavailableException extends Error {
	constructor(
		message: string,
		public readonly code: CloudflareTunnelSetupUnavailableCode = 'platform-unsupported',
	) {
		super(message);
		this.name = 'CloudflareTunnelSetupUnavailableException';
	}
}

/**
 * Raised by `CloudflareTunnelManagedService.stop()` when the underlying attempt to stop the
 * `cloudflared` child process fails unexpectedly (e.g. the process refuses to die even after
 * SIGKILL). `stop()` still transitions to `error` state, records `lastError`, and emits a
 * `PROVIDER_STATUS` event reflecting that before this propagates.
 */
export class CloudflareTunnelStopFailedException extends Error {
	constructor(message: string) {
		super(message);
		this.name = 'CloudflareTunnelStopFailedException';
	}
}
