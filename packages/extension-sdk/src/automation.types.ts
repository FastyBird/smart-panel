/**
 * Plain mirrors of the backend automations node type ("card") contract
 * (`apps/backend/src/modules/automations/graph/node-type.ts`). See `docs/extensions.md`, section
 * "Adding automation cards", for the developer guide: registration, owner gating, validation, the
 * safety policy and the run context.
 *
 * These are typing-only mirrors, not the backend's own declarations: a card compiled as part of the
 * backend (`apps/backend/src/modules/**`, `apps/backend/src/plugins/**`) keeps using the real contract
 * from `apps/backend/src/modules/automations/graph/node-type.ts`. An installable extension package - one
 * built against this SDK, outside the backend's own TypeScript program - types its cards against the
 * shapes below and hands them to the backend's `AutomationNodeTypeRegistryService.register()`.
 *
 * The backend checks at compile time that these mirrors and its own contract accept each other
 * (`apps/backend/src/modules/automations/graph/node-type.sdk-contract.spec.ts`), so they can not drift.
 *
 * An extension can add triggers, conditions and actions. Flow blocks (Delay, Wait until, Any, All) are run
 * by the engine itself and are not part of this contract.
 */

/** Every kind of node the backend knows; an extension adds `trigger`, `condition` and `action` cards */
export type AutomationNodeKind = 'trigger' | 'condition' | 'action' | 'flow';

/** The kinds of card an extension can add */
export type AutomationExtensionNodeKind = Exclude<AutomationNodeKind, 'flow'>;

export const AUTOMATION_EXTENSION_NODE_KINDS: readonly AutomationExtensionNodeKind[] = Object.freeze([
	'trigger',
	'condition',
	'action',
]);

export interface AutomationNodePorts {
	inputs: string[];
	outputs: string[];
}

/** Ports that cannot be changed in place: the shared defaults below */
export interface AutomationNodeDefaultPorts {
	readonly inputs: readonly string[];
	readonly outputs: readonly string[];
}

const defaultPorts = (inputs: string[], outputs: string[]): AutomationNodeDefaultPorts =>
	Object.freeze({ inputs: Object.freeze(inputs), outputs: Object.freeze(outputs) });

/**
 * The ports a card of each kind gets when it declares none. Frozen all the way down, because every SDK consumer in
 * the process shares them: copy an array (`[...ports.outputs]`) before changing it.
 */
export const AUTOMATION_NODE_DEFAULT_PORTS: Readonly<Record<AutomationExtensionNodeKind, AutomationNodeDefaultPorts>> =
	Object.freeze({
		trigger: defaultPorts([], ['out']),
		condition: defaultPorts(['in'], ['yes', 'no']),
		action: defaultPorts(['in'], ['done', 'error']),
	});

export type AutomationNodeReferenceKind = 'device' | 'channel' | 'property' | 'scene' | 'space' | 'automation';

/**
 * An entity a configured node depends on. Used to find the automations to invalidate when it is removed.
 */
export interface AutomationNodeReference {
	kind: AutomationNodeReferenceKind;
	id: string;
}

export type AutomationNodeConfig = Record<string, unknown>;

/**
 * The module or plugin a card belongs to. A card of a disabled owner stays registered, but the catalogue
 * leaves it out, the engine does not arm it as a trigger and refuses to execute it as a condition or an
 * action. An extension always names itself here: the `type` it registered its config mapping with.
 */
export interface AutomationNodeTypeOwner {
	kind: 'module' | 'plugin';
	/** The extension type, e.g. `example-extension` */
	type: string;
}

/**
 * One reason a node configuration was refused. A reason is shown to the caller, so it must describe the
 * rule that was broken and must not repeat the submitted value.
 */
export interface AutomationNodeConfigProblem {
	/** Path of the offending configuration field, dot-separated; left out when the problem is not about one field */
	field?: string;
	reason: string;
}

export type AutomationNodeConfigValidator = (
	config: AutomationNodeConfig,
) => AutomationNodeConfigProblem[] | Promise<AutomationNodeConfigProblem[]>;

/**
 * What every card declares, whatever its kind.
 */
export interface AutomationNodeTypeBase<TConfig extends object = AutomationNodeConfig> {
	/** Unique type identifier stored in the graph; prefix it with the extension type, e.g. `acme.doorbell.rang` */
	type: string;
	kind: AutomationNodeKind;
	/** Human-facing name in plain English */
	name: string;
	/** Human-facing description in plain English */
	description: string;
	/** Ports edges can attach to; leave it out to get the ports of the kind (AUTOMATION_NODE_DEFAULT_PORTS) */
	ports?: AutomationNodePorts;
	/**
	 * Checks a node configuration and returns the reasons it is refused; an empty list accepts it. Called
	 * when a graph is saved or validated, with whatever was submitted, so it must not trust its input.
	 */
	validateConfig: AutomationNodeConfigValidator;
	/**
	 * JSON Schema of the configuration. The admin builds the generic form of the card from it: `string`,
	 * `number`, `integer` (with `minimum` / `maximum`), `boolean`, `enum` and arrays of those get their own
	 * field, `title` and `description` label it, `required` marks it. Anything else is edited as JSON.
	 */
	configSchema?: Record<string, unknown>;
	/** Entities the configured node depends on */
	references?(config: TConfig): AutomationNodeReference[];
	/** The module or plugin the card belongs to; an extension always sets it */
	owner?: AutomationNodeTypeOwner;
	/**
	 * Why the card can not be used at the moment - something it needs is not set up - or undefined while
	 * it can. Asked whenever a graph is checked and the catalogue is listed, so it must be quick and must
	 * not throw.
	 */
	unavailableReason?(): string | undefined;
}

export interface AutomationTriggerData {
	/** Why the trigger fired, in a form that can be put into the run trace */
	[key: string]: unknown;
}

/**
 * What started the run a node is executed in.
 */
export interface AutomationRunTrigger {
	/** The trigger node the run started at */
	nodeId: string;
	/** What the trigger handed to `fire`; `{ manual: true }` for a manual run */
	data: AutomationTriggerData;
	/** Whether the run was started by hand instead of by the trigger itself */
	manual: boolean;
}

/**
 * What a condition or an action is given when the engine executes it.
 */
export interface AutomationRunContext {
	automationId: string;
	runId: string;
	/** The node being executed */
	nodeId: string;
	/**
	 * Aborted when the run is cancelled or the node ran into its timeout. A handler that can stop early
	 * should; one that cannot is still traced when it returns, and its output is not followed.
	 */
	signal: AbortSignal;
	trigger: AutomationRunTrigger;
}

/**
 * What a trigger is given when the engine arms it.
 */
export interface AutomationTriggerContext {
	automationId: string;
	/** The trigger node being armed */
	nodeId: string;
}

/** The longest a condition or an action may run when its card does not say otherwise */
export const AUTOMATION_NODE_DEFAULT_TIMEOUT_SECONDS = 30;

/** The longest timeout a card may ask for */
export const AUTOMATION_NODE_MAX_TIMEOUT_SECONDS = 300;

/** The longest a card type identifier may be */
export const AUTOMATION_NODE_TYPE_MAX_LENGTH = 100;

export interface AutomationConditionResult {
	result: boolean;
	observed?: unknown;
	reason?: string;
}

export interface AutomationActionResult {
	success: boolean;
	reason?: string;
	/** The action did nothing because a policy refused it, as opposed to having tried and failed */
	refused?: boolean;
}

/**
 * Something an action does to the home. An action lists what a configured node will do with `commands()`,
 * so one safety policy can judge every action - whichever card it is and whoever provides it - without
 * knowing the card. Unlocking, disarming and opening are refused on save and again before every run.
 */
export type AutomationActionCommand =
	| {
			/** A value is written to a device property */
			kind: 'property_write';
			propertyId: string;
			value: unknown;
			/** Path of the configuration field that holds the value, for a per-node error */
			field?: string;
	  }
	| {
			/** A scene is run; what it does is read from the scene when the action is about to run */
			kind: 'scene_run';
			sceneId: string;
			/** Path of the configuration field that names the scene */
			field?: string;
	  };

export interface AutomationTriggerNodeType<TConfig extends object = AutomationNodeConfig>
	extends AutomationNodeTypeBase<TConfig> {
	kind: 'trigger';
	/**
	 * Starts watching for the event and returns the function that stops it. Called only for an enabled,
	 * valid automation whose owner is enabled; `fire` must not be called from inside this call. Whatever the
	 * trigger keeps (a listener, a timer) belongs to the subscription and has to be released by the
	 * returned function.
	 */
	subscribe(
		config: TConfig,
		fire: (data: AutomationTriggerData) => void,
		context?: AutomationTriggerContext,
	): () => void;
}

export interface AutomationConditionNodeType<TConfig extends object = AutomationNodeConfig>
	extends AutomationNodeTypeBase<TConfig> {
	kind: 'condition';
	/**
	 * Decides between the `yes` and the `no` output. A condition that throws, or does not answer within
	 * its timeout, evaluates to `no` with the reason recorded: a broken condition is never true.
	 */
	evaluate(config: TConfig, context: AutomationRunContext): Promise<AutomationConditionResult>;
	/** Overrides AUTOMATION_NODE_DEFAULT_TIMEOUT_SECONDS; capped at AUTOMATION_NODE_MAX_TIMEOUT_SECONDS */
	timeoutSeconds?: number;
}

export interface AutomationActionNodeType<TConfig extends object = AutomationNodeConfig>
	extends AutomationNodeTypeBase<TConfig> {
	kind: 'action';
	/**
	 * Does the work and decides between the `done` and the `error` output. An action that throws, or does
	 * not answer within its timeout, takes `error`. Branches of one run execute in parallel and in no
	 * guaranteed order.
	 */
	execute(config: TConfig, context: AutomationRunContext): Promise<AutomationActionResult>;
	/**
	 * What executing the configured node does to the home. An action that writes device values or runs a
	 * scene must list it here: it is how unlocking, disarming and opening are kept out of automations. It is
	 * called with configurations that were not validated, so it skips what it can not read and never throws.
	 */
	commands?(config: TConfig): AutomationActionCommand[];
	/** Overrides AUTOMATION_NODE_DEFAULT_TIMEOUT_SECONDS; capped at AUTOMATION_NODE_MAX_TIMEOUT_SECONDS */
	timeoutSeconds?: number;
}

/** A card an extension can register */
export type AutomationExtensionNodeType<TConfig extends object = AutomationNodeConfig> =
	| AutomationTriggerNodeType<TConfig>
	| AutomationConditionNodeType<TConfig>
	| AutomationActionNodeType<TConfig>;

/**
 * The part of the backend's `AutomationNodeTypeRegistryService` an extension uses. The backend refuses a
 * card it could not use (a bad identifier, missing ports, no validator) by throwing, so a broken card fails
 * at start rather than when somebody saves a graph. Registering a type that already exists replaces it.
 */
export interface AutomationNodeTypeRegistrar {
	register<TConfig extends object>(nodeType: AutomationNodeTypeBase<TConfig>): void;
}

const NODE_TYPE_PATTERN = /^[a-z0-9]+(?:[._-][a-z0-9]+)*$/;

/** Whether a card type identifier is one the backend accepts: lower-case words joined by ".", "_" or "-" */
export const isAutomationNodeTypeId = (value: unknown): value is string =>
	typeof value === 'string' && value.length <= AUTOMATION_NODE_TYPE_MAX_LENGTH && NODE_TYPE_PATTERN.test(value);

/** Types a trigger card and keeps its configuration type; returns the definition unchanged */
export const defineAutomationTrigger = <TConfig extends object>(
	nodeType: AutomationTriggerNodeType<TConfig>,
): AutomationTriggerNodeType<TConfig> => nodeType;

/** Types a condition card and keeps its configuration type; returns the definition unchanged */
export const defineAutomationCondition = <TConfig extends object>(
	nodeType: AutomationConditionNodeType<TConfig>,
): AutomationConditionNodeType<TConfig> => nodeType;

/** Types an action card and keeps its configuration type; returns the definition unchanged */
export const defineAutomationAction = <TConfig extends object>(
	nodeType: AutomationActionNodeType<TConfig>,
): AutomationActionNodeType<TConfig> => nodeType;

/** The reason the backend gives for a configuration key a card does not declare */
export const AUTOMATION_CONFIG_UNKNOWN_FIELD_REASON = 'This property is not allowed.';

/**
 * The first step of most `validateConfig` implementations: refuses a configuration that is not an object,
 * and every key it has that the card does not declare, the same way the backend's own cards do.
 */
export const checkAutomationConfigKeys = (
	config: unknown,
	allowed: readonly string[],
): AutomationNodeConfigProblem[] => {
	if (typeof config !== 'object' || config === null || Array.isArray(config)) {
		return [{ reason: 'The configuration must be an object.' }];
	}

	return Object.keys(config)
		.filter((key) => !allowed.includes(key))
		.map((key) => ({ field: key, reason: AUTOMATION_CONFIG_UNKNOWN_FIELD_REASON }));
};
