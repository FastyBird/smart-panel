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
