/**
 * The automation node type ("card") contract.
 *
 * This file is framework-free on purpose (ADR 0003, decision 15): it must not import NestJS, TypeORM or
 * anything else from the application, so the graph validator and later the engine can be tested directly.
 */

export const AUTOMATION_NODE_KINDS = ['trigger', 'condition', 'action', 'flow'] as const;

export type AutomationNodeKind = (typeof AUTOMATION_NODE_KINDS)[number];

export interface AutomationNodePorts {
	inputs: string[];
	outputs: string[];
}

export const AUTOMATION_NODE_REFERENCE_KINDS = [
	'device',
	'channel',
	'property',
	'scene',
	'space',
	'automation',
] as const;

export type AutomationNodeReferenceKind = (typeof AUTOMATION_NODE_REFERENCE_KINDS)[number];

/**
 * An entity a configured node depends on. Used to find the automations to invalidate when it is removed.
 */
export interface AutomationNodeReference {
	kind: AutomationNodeReferenceKind;
	id: string;
}

export type AutomationNodeConfig = Record<string, unknown>;

/**
 * The module or plugin a node type belongs to. A node type of a disabled plugin stays registered, so the
 * engine asks for the owner's `enabled` flag before it arms a trigger or executes a node (ADR 0003,
 * decision 13). Node types of the automations module itself leave it out and are always available.
 */
export interface AutomationNodeTypeOwner {
	kind: 'module' | 'plugin';
	/** The extension type, e.g. `spaces-home-control-plugin` */
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
 * What every node type declares, whatever its kind.
 */
export interface AutomationNodeTypeBase<TConfig extends object = AutomationNodeConfig> {
	/** Unique type identifier stored in the graph, e.g. `device.property.changed` */
	type: string;
	kind: AutomationNodeKind;
	/** Human-facing name in plain English; translating it is the job of the admin */
	name: string;
	/** Human-facing description in plain English */
	description: string;
	/**
	 * Ports edges can attach to. Triggers, conditions and actions may leave it out to get the ports of
	 * their kind (see AUTOMATION_NODE_DEFAULT_PORTS); flow types must declare their own.
	 */
	ports?: AutomationNodePorts;
	/** Checks a node configuration and returns the reasons it is refused; an empty list accepts it */
	validateConfig: AutomationNodeConfigValidator;
	/** JSON Schema of the configuration, served by the catalogue so a generic form can be built from it */
	configSchema?: Record<string, unknown>;
	/** Entities the configured node depends on */
	references?(config: TConfig): AutomationNodeReference[];
	/** The module or plugin the node type belongs to; left out by the automations module itself */
	owner?: AutomationNodeTypeOwner;
	/**
	 * Why the node type can not be used at the moment - something it needs is not set up, such as the
	 * house location of the sun cards - or undefined while it can. Asked whenever a graph is checked and
	 * the catalogue is listed, so it must be quick and must not throw. A graph using an unavailable node
	 * type can be kept as a disabled draft but not enabled. An automation that is already enabled stays
	 * armed: the node type itself decides what it does without what it needs.
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

/** The longest a condition or an action may run when its node type does not say otherwise */
export const AUTOMATION_NODE_DEFAULT_TIMEOUT_SECONDS = 30;

/** The longest timeout a node type may ask for */
export const AUTOMATION_NODE_MAX_TIMEOUT_SECONDS = 300;

/** The longest a Delay may park a run (ADR 0003, decision 7) */
export const AUTOMATION_DELAY_MAX_SECONDS = 60 * 60;

/** The longest a Wait until may park a run: the same limit as a Delay (ADR 0003, decision 7) */
export const AUTOMATION_WAIT_MAX_SECONDS = AUTOMATION_DELAY_MAX_SECONDS;

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
 * Something an action does to the home. An action node type lists what a configured node will do with
 * `commands()`, so one safety policy can judge every action - whichever card it is and whoever provides
 * it - without knowing the card (design § Security and safety).
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

export interface AutomationTriggerNodeType<
	TConfig extends object = AutomationNodeConfig,
> extends AutomationNodeTypeBase<TConfig> {
	kind: 'trigger';
	/**
	 * Starts watching for the event and returns the function that stops it. Called only for an enabled,
	 * valid automation; `fire` must not be called from inside this call. Whatever the trigger keeps (a
	 * state watch, a timer, a "for" duration) belongs to the subscription and has to be released by the
	 * returned function: no run mode touches it.
	 */
	subscribe(
		config: TConfig,
		fire: (data: AutomationTriggerData) => void,
		context?: AutomationTriggerContext,
	): () => void;
}

export interface AutomationConditionNodeType<
	TConfig extends object = AutomationNodeConfig,
> extends AutomationNodeTypeBase<TConfig> {
	kind: 'condition';
	/**
	 * Decides between the `yes` and the `no` output. A condition that throws, or does not answer within
	 * its timeout, evaluates to `no` with the reason recorded: a broken condition is never true.
	 */
	evaluate(config: TConfig, context: AutomationRunContext): Promise<AutomationConditionResult>;
	/** Overrides AUTOMATION_NODE_DEFAULT_TIMEOUT_SECONDS; capped at AUTOMATION_NODE_MAX_TIMEOUT_SECONDS */
	timeoutSeconds?: number;
}

export interface AutomationActionNodeType<
	TConfig extends object = AutomationNodeConfig,
> extends AutomationNodeTypeBase<TConfig> {
	kind: 'action';
	/**
	 * Does the work and decides between the `done` and the `error` output. An action that throws, or does
	 * not answer within its timeout, takes `error`.
	 *
	 * Several branches of one run execute in parallel and in no guaranteed order, and the engine neither
	 * orders nor merges what they write (ADR 0003, decision 16). An action that writes several values to
	 * one device groups them itself; a graph that needs an order chains its actions through `done`.
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

/** The flow behaviours the engine knows how to run */
export const AUTOMATION_FLOW_BEHAVIOURS = ['delay', 'wait_until', 'any', 'all'] as const;

export type AutomationFlowBehaviour = (typeof AUTOMATION_FLOW_BEHAVIOURS)[number];

/**
 * Flow types (Delay, Wait until, Any, All) are run by the engine itself, so they carry no handler: they
 * name the behaviour the engine is to apply. A flow type without a behaviour the engine knows can be
 * drawn, but an automation using it cannot run.
 */
export interface AutomationFlowNodeType<
	TConfig extends object = AutomationNodeConfig,
> extends AutomationNodeTypeBase<TConfig> {
	kind: 'flow';
	ports: AutomationNodePorts;
	flow?: AutomationFlowBehaviour;
}

/**
 * Parks the token for a time and then continues on `out`.
 */
export interface AutomationDelayNodeType<
	TConfig extends object = AutomationNodeConfig,
> extends AutomationFlowNodeType<TConfig> {
	flow: 'delay';
	/** How long to park, in seconds; the engine caps it at AUTOMATION_DELAY_MAX_SECONDS */
	delaySeconds(config: TConfig): number;
}

/**
 * What a Wait until answers when a token arrives at it.
 *
 * - `holds: true`: the awaited state already holds, so the token passes at once (ADR 0003, decision 4);
 * - `holds: false`: the state does not hold yet. The node type is watching for it and calls `resume` when
 *   it happens; `release` stops the watch and is called by the engine once the token goes on, whatever
 *   let it go on.
 */
export type AutomationWaitStart =
	| { holds: true; observed?: unknown; reason?: string }
	| { holds: false; observed?: unknown; reason?: string; release: () => void };

/** What a Wait until hands to `resume` when the awaited event happened */
export interface AutomationWaitEvent {
	/** What was seen, for the trace */
	observed?: unknown;
}

/**
 * Parks the token until a trigger-style event happens and continues on `out`, or on `timeout` when the
 * event did not happen in time. The timeout is mandatory and the engine caps it at
 * AUTOMATION_WAIT_MAX_SECONDS.
 */
export interface AutomationWaitUntilNodeType<
	TConfig extends object = AutomationNodeConfig,
> extends AutomationFlowNodeType<TConfig> {
	flow: 'wait_until';
	/** How long to wait at most, in seconds */
	timeoutSeconds(config: TConfig): number;
	/**
	 * Starts waiting for the event. `resume` may be called at any time once this was called, also before
	 * the returned promise resolves; calls after the first are ignored. A wait that throws ends the token
	 * and fails the run, as there is no `error` output to take.
	 */
	wait(
		config: TConfig,
		resume: (event: AutomationWaitEvent) => void,
		context: AutomationRunContext,
	): Promise<AutomationWaitStart>;
}

/**
 * Joins branches of one run (ADR 0003, decision 4). The state of a join belongs to the run.
 *
 * - `any` continues on the first token that arrives and absorbs every later one;
 * - `all` continues once a token has arrived on every incoming edge. It is a strict AND: when the run has
 *   nothing left that could still arrive, it does not continue and the trace names the missing edges.
 */
export interface AutomationJoinNodeType<
	TConfig extends object = AutomationNodeConfig,
> extends AutomationFlowNodeType<TConfig> {
	flow: 'any' | 'all';
}

/**
 * A node type as it is registered and listed. The kind-specific handlers (`subscribe`, `evaluate`,
 * `execute`) are declared by the interfaces above for the issues that add the engine and the first cards;
 * the registry and the validator need only the common part, so they accept any of them.
 */
export type AutomationNodeType<TConfig extends object = AutomationNodeConfig> = AutomationNodeTypeBase<TConfig>;

/**
 * A registered node type: the checked common part with its ports resolved, plus the definition it was
 * built from. The engine reaches the kind-specific handlers through `definition`, which is the very object
 * that was registered, so a node type may be a class instance with its handlers on the prototype.
 */
export interface RegisteredAutomationNodeType {
	type: string;
	kind: AutomationNodeKind;
	name: string;
	description: string;
	ports: AutomationNodePorts;
	configSchema?: Record<string, unknown>;
	validateConfig: AutomationNodeConfigValidator;
	references(config: AutomationNodeConfig): AutomationNodeReference[];
	/** What an action does to the home; empty for every other kind */
	commands(config: AutomationNodeConfig): AutomationActionCommand[];
	/** Why the node type can not be used at the moment; undefined while it can */
	unavailableReason(): string | undefined;
	owner?: AutomationNodeTypeOwner;
	definition: AutomationNodeTypeBase<any>;
}

export type AutomationNodeTypeLookup = (type: string) => RegisteredAutomationNodeType | undefined;

export const AUTOMATION_NODE_DEFAULT_PORTS: Readonly<
	Record<Exclude<AutomationNodeKind, 'flow'>, Readonly<AutomationNodePorts>>
> = {
	trigger: { inputs: [], outputs: ['out'] },
	condition: { inputs: ['in'], outputs: ['yes', 'no'] },
	action: { inputs: ['in'], outputs: ['done', 'error'] },
};

export const AUTOMATION_NODE_TYPE_MAX_LENGTH = 100;

/** Given for a node type whose availability could not be told */
export const AUTOMATION_NODE_TYPE_UNAVAILABLE_REASON = 'This block is not available at the moment.';
export const AUTOMATION_NODE_PORT_MAX_LENGTH = 64;

const NODE_TYPE_PATTERN = /^[a-z0-9]+(?:[._-][a-z0-9]+)*$/;

export class AutomationNodeTypeDefinitionError extends Error {
	public constructor(message: string) {
		super(message);
		this.name = 'AutomationNodeTypeDefinitionError';
	}
}

const isPortList = (value: unknown): value is string[] =>
	Array.isArray(value) &&
	value.every(
		(port) => typeof port === 'string' && port.length > 0 && port.length <= AUTOMATION_NODE_PORT_MAX_LENGTH,
	) &&
	new Set(value).size === value.length;

/**
 * Checks a node type definition and resolves its ports. Throws AutomationNodeTypeDefinitionError when the
 * definition could not be used by the validator: a broken definition is a programming error in the module
 * that registers it, and it has to fail at start rather than when somebody saves a graph.
 */
export const normalizeAutomationNodeType = <TConfig extends object>(
	nodeType: AutomationNodeTypeBase<TConfig>,
): RegisteredAutomationNodeType => {
	const definition = nodeType as Partial<AutomationNodeTypeBase<TConfig>> | null | undefined;

	if (typeof definition !== 'object' || definition === null) {
		throw new AutomationNodeTypeDefinitionError('An automation node type must be an object.');
	}

	const { type, kind } = definition;

	if (typeof type !== 'string' || type.length > AUTOMATION_NODE_TYPE_MAX_LENGTH || !NODE_TYPE_PATTERN.test(type)) {
		throw new AutomationNodeTypeDefinitionError(
			`An automation node type identifier must be lower-case words joined by ".", "_" or "-", at most ${AUTOMATION_NODE_TYPE_MAX_LENGTH} characters long.`,
		);
	}

	if (!AUTOMATION_NODE_KINDS.includes(kind)) {
		throw new AutomationNodeTypeDefinitionError(
			`Automation node type ${type} must be one of the kinds ${AUTOMATION_NODE_KINDS.join(', ')}.`,
		);
	}

	if (typeof definition.name !== 'string' || definition.name.trim() === '') {
		throw new AutomationNodeTypeDefinitionError(`Automation node type ${type} must have a name.`);
	}

	if (typeof definition.description !== 'string') {
		throw new AutomationNodeTypeDefinitionError(`Automation node type ${type} must have a description.`);
	}

	if (typeof definition.validateConfig !== 'function') {
		throw new AutomationNodeTypeDefinitionError(`Automation node type ${type} must validate its configuration.`);
	}

	if (definition.references !== undefined && typeof definition.references !== 'function') {
		throw new AutomationNodeTypeDefinitionError(`Automation node type ${type} has references that is not a function.`);
	}

	const { commands } = definition as { commands?: unknown };

	if (definition.unavailableReason !== undefined && typeof definition.unavailableReason !== 'function') {
		throw new AutomationNodeTypeDefinitionError(
			`Automation node type ${type} has an unavailable reason that is not a function.`,
		);
	}

	if (commands !== undefined && typeof commands !== 'function') {
		throw new AutomationNodeTypeDefinitionError(`Automation node type ${type} has commands that is not a function.`);
	}

	if (
		definition.configSchema !== undefined &&
		(typeof definition.configSchema !== 'object' ||
			definition.configSchema === null ||
			Array.isArray(definition.configSchema))
	) {
		throw new AutomationNodeTypeDefinitionError(
			`Automation node type ${type} has a config schema that is not an object.`,
		);
	}

	const owner = definition.owner as Partial<AutomationNodeTypeOwner> | null | undefined;

	if (
		owner !== undefined &&
		(typeof owner !== 'object' ||
			owner === null ||
			(owner.kind !== 'module' && owner.kind !== 'plugin') ||
			typeof owner.type !== 'string' ||
			owner.type === '')
	) {
		throw new AutomationNodeTypeDefinitionError(
			`Automation node type ${type} has an owner that does not name a module or a plugin.`,
		);
	}

	const declared = definition.ports ?? (kind === 'flow' ? undefined : AUTOMATION_NODE_DEFAULT_PORTS[kind]);

	if (declared === undefined) {
		throw new AutomationNodeTypeDefinitionError(`Automation flow node type ${type} must declare its ports.`);
	}

	if (
		typeof declared !== 'object' ||
		declared === null ||
		!isPortList(declared.inputs) ||
		!isPortList(declared.outputs)
	) {
		throw new AutomationNodeTypeDefinitionError(
			`Automation node type ${type} must declare its input and output ports as lists of unique, non-empty names.`,
		);
	}

	if (kind === 'trigger' && declared.inputs.length > 0) {
		throw new AutomationNodeTypeDefinitionError(`Automation trigger node type ${type} must not have input ports.`);
	}

	const source = nodeType as AutomationNodeTypeBase<any> & {
		commands?: (config: AutomationNodeConfig) => AutomationActionCommand[];
	};

	return {
		type,
		kind: kind,
		name: source.name,
		description: source.description,
		ports: { inputs: [...declared.inputs], outputs: [...declared.outputs] },
		...(source.configSchema !== undefined ? { configSchema: source.configSchema } : {}),
		validateConfig: (config) => source.validateConfig(config),
		references: (config) => source.references?.(config) ?? [],
		commands: (config) => (kind === 'action' ? (source.commands?.(config) ?? []) : []),
		unavailableReason: () => {
			try {
				const reason: unknown = source.unavailableReason?.();

				return typeof reason === 'string' && reason !== '' ? reason : undefined;
			} catch {
				return AUTOMATION_NODE_TYPE_UNAVAILABLE_REASON;
			}
		},
		...(owner ? { owner: { kind: owner.kind, type: owner.type } } : {}),
		definition: source,
	};
};
