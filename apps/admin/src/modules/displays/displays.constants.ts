export const DISPLAYS_MODULE_PREFIX = 'displays-module';

export const DISPLAYS_MODULE_NAME = 'displays-module';

export const DISPLAYS_MODULE_EVENT_PREFIX = 'DisplaysModule.';

export enum EventType {
	DISPLAY_CREATED = 'DisplaysModule.Display.Created',
	DISPLAY_UPDATED = 'DisplaysModule.Display.Updated',
	DISPLAY_DELETED = 'DisplaysModule.Display.Deleted',
	DISPLAY_TOKEN_REVOKED = 'DisplaysModule.Display.TokenRevoked',
}

export enum FormResult {
	NONE = 'none',
	WORKING = 'working',
	ERROR = 'error',
	OK = 'ok',
}

export type FormResultType = FormResult.NONE | FormResult.WORKING | FormResult.ERROR | FormResult.OK;

export const RouteNames = {
	DISPLAYS: 'displays_module-displays',
	DISPLAYS_EDIT: 'displays_module-displays_edit',
	DISPLAY: 'displays_module-display',
	DISPLAY_EDIT: 'displays_module-display_edit',
	DISPLAY_TOKENS: 'displays_module-display_tokens',
};

export const DEFAULT_PAGE = 1;
export const DEFAULT_PAGE_SIZE = 10;
