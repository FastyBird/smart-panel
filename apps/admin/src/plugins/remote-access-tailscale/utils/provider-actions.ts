import type { RemoteAccessModuleProviderState } from '../../../openapi.constants';
import { RemoteAccessTailscaleApiException } from '../remote-access-tailscale.exceptions';
import type { ITailscaleRequirement } from '../store/tailscale-status.store.types';

/**
 * Shows the backend's actual reason (`details.reason`, via `RemoteAccessTailscaleApiException`)
 * for the handful of HTTP statuses that carry a meaningful, actionable one (409/422 across
 * sign-in/out, reset-preferences and setup), and a translated generic fallback for everything
 * else (a plain 500, a network failure) - those have no such structured reason, so surfacing raw,
 * unlocalized backend text would be worse than a generic message. `flashError` is injected (rather
 * than this reaching for `useFlashMessage()` itself) so this stays a plain, unit-testable function
 * outside any component - each call site defines a one-line local `flashApiError` partially
 * applying its own `flashMessage.error`, keeping the `flashApiError(error, [409, 422], fallback)`
 * call shape used throughout this plugin.
 */
export const flashTailscaleApiError = (error: unknown, meaningfulCodes: number[], fallback: string, flashError: (message: string) => void): void => {
	if (error instanceof RemoteAccessTailscaleApiException && error.code !== null && meaningfulCodes.includes(error.code)) {
		flashError(error.message);

		return;
	}

	flashError(fallback);
};

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

/**
 * Whether the provider card's "Cannot be used yet" banner (D12) should show - `not-installed`/
 * `setup-required` are the only states where a prerequisite is what's actually blocking the node,
 * as opposed to e.g. `pending-auth`/`disconnected`, which are normal points in the sign-in flow.
 */
export const isTailscaleUnusableState = (state: RemoteAccessModuleProviderState): boolean => state === 'not-installed' || state === 'setup-required';

/** The first unsatisfied requirement, in the array's existing order - `null` when every requirement is satisfied. */
export const findFirstUnsatisfiedRequirement = (requirements: ITailscaleRequirement[]): ITailscaleRequirement | null =>
	requirements.find((requirement) => !requirement.satisfied) ?? null;

/**
 * The exact `sudo tailscale set --operator=<user>` command the `operator-not-granted` advisory
 * (and the `operator-not-granted`/`operator-granted` action-error hint) should offer as a copyable
 * block - sourced from the `operator-granted` requirement's own `remedy`, so the admin never
 * hardcodes the service-user name the backend actually detected.
 */
export const findOperatorGrantCommand = (requirements: ITailscaleRequirement[]): string | null =>
	requirements.find((requirement) => requirement.code === 'operator-granted')?.remedy?.commands[0] ?? null;

/** One manual command line, or a prose note when no exact command applies - D12's remedy contract. */
export interface ITailscaleRemedyPlan {
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
 * satisfied requirement (`remedy: null`) never contributes to either list.
 */
export const buildTailscaleRemedyPlan = (requirements: ITailscaleRequirement[]): ITailscaleRemedyPlan => {
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
 * The five application error codes (D13) the admin UI branches on to show a specific recovery
 * hint, beyond the generic backend-reason toast `flashApiError` already shows - every other code
 * (e.g. a positive-form requirement code from `TailscaleRequirementUnsatisfiedException`, or no
 * code at all) falls back to the toast alone, with no extra hint.
 */
export type TailscaleActionErrorCode =
	| 'operator-not-granted'
	| 'daemon-not-active'
	| 'not-signed-in'
	| 'privileged-worker-unavailable'
	| 'platform-unsupported';

const TAILSCALE_ERROR_HINT_KEYS: Record<TailscaleActionErrorCode, string> = {
	'operator-not-granted': 'remoteAccessTailscalePlugin.errors.operatorNotGranted',
	'daemon-not-active': 'remoteAccessTailscalePlugin.errors.daemonNotActive',
	'not-signed-in': 'remoteAccessTailscalePlugin.errors.notSignedIn',
	'privileged-worker-unavailable': 'remoteAccessTailscalePlugin.errors.privilegedWorkerUnavailable',
	'platform-unsupported': 'remoteAccessTailscalePlugin.errors.platformUnsupported',
};

const isTailscaleActionErrorCode = (code: string): code is TailscaleActionErrorCode =>
	Object.prototype.hasOwnProperty.call(TAILSCALE_ERROR_HINT_KEYS, code);

/** The i18n key for the recovery hint matching a failed action's error code, or `null` for an unrecognised/absent code. */
export const resolveTailscaleErrorHintKey = (errorCode: string | null): string | null => {
	if (errorCode !== null && isTailscaleActionErrorCode(errorCode)) {
		return TAILSCALE_ERROR_HINT_KEYS[errorCode];
	}

	return null;
};
