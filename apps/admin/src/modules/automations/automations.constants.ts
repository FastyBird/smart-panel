// Re-export from generated OpenAPI types — canonical definition is on the backend
import { AutomationMode, AutomationNodeKind, AutomationRunStatus, AutomationStatus } from '../../openapi.constants';

export { AutomationMode, AutomationNodeKind, AutomationRunStatus, AutomationStatus };

export const AUTOMATIONS_MODULE_PREFIX = 'automations';

export const AUTOMATIONS_MODULE_NAME = 'automations-module';

export const AUTOMATIONS_MODULE_EVENT_PREFIX = 'AutomationsModule.';

export enum EventType {
	AUTOMATION_CREATED = 'AutomationsModule.Automation.Created',
	AUTOMATION_UPDATED = 'AutomationsModule.Automation.Updated',
	AUTOMATION_DELETED = 'AutomationsModule.Automation.Deleted',
	MODULE_RESET = 'AutomationsModule.All.Reset',
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
