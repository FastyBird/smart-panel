import { AutomationNodeConfig, AutomationTriggerNodeType } from '../graph/node-type';

export const MANUAL_START_NODE_TYPE = 'manual.start';

/** The manual start has nothing to configure */
export type ManualStartConfig = Record<string, never>;

/**
 * The manual start: a trigger that never fires on its own. It gives a graph a place where a run can be
 * started by hand - from the admin, through the API or the websocket command, and later from a scene tile,
 * Buddy or MCP. The engine starts a manual run at a trigger node, so this card is what an automation that
 * should only ever be run by hand is built from.
 */
export const manualStartNodeType: AutomationTriggerNodeType<ManualStartConfig> = {
	type: MANUAL_START_NODE_TYPE,
	kind: 'trigger',
	name: 'Manual start',
	description: 'Starts only when the automation is run by hand.',
	// There is nothing to declare, so there is no DTO: every property is one too many
	validateConfig: (config: AutomationNodeConfig) =>
		Object.keys(config ?? {}).map((field) => ({ field, reason: 'This property is not allowed.' })),
	configSchema: { type: 'object', properties: {}, additionalProperties: false },
	// Nothing to watch: the engine starts the run when it is asked to
	subscribe: () => () => undefined,
};
