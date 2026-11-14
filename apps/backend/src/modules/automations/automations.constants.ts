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
	RUN_STARTED = 'AutomationsModule.Run.Started',
	RUN_COMPLETED = 'AutomationsModule.Run.Completed',
}

/**
 * Sent over the websocket only, and only to the clients watching the automation: it never goes over the bus,
 * so the exchange stays quiet while nobody looks at a run.
 */
export const AUTOMATION_RUN_STEP_EVENT = 'AutomationsModule.Run.Step';

/** The websocket room of the clients watching one automation */
export const automationWatchRoom = (automationId: string): string => `automation-${automationId}`;

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

/** The status of a stored run: `running` marks a run that parked and has not ended yet */
export enum AutomationRunRecordStatus {
	RUNNING = 'running',
	COMPLETED = 'completed',
	FAILED = 'failed',
	CANCELLED = 'cancelled',
	INTERRUPTED = 'interrupted',
}

// Graph document
export const AUTOMATION_GRAPH_VERSION = 1;

// Limits
export const AUTOMATIONS_MAX_COUNT = 200;
export const AUTOMATION_NAME_MAX_LENGTH = 100;
export const AUTOMATION_DESCRIPTION_MAX_LENGTH = 1000;
export const AUTOMATION_ICON_MAX_LENGTH = 100;
export const AUTOMATION_GRAPH_MAX_NODES = 100;
export const AUTOMATION_GRAPH_MAX_EDGES = 400;
export const AUTOMATION_GRAPH_ID_MAX_LENGTH = 64;
export const AUTOMATION_GRAPH_NODE_TYPE_MAX_LENGTH = 100;
export const AUTOMATION_GRAPH_PORT_MAX_LENGTH = 64;
export const AUTOMATION_GRAPH_POSITION_LIMIT = 1_000_000;

// Engine
export const AUTOMATION_ENGINE_SERVICE_ID = 'engine';
export const AUTOMATION_SUSPENDED_NOTIFICATION_KEY_PREFIX = 'automation-suspended:';

// Run history (ADR 0003, decision 12)
export const AUTOMATION_RUNS_KEPT_PER_AUTOMATION = 50;
export const AUTOMATION_RUNS_RETENTION_DAYS = 30;
/** The most a stored trace may take, as serialised JSON in UTF-8 bytes */
export const AUTOMATION_RUN_TRACE_MAX_LENGTH = 128 * 1024;
/** The most one observed value or the data of a trigger may take in a trace, as serialised JSON in UTF-8 bytes */
export const AUTOMATION_RUN_TRACE_VALUE_MAX_LENGTH = 2048;
/** Why a run found as `running` when the engine starts was interrupted */
export const AUTOMATION_RUN_INTERRUPTED_BY_RESTART = 'backend_restarted';

// Application error code of a save refused because of its graph (error.details.code of the 422 response)
export const AUTOMATION_GRAPH_INVALID_ERROR_CODE = 'automation-graph-invalid';

// Application error code of answers to a template that were refused (error.details.code of the 422 response)
export const AUTOMATION_TEMPLATE_PARAMETERS_INVALID_ERROR_CODE = 'automation-template-parameters-invalid';
