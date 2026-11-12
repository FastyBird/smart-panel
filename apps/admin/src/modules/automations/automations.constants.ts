// Re-export from generated OpenAPI types — canonical definition is on the backend
import { AutomationMode, AutomationRunStatus, AutomationStatus } from '../../openapi.constants';

export { AutomationMode, AutomationRunStatus, AutomationStatus };

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
