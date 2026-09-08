import type { RemoteAccessModuleProviderState } from '../../../openapi.constants';
import { RemoteAccessCloudflareTunnelApiException } from '../remote-access-cloudflare-tunnel.exceptions';
import type { ICloudflareTunnelRequirement } from '../store/cloudflare-tunnel-status.store.types';

/**
 * Shows the backend's actual reason (`details.reason`, via `RemoteAccessCloudflareTunnelApiException`)
 * for the one status that carries a meaningful, actionable one (`POST /install`'s `422`), and a
 * translated generic fallback for everything else (a plain `409`/`500`, a network failure) - those
 * have no such structured reason, so surfacing raw, unlocalized backend text would be worse than a
 * generic message. `flashError` is injected (rather than this reaching for `useFlashMessage()`
 * itself) so this stays a plain, unit-testable function outside any component - mirrors
 * `flashTailscaleApiError`.
 */
export const flashCloudflareTunnelApiError = (
	error: unknown,
	meaningfulCodes: number[],
	fallback: string,
	flashError: (message: string) => void
): void => {
	if (error instanceof RemoteAccessCloudflareTunnelApiException && error.code !== null && meaningfulCodes.includes(error.code)) {
		flashError(error.message);

		return;
	}

	flashError(fallback);
};

export interface ICloudflareTunnelProviderActions {
	/** Run the privileged setup job (`POST /install`) - owner-only, shown while `not-installed`. */
	setup: boolean;
	/** Open the wizard's token/hostname step - owner-only, shown while `setup-required`. */
	configure: boolean;
	/** Start the managed service (Extensions `start`). */
	connect: boolean;
	/** Stop the managed service (Extensions `stop`). */
	disconnect: boolean;
	/** Restart the managed service (Extensions `restart`). */
	reconnect: boolean;
	/** `POST /reset` - owner-only, stops the tunnel and clears the token/hostname. */
	remove: boolean;
}

export interface IResolveCloudflareTunnelProviderActionsOptions {
	state: RemoteAccessModuleProviderState;
	isOwner: boolean;
}

/**
 * Which actions a `cloudflare-tunnel-provider-card.vue` should offer for a given tunnel state - a
 * pure function so every state/role combination can be exercised directly in a unit test instead
 * of through a mounted component. Simpler than the Tailscale plugin's own resolver: there is no
 * sign-in concept here, and `POST /reset` is the one action covering what Tailscale splits into
 * sign-out and reset-preferences.
 */
export const resolveCloudflareTunnelProviderActions = ({
	state,
	isOwner,
}: IResolveCloudflareTunnelProviderActionsOptions): ICloudflareTunnelProviderActions => {
	return {
		setup: isOwner && state === 'not-installed',
		configure: isOwner && state === 'setup-required',
		connect: state === 'disconnected',
		disconnect: state === 'connected' || state === 'connecting',
		reconnect: state === 'connected' || state === 'error',
		// Once the platform/binary prerequisites are satisfied there is always something a reset
		// could usefully clear (a hostname can be set even while `setup-required` for a missing
		// token, or vice versa) - offered for every state past `not-installed`/`unsupported`.
		remove: isOwner && state !== 'not-installed' && state !== 'unsupported',
	};
};

/**
 * Whether the provider card's "Cannot be used yet" banner (D12) should show - `not-installed`/
 * `setup-required` are the only states where a prerequisite is what's actually blocking the
 * tunnel. Mirrors `isTailscaleUnusableState`.
 */
export const isCloudflareTunnelUnusableState = (state: RemoteAccessModuleProviderState): boolean =>
	state === 'not-installed' || state === 'setup-required';

/** The first unsatisfied requirement, in the array's existing order - `null` when every requirement is satisfied. */
export const findFirstUnsatisfiedRequirement = (requirements: ICloudflareTunnelRequirement[]): ICloudflareTunnelRequirement | null =>
	requirements.find((requirement) => !requirement.satisfied) ?? null;

/** One manual command line, or a prose note when no exact command applies - D12's remedy contract. */
export interface ICloudflareTunnelRemedyPlan {
	/** Every unsatisfied requirement's remedy commands, in `requirements` order, concatenated into one block. */
	commands: string[];
	/** Every unsatisfied requirement's remedy note, for requirements with no exact command. */
	notes: string[];
}

/**
 * Builds the manual "do it yourself" plan D12 describes for both the wizard's "Run it yourself"
 * disclosure (`privileged_setup.available` true) and its unavailable-platform fallback (`available`
 * false): every unsatisfied requirement's `remedy.commands`, concatenated in order into one
 * copyable block, or its `note` shown as prose when there are no exact commands for it. A
 * satisfied requirement (`remedy: null`) never contributes to either list. Mirrors
 * `buildTailscaleRemedyPlan`.
 */
export const buildCloudflareTunnelRemedyPlan = (requirements: ICloudflareTunnelRequirement[]): ICloudflareTunnelRemedyPlan => {
	const commands: string[] = [];
	const notes: string[] = [];

	for (const requirement of requirements) {
		if (requirement.satisfied || !requirement.remedy) {
			continue;
		}

		if (requirement.remedy.commands.length > 0) {
			commands.push(...requirement.remedy.commands);
		} else if (requirement.remedy.note) {
			notes.push(requirement.remedy.note);
		}
	}

	return { commands, notes };
};

/**
 * The two application error codes (D13) the admin UI branches on to show a specific recovery
 * hint, beyond the generic backend-reason toast `flashApiError` already shows - every other code
 * (or no code at all) falls back to the toast alone, with no extra hint. Mirrors
 * `resolveTailscaleErrorHintKey`, scoped to the two codes this plugin's `POST /install` can
 * actually return (D13, `CloudflareTunnelSetupUnavailableException.code`).
 */
export type CloudflareTunnelActionErrorCode = 'privileged-worker-unavailable' | 'platform-unsupported';

const CLOUDFLARE_TUNNEL_ERROR_HINT_KEYS: Record<CloudflareTunnelActionErrorCode, string> = {
	'privileged-worker-unavailable': 'remoteAccessCloudflareTunnelPlugin.errors.privilegedWorkerUnavailable',
	'platform-unsupported': 'remoteAccessCloudflareTunnelPlugin.errors.platformUnsupported',
};

const isCloudflareTunnelActionErrorCode = (code: string): code is CloudflareTunnelActionErrorCode =>
	Object.prototype.hasOwnProperty.call(CLOUDFLARE_TUNNEL_ERROR_HINT_KEYS, code);

/** The i18n key for the recovery hint matching a failed action's error code, or `null` for an unrecognised/absent code. */
export const resolveCloudflareTunnelErrorHintKey = (errorCode: string | null): string | null => {
	if (errorCode !== null && isCloudflareTunnelActionErrorCode(errorCode)) {
		return CLOUDFLARE_TUNNEL_ERROR_HINT_KEYS[errorCode];
	}

	return null;
};
