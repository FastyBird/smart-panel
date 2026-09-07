import { TailscaleRequirement } from './services/tailscale-node-managed.service';

/**
 * Raised by `TailscaleLoginService.login()`/`logout()`/`resetPreferences()`
 * when a prerequisite the action depends on — `operator-granted` or
 * `daemon-active` — is not satisfied. Carries the failing requirement itself
 * (not just its code) so the caller can surface the same message and remedy
 * the `GET /status` requirements checklist already shows, instead of
 * re-deriving them. `SetupController` maps this to `409 Conflict` with a body
 * of `{ code: <requirement code>, message }`.
 */
export class TailscaleRequirementUnsatisfiedException extends Error {
	constructor(readonly requirement: TailscaleRequirement) {
		super(requirement.message);
		this.name = 'TailscaleRequirementUnsatisfiedException';
	}
}

/**
 * Discriminates why `TailscaleSetupService.install()` refused to start a setup job — surfaced
 * verbatim as `code` in `SetupController`'s `422 Unprocessable Entity` response body:
 *  - `platform-unsupported`: the platform architecturally cannot run privileged workers (docker,
 *    home-assistant, development without the `FB_REMOTE_ACCESS_ALLOW_DEV` override) or the
 *    override itself is set. Retrying never helps without changing the deployment.
 *  - `privileged-worker-unavailable`: the platform IS capable, but `PlatformService`'s own
 *    sudo/systemd-run probe currently fails (e.g. a missing sudoers grant). This can resolve
 *    itself once the grant is added, without any code change — see the 60s negative-cache TTL
 *    on `PlatformService.getPrivilegedWorkerSupport()`.
 */
export type TailscaleSetupUnavailableCode = 'privileged-worker-unavailable' | 'platform-unsupported';

/**
 * Raised by `TailscaleSetupService.install()` before any privileged worker is spawned, for a
 * *permanent* reason that will not resolve itself by merely retrying the same request: the
 * platform has no privileged-worker support, the `FB_REMOTE_ACCESS_ALLOW_DEV` override is set, or
 * the privileged-worker probe currently fails. `SetupController` maps this to `422 Unprocessable
 * Entity` with body `{ code, message }` — `message` already carries the actionable "here's the
 * fix" text, not just the raw technical reason. A job already running is a *transient* condition
 * instead — see `PrivilegedWorkerUnavailableException`, which `PrivilegedWorkerService.run()`
 * itself throws for that case and which the controller maps to `409 Conflict`.
 *
 * `code` defaults to `'platform-unsupported'` so existing call sites/tests that only ever
 * supplied a message keep compiling and behaving the same way.
 */
export class TailscaleSetupUnavailableException extends Error {
	constructor(
		message: string,
		public readonly code: TailscaleSetupUnavailableCode = 'platform-unsupported',
	) {
		super(message);
		this.name = 'TailscaleSetupUnavailableException';
	}
}
