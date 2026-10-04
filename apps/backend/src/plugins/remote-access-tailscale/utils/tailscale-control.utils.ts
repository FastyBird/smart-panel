import { RemoteAccessProviderState } from '../../../modules/remote-access/platforms/remote-access-provider.platform';
import { UserRole } from '../../../modules/users/users.constants';
import { RemoteAccessTailscalePluginControlModel } from '../models/status.model';
import { TailscaleRequirement } from '../services/tailscale-node-managed.service';

/** Role filtering here is presentation only; the action endpoints retain their guards and live checks. */
export function buildTailscaleControlModel(
	control: Omit<RemoteAccessTailscalePluginControlModel, 'availableActions'>,
	state: RemoteAccessProviderState,
	requirements: TailscaleRequirement[],
	role: UserRole | undefined,
): RemoteAccessTailscalePluginControlModel {
	const result = Object.assign(new RemoteAccessTailscalePluginControlModel(), control);
	result.availableActions = [];

	if (role !== UserRole.ADMIN && role !== UserRole.OWNER) {
		return result;
	}

	// Cancellation must remain available while login or other work is in progress, even if
	// prerequisites have since failed or the plugin has been disabled.
	const stopping =
		control.operation === 'disconnect' || control.operation === 'shutdown' || control.operation === 'reset';

	if (!stopping && (control.serviceState !== 'stopped' || control.operation !== null)) {
		result.availableActions.push('disconnect');
	}

	if (!control.enabled || control.operation !== null || control.serviceState === 'stopping') {
		return result;
	}

	const ready = requirements.length > 0 && requirements.every((requirement) => requirement.satisfied);

	if (!ready) {
		return result;
	}

	if (control.authentication === 'authenticated') {
		if (state !== 'connected' && state !== 'connecting' && state !== 'pending-approval') {
			result.availableActions.push('connect');
		}

		if (role === UserRole.OWNER) {
			result.availableActions.push('logout', 'reset-preferences');
		}
	} else {
		result.availableActions.push('login');
	}

	return result;
}
