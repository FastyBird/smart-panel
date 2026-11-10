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
}

/**
 * What a node is given when it runs. The engine (AU-4) extends this; nothing produces it yet.
 */
export interface AutomationRunContext {
	automationId: string;
	runId: string;
	/** Aborted when the run is cancelled */
	signal?: AbortSignal;
}

export interface AutomationTriggerData {
	/** Why the trigger fired, in a form that can be put into the run trace */
	[key: string]: unknown;
}

export interface AutomationConditionResult {
	result: boolean;
	observed?: unknown;
	reason?: string;
}

export interface AutomationActionResult {
	success: boolean;
	reason?: string;
}

export interface AutomationTriggerNodeType<
	TConfig extends object = AutomationNodeConfig,
> extends AutomationNodeTypeBase<TConfig> {
	kind: 'trigger';
	/** Starts watching for the event and returns the function that stops it */
	subscribe(config: TConfig, fire: (data: AutomationTriggerData) => void): () => void;
}

export interface AutomationConditionNodeType<
	TConfig extends object = AutomationNodeConfig,
> extends AutomationNodeTypeBase<TConfig> {
	kind: 'condition';
	evaluate(config: TConfig, context: AutomationRunContext): Promise<AutomationConditionResult>;
}

export interface AutomationActionNodeType<
	TConfig extends object = AutomationNodeConfig,
> extends AutomationNodeTypeBase<TConfig> {
	kind: 'action';
	execute(config: TConfig, context: AutomationRunContext): Promise<AutomationActionResult>;
}

/**
 * Flow types (Delay, Wait until, Any, All) are run by the engine itself, so they carry no handler.
 */
export interface AutomationFlowNodeType<
	TConfig extends object = AutomationNodeConfig,
> extends AutomationNodeTypeBase<TConfig> {
	kind: 'flow';
	ports: AutomationNodePorts;
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

	const source = nodeType as AutomationNodeTypeBase<any>;

	return {
		type,
		kind: kind,
		name: source.name,
		description: source.description,
		ports: { inputs: [...declared.inputs], outputs: [...declared.outputs] },
		...(source.configSchema !== undefined ? { configSchema: source.configSchema } : {}),
		validateConfig: (config) => source.validateConfig(config),
		references: (config) => source.references?.(config) ?? [],
		definition: source,
	};
};
