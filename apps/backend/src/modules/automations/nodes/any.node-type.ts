import { AutomationJoinNodeType, AutomationNodeConfig } from '../graph/node-type';

export const ANY_NODE_TYPE = 'flow.any';

/** A join has nothing to configure */
export type JoinNodeConfig = Record<string, never>;

/** Refuses every property: a join has nothing to declare, so there is no DTO */
export const validateJoinConfig = (config: AutomationNodeConfig) =>
	Object.keys(config ?? {}).map((field) => ({ field, reason: 'This property is not allowed.' }));

/**
 * The Any block: joins branches of a run and continues on the first one that arrives.
 *
 * Every later arrival in the same run is absorbed, so what follows the block runs once per run however
 * many branches lead to it (ADR 0003, decision 4). The engine keeps what the block has seen in the run,
 * so the next run starts afresh.
 */
export const anyNodeType: AutomationJoinNodeType<JoinNodeConfig> = {
	type: ANY_NODE_TYPE,
	kind: 'flow',
	flow: 'any',
	name: 'Any',
	description: 'Continues when the first of the branches leading to it arrives; later ones in the same run stop here.',
	ports: { inputs: ['in'], outputs: ['out'] },
	validateConfig: validateJoinConfig,
	configSchema: { type: 'object', properties: {}, additionalProperties: false },
};
