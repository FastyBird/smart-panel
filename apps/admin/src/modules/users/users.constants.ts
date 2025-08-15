export const USERS_MODULE_PREFIX = 'users-module';

export const USERS_MODULE_EVENT_PREFIX = 'UsersModule.';

export enum EventType {
	USER_CREATED = 'UsersModule.User.Created',
	USER_UPDATED = 'UsersModule.User.Updated',
	USER_DELETED = 'UsersModule.User.Deleted',
	USER_RESET = 'UsersModule.User.Reset',
	DISPLAY_INSTANCE_CREATED = 'UsersModule.DisplayInstance.Created',
	DISPLAY_INSTANCE_UPDATED = 'UsersModule.DisplayInstance.Updated',
	DISPLAY_INSTANCE_DELETED = 'UsersModule.DisplayInstance.Deleted',
	DISPLAY_INSTANCE_RESET = 'UsersModule.DisplayInstance.Reset',
	MODULE_RESET = 'UsersModule.All.Reset',
}

export enum FormResult {
	NONE = 'none',
	WORKING = 'working',
	ERROR = 'error',
	OK = 'ok',
}

export type FormResultType = FormResult.NONE | FormResult.WORKING | FormResult.ERROR | FormResult.OK;

export const RouteNames = {
	USERS: 'users_module-users',
	USER_ADD: 'users_module-user-add',
	USER_EDIT: 'users_module-user-edit',
};
