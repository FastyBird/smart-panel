import type { RemoteAccessModuleProviderState } from '../../../openapi.constants';

export interface ITailscaleProviderActions {
	/** Run the privileged setup job (`POST /install`) - owner-only. */
	setup: boolean;
	/** Open the sign-in step (interactive link/QR, or the advanced auth-key tab). */
	signIn: boolean;
	/** Start the managed service (Extensions `start`). */
	connect: boolean;
	/** Stop the managed service (Extensions `stop`). */
	disconnect: boolean;
	/** Restart the managed service (Extensions `restart`). */
	reconnect: boolean;
	/** `POST /logout` - owner-only, expires the node key. */
	signOut: boolean;
	/** `POST /reset-preferences` - owner-only. */
	resetPreferences: boolean;
}

export interface IResolveTailscaleProviderActionsOptions {
	state: RemoteAccessModuleProviderState;
	/**
	 * Whether the status `details.tailnet` field is a non-empty string - the only signal `GET
	 * /status` gives for "this node has signed in before", needed because `disconnected` is
	 * reached both right after the privileged setup step (no key yet) and after `stop`/`down` on
	 * an already-keyed node (see the state machine in the design spec's "Tailscale Plugin"
	 * section). In practice the backend's `Stopped` → `disconnected` mapping only ever happens
	 * once a key exists, so `hasTailnet` is normally `true` whenever `state` is `disconnected` -
	 * this still branches on it defensively rather than assuming that always holds.
	 */
	hasTailnet: boolean;
	isOwner: boolean;
}

/**
 * Which actions a `tailscale-provider-card.vue` should offer for a given node state - a pure
 * function so every state/role/key combination can be exercised directly in a unit test instead
 * of through a mounted component.
 */
export const resolveTailscaleProviderActions = ({
	state,
	hasTailnet,
	isOwner,
}: IResolveTailscaleProviderActionsOptions): ITailscaleProviderActions => {
	const hasKey =
		state === 'connected' || state === 'connecting' || state === 'pending-approval' || state === 'error' || (state === 'disconnected' && hasTailnet);

	return {
		setup: isOwner && (state === 'not-installed' || state === 'setup-required'),
		signIn: state === 'pending-auth' || (state === 'disconnected' && !hasTailnet),
		connect: state === 'disconnected' && hasTailnet,
		disconnect: state === 'connected' || state === 'connecting' || state === 'pending-approval',
		reconnect: state === 'connected' || state === 'error',
		signOut: isOwner && hasKey,
		resetPreferences: isOwner && hasKey,
	};
};
