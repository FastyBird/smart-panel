export const AUTOMATIONS_MODULE_PREFIX = 'automations';

export const AUTOMATIONS_MODULE_NAME = 'automations-module';

export const AUTOMATIONS_MODULE_API_TAG_NAME = 'Automations module';

export const AUTOMATIONS_MODULE_API_TAG_DESCRIPTION =
	'A collection of endpoints for managing automations: graphs of When / And / Then blocks that the backend runs on its own.';

export enum EventType {
	AUTOMATION_CREATED = 'AutomationsModule.Automation.Created',
	AUTOMATION_UPDATED = 'AutomationsModule.Automation.Updated',
	AUTOMATION_DELETED = 'AutomationsModule.Automation.Deleted',
	MODULE_RESET = 'AutomationsModule.All.Reset',
}

export enum AutomationMode {
	SINGLE = 'single',
	RESTART = 'restart',
	PARALLEL = 'parallel',
}

export enum AutomationStatus {
	OK = 'ok',
	INVALID = 'invalid',
	SUSPENDED = 'suspended',
}

export enum AutomationRunStatus {
	COMPLETED = 'completed',
	FAILED = 'failed',
	CANCELLED = 'cancelled',
	INTERRUPTED = 'interrupted',
}

// Graph document
export const AUTOMATION_GRAPH_VERSION = 1;

// Limits
export const AUTOMATION_NAME_MAX_LENGTH = 100;
export const AUTOMATION_DESCRIPTION_MAX_LENGTH = 1000;
export const AUTOMATION_ICON_MAX_LENGTH = 100;
export const AUTOMATION_GRAPH_MAX_NODES = 100;
export const AUTOMATION_GRAPH_MAX_EDGES = 400;
export const AUTOMATION_GRAPH_ID_MAX_LENGTH = 64;
export const AUTOMATION_GRAPH_NODE_TYPE_MAX_LENGTH = 100;
export const AUTOMATION_GRAPH_PORT_MAX_LENGTH = 64;
export const AUTOMATION_GRAPH_POSITION_LIMIT = 1_000_000;
