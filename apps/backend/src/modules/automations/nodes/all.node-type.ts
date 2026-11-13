import { AutomationJoinNodeType } from '../graph/node-type';

import { JoinNodeConfig, validateJoinConfig } from './any.node-type';

export const ALL_NODE_TYPE = 'flow.all';

/**
 * The All block: joins branches of a run and continues once a token has arrived on every edge leading
 * into it.
 *
 * It is a strict AND within one run (ADR 0003, decision 4). When a branch can no longer arrive - the run
 * has nothing else left - the block does not continue and the trace names the edges that were missing.
 * A run starts from one trigger, so an All fed from two different triggers can never continue and is
 * refused on save; "A and B within 30 s" is built with Wait until.
 */
export const allNodeType: AutomationJoinNodeType<JoinNodeConfig> = {
	type: ALL_NODE_TYPE,
	kind: 'flow',
	flow: 'all',
	name: 'All',
	description: 'Continues once every branch leading to it has arrived in the same run.',
	ports: { inputs: ['in'], outputs: ['out'] },
	validateConfig: validateJoinConfig,
	configSchema: { type: 'object', properties: {}, additionalProperties: false },
};
