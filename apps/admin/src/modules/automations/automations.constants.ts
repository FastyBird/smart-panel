// Re-export from generated OpenAPI types — canonical definition is on the backend
import {
	AutomationsModuleDataRunStatus as AutomationRunRecordStatus,
	AutomationsModuleDataRunStepState as AutomationRunStepState,
	AutomationsModuleDataTriggerResultOutcome as AutomationTriggerOutcome,
} from '../../openapi';
import { AutomationMode, AutomationNodeKind, AutomationRunStatus, AutomationStatus } from '../../openapi.constants';

export {
	AutomationMode,
	AutomationNodeKind,
	AutomationRunRecordStatus,
	AutomationRunStatus,
	AutomationRunStepState,
	AutomationStatus,
	AutomationTriggerOutcome,
};

export const AUTOMATIONS_MODULE_PREFIX = 'automations';

export const AUTOMATIONS_MODULE_NAME = 'automations-module';

export const AUTOMATIONS_MODULE_EVENT_PREFIX = 'AutomationsModule.';

export enum EventType {
	AUTOMATION_CREATED = 'AutomationsModule.Automation.Created',
	AUTOMATION_UPDATED = 'AutomationsModule.Automation.Updated',
	AUTOMATION_DELETED = 'AutomationsModule.Automation.Deleted',
	MODULE_RESET = 'AutomationsModule.All.Reset',
	RUN_STARTED = 'AutomationsModule.Run.Started',
	RUN_COMPLETED = 'AutomationsModule.Run.Completed',
	// Sent only to the clients watching the automation (`CommandType.WATCH_AUTOMATION`), never over the bus
	RUN_STEP = 'AutomationsModule.Run.Step',
}

// The websocket commands that open and close the live view of one automation's runs
export enum CommandType {
	WATCH_AUTOMATION = 'AutomationsModule.WatchAutomation',
	UNWATCH_AUTOMATION = 'AutomationsModule.UnwatchAutomation',
}

export enum CommandHandlerName {
	WATCH_AUTOMATION = 'AutomationsModule.WatchAutomationHandler',
	UNWATCH_AUTOMATION = 'AutomationsModule.UnwatchAutomationHandler',
}

export enum FormResult {
	NONE = 'none',
	WORKING = 'working',
	ERROR = 'error',
	OK = 'ok',
}

export type FormResultType = FormResult.NONE | FormResult.WORKING | FormResult.ERROR | FormResult.OK;

export const RouteNames = {
	AUTOMATIONS: 'automations_module-automations',
	AUTOMATIONS_ADD: 'automations_module-automations_add',
	AUTOMATIONS_EDIT: 'automations_module-automations_edit',
	AUTOMATIONS_FLOW: 'automations_module-automations_flow',
};

export type StateColor = 'info' | 'warning' | 'success' | 'primary' | 'danger' | undefined;

export const DEFAULT_PAGE = 1;
export const DEFAULT_PAGE_SIZE = 10;

// Limits enforced by the backend
export const AUTOMATION_NAME_MAX_LENGTH = 100;
export const AUTOMATION_DESCRIPTION_MAX_LENGTH = 1000;

// Application error code of a save refused because of its graph (`error.details.code` of the 422 response)
export const AUTOMATION_GRAPH_INVALID_ERROR_CODE = 'automation-graph-invalid';

// Filter value matching the automations that belong to no space
export const WHOLE_HOME_SPACE_FILTER = 'whole_home';

export const AUTOMATION_DEFAULT_ICON = 'mdi:robot-outline';

export const AUTOMATION_STATUS_COLORS: Record<AutomationStatus, StateColor> = {
	[AutomationStatus.ok]: 'success',
	[AutomationStatus.invalid]: 'danger',
	[AutomationStatus.suspended]: 'warning',
};

export const AUTOMATION_RUN_STATUS_COLORS: Record<AutomationRunStatus, StateColor> = {
	[AutomationRunStatus.completed]: 'success',
	[AutomationRunStatus.failed]: 'danger',
	[AutomationRunStatus.cancelled]: 'info',
	[AutomationRunStatus.interrupted]: 'warning',
};

// A stored run is `running` while it is parked on a Delay; the other statuses are those of a run that ended
export const AUTOMATION_RUN_RECORD_STATUS_COLORS: Record<AutomationRunRecordStatus, StateColor> = {
	[AutomationRunRecordStatus.running]: 'primary',
	[AutomationRunRecordStatus.completed]: 'success',
	[AutomationRunRecordStatus.failed]: 'danger',
	[AutomationRunRecordStatus.cancelled]: 'info',
	[AutomationRunRecordStatus.interrupted]: 'warning',
};

// RUNS
// ====

// How many runs of an automation the backend keeps (ADR 0003, decision 12)
export const AUTOMATION_RUNS_KEPT_PER_AUTOMATION = 50;

// How many runs read on their own the admin keeps the traces of, besides those a view has open
export const AUTOMATION_RUN_TRACES_KEPT = 20;

// Why the backend refuses a manual run (`error.details.code` of the 422 response)
export type AutomationTriggerRefusal = 'disabled' | 'invalid' | 'suspended' | 'not_a_trigger' | 'no_trigger' | 'not_running' | 'not_found';

export const AUTOMATION_TRIGGER_REFUSALS: AutomationTriggerRefusal[] = [
	'disabled',
	'invalid',
	'suspended',
	'not_a_trigger',
	'no_trigger',
	'not_running',
	'not_found',
];

// Why a run ended early, as the backend names it in `end_reason`; anything else is a sentence in English.
// An interrupted run was stopped by the server, a cancelled one by the engine (see its `teardown` reasons).
export const AUTOMATION_RUN_INTERRUPT_REASONS = ['restarted', 'engine_stopped', 'backend_restarted'] as const;

export const AUTOMATION_RUN_CANCEL_REASONS = [
	'restarted',
	'engine_stopped',
	'backend_restarted',
	'automation_updated',
	'automation_disabled',
	'automation_invalid',
	'suspended',
] as const;

// How many runs the live view keeps the steps of while it waits to learn which one it follows
export const AUTOMATION_LIVE_RUNS_BUFFERED = 5;

// How many times what a run stored is read when its events may have been missed, and how long apart
export const AUTOMATION_RUN_RECOVER_ATTEMPTS = 3;

export const AUTOMATION_RUN_RECOVER_RETRY_MS = 2000;

// FLOW EDITOR
// ===========

export const AUTOMATION_GRAPH_VERSION = 1;

// Limits of a graph enforced by the backend
export const AUTOMATION_GRAPH_MAX_NODES = 100;
export const AUTOMATION_GRAPH_MAX_EDGES = 400;
export const AUTOMATION_GRAPH_POSITION_LIMIT = 1_000_000;

// The palette and the cards speak of When / And / Then; this is the order of the palette groups
export const AUTOMATION_NODE_KIND_ORDER: AutomationNodeKind[] = [
	AutomationNodeKind.trigger,
	AutomationNodeKind.condition,
	AutomationNodeKind.action,
	AutomationNodeKind.flow,
];

export const AUTOMATION_NODE_KIND_ICONS: Record<AutomationNodeKind, string> = {
	[AutomationNodeKind.trigger]: 'mdi:lightning-bolt-outline',
	[AutomationNodeKind.condition]: 'mdi:help-rhombus-outline',
	[AutomationNodeKind.action]: 'mdi:play-circle-outline',
	[AutomationNodeKind.flow]: 'mdi:source-branch',
};

// Icons of the cards the automations module itself provides; any other card shows the icon of its kind
export const AUTOMATION_NODE_TYPE_ICONS: Record<string, string> = {
	'device.property.changed': 'mdi:motion-sensor',
	'device.property.compare': 'mdi:scale-balance',
	'device.property.set': 'mdi:tune-variant',
	'manual.start': 'mdi:gesture-tap-button',
	'notification.send': 'mdi:bell-outline',
	'scene.run': 'mdi:palette-outline',
	'time.of-day': 'mdi:clock-outline',
	'time.window': 'mdi:clock-time-four-outline',
	'flow.delay': 'mdi:timer-sand',
};

export const AUTOMATION_FLOW_ICON = 'mdi:sitemap-outline';

// The type a palette item carries while it is dragged onto the canvas
export const AUTOMATION_NODE_DRAG_MIME = 'application/x-automation-node-type';

// Why a connection cannot be drawn. Mirrors what the backend refuses on save, plus the size limit.
export type AutomationConnectionRejection = 'unknown_node' | 'unknown_port' | 'into_trigger' | 'self' | 'duplicate' | 'cycle' | 'limit';

// How many steps of the session can be undone
export const AUTOMATION_EDITOR_HISTORY_LIMIT = 100;
