/**
 * Programmable node types and graph builders for the engine tests. Never registered by the application.
 */
import {
	AutomationActionNodeType,
	AutomationConditionNodeType,
	AutomationNodeReference,
	AutomationNodeType,
	AutomationNodeTypeLookup,
	AutomationRunContext,
	AutomationTriggerData,
	AutomationTriggerNodeType,
	RegisteredAutomationNodeType,
	normalizeAutomationNodeType,
} from '../graph/node-type';
import { allNodeType } from '../nodes/all.node-type';
import { anyNodeType } from '../nodes/any.node-type';
import { delayNodeType } from '../nodes/delay.node-type';
import { TrackerClock } from '../tracker/clock';

import { fakeJoin } from './fake-node-types';

export const ENGINE_TRIGGER_TYPE = 'engine.trigger';
export const ENGINE_CONDITION_TYPE = 'engine.condition';
export const ENGINE_ACTION_TYPE = 'engine.action';
export const ENGINE_PLUGIN_TRIGGER_TYPE = 'engine.plugin-trigger';
export const ENGINE_PLUGIN_ACTION_TYPE = 'engine.plugin-action';
export const ENGINE_PLUGIN_DELAY_TYPE = 'engine.plugin-delay';
export const ENGINE_BROKEN_TRIGGER_TYPE = 'engine.broken-trigger';
export const ENGINE_TEST_PLUGIN = 'engine-test-plugin';

export interface EngineNodeBehaviour {
	/** How the node shows up in `calls`; defaults to the node id */
	name?: string;
	/** Condition: the answer (default true). */
	result?: boolean;
	/** Action: answer `success: false` */
	fail?: boolean;
	/** Throw instead of answering */
	throws?: boolean;
	/** Never answer */
	hang?: boolean;
	/** Answer after this many milliseconds of the test clock */
	latencyMs?: number;
	observed?: unknown;
	references?: AutomationNodeReference[];
	/** Trigger: the key its `fire` is kept under; defaults to `default` */
	key?: string;
}

export interface GraphNode {
	id: string;
	type: string;
	position: { x: number; y: number };
	config: Record<string, unknown>;
}

export interface GraphEdge {
	id: string;
	source: string;
	source_port: string;
	target: string;
	target_port: string;
}

export interface Graph {
	version: number;
	nodes: GraphNode[];
	edges: GraphEdge[];
}

export const node = (
	id: string,
	type: string,
	config: EngineNodeBehaviour | Record<string, unknown> = {},
): GraphNode => ({
	id,
	type,
	position: { x: 0, y: 0 },
	config: { ...config },
});

/** `a:out>b` connects output `out` of node `a` to the input `in` of node `b` */
export const edge = (spec: string): GraphEdge => {
	const [from, target] = spec.split('>');
	const [source, port] = from.split(':');

	return { id: spec, source, source_port: port, target, target_port: 'in' };
};

export const graph = (nodes: GraphNode[], edges: (GraphEdge | string)[] = []): Graph => ({
	version: 1,
	nodes,
	edges: edges.map((item) => (typeof item === 'string' ? edge(item) : item)),
});

/** Lets every pending promise callback run */
export const flush = (): Promise<void> => new Promise((resolve) => setImmediate(resolve));

export class EngineHarness {
	/** Names of the conditions and actions in the order they were called */
	public readonly calls: string[] = [];
	/** The contexts the conditions and actions were called with, by name */
	public readonly contexts = new Map<string, AutomationRunContext>();
	/** How many times each trigger key was subscribed and released */
	public subscribed = 0;
	public released = 0;

	private readonly fires = new Map<string, Set<(data: AutomationTriggerData) => void>>();
	private readonly lateFires: ((data: AutomationTriggerData) => void)[] = [];
	private readonly registered = new Map<string, RegisteredAutomationNodeType>();

	public readonly lookup: AutomationNodeTypeLookup = (type) => this.registered.get(type);

	public constructor(private readonly clock: TrackerClock) {
		for (const nodeType of this.nodeTypes()) {
			this.registered.set(nodeType.type, normalizeAutomationNodeType(nodeType));
		}
	}

	/** Fires every subscription of the trigger key and returns how many there were */
	public fire(key = 'default', data: AutomationTriggerData = {}): number {
		const fires = [...(this.fires.get(key) ?? [])];

		for (const fire of fires) fire(data);

		return fires.length;
	}

	/** Calls the `fire` of every subscription ever made, released or not */
	public fireStale(data: AutomationTriggerData = {}): void {
		for (const fire of this.lateFires) fire(data);
	}

	public activeSubscriptions(): number {
		return [...this.fires.values()].reduce((total, fires) => total + fires.size, 0);
	}

	public unregister(type: string): void {
		this.registered.delete(type);
	}

	/** Registers one more node type, e.g. a built-in card wired to a test tracker */
	public register(nodeType: AutomationNodeType<any>): void {
		this.registered.set(nodeType.type, normalizeAutomationNodeType(nodeType));
	}

	public nodeTypes(): AutomationNodeType<any>[] {
		const subscribe: AutomationTriggerNodeType<EngineNodeBehaviour>['subscribe'] = (config, fire) => {
			const key = config.key ?? 'default';
			const fires = this.fires.get(key) ?? new Set();

			fires.add(fire);
			this.fires.set(key, fires);
			this.lateFires.push(fire);
			this.subscribed += 1;

			return () => {
				fires.delete(fire);
				this.released += 1;
			};
		};

		const answer = <T>(config: EngineNodeBehaviour, context: AutomationRunContext, value: T): Promise<T> => {
			const name = config.name ?? context.nodeId;

			this.calls.push(name);
			this.contexts.set(name, context);

			if (config.throws) {
				return Promise.reject(new Error(`${name} broke`));
			}

			if (config.hang) {
				return new Promise<T>(() => undefined);
			}

			if (config.latencyMs !== undefined) {
				return new Promise<T>((resolve) => {
					this.clock.setTimeout(() => resolve(value), config.latencyMs ?? 0);
				});
			}

			return Promise.resolve(value);
		};

		const references = (config: EngineNodeBehaviour): AutomationNodeReference[] => config.references ?? [];

		const trigger: AutomationTriggerNodeType<EngineNodeBehaviour> = {
			type: ENGINE_TRIGGER_TYPE,
			kind: 'trigger',
			name: 'Engine trigger',
			description: 'Fires when the test says so.',
			validateConfig: () => [],
			references,
			subscribe,
		};

		const condition: AutomationConditionNodeType<EngineNodeBehaviour> = {
			type: ENGINE_CONDITION_TYPE,
			kind: 'condition',
			name: 'Engine condition',
			description: 'Answers what the test configured.',
			validateConfig: () => [],
			references,
			evaluate: (config, context) =>
				answer(config, context, {
					result: config.result ?? true,
					...(config.observed !== undefined ? { observed: config.observed } : {}),
				}),
		};

		const action: AutomationActionNodeType<EngineNodeBehaviour> = {
			type: ENGINE_ACTION_TYPE,
			kind: 'action',
			name: 'Engine action',
			description: 'Records that it ran.',
			validateConfig: () => [],
			references,
			execute: (config, context) =>
				answer(config, context, config.fail ? { success: false, reason: 'the device refused' } : { success: true }),
		};

		const owner = { kind: 'plugin', type: ENGINE_TEST_PLUGIN } as const;

		return [
			trigger,
			condition,
			action,
			{ ...trigger, type: ENGINE_PLUGIN_TRIGGER_TYPE, owner },
			{ ...action, type: ENGINE_PLUGIN_ACTION_TYPE, owner },
			{ ...delayNodeType, type: ENGINE_PLUGIN_DELAY_TYPE, owner },
			{
				...trigger,
				type: ENGINE_BROKEN_TRIGGER_TYPE,
				subscribe: () => {
					throw new Error('cannot subscribe');
				},
			},
			delayNodeType,
			anyNodeType,
			allNodeType,
			fakeJoin,
		];
	}
}
