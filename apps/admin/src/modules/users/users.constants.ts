export const USERS_MODULE_PREFIX = 'users-module';

export const USERS_MODULE_EVENT_PREFIX = 'UsersModule.';

export enum EventType {
	USER_CREATED = 'UsersModule.User.Created',
	USER_UPDATED = 'UsersModule.User.Updated',
	USER_DELETED = 'UsersModule.User.Deleted',
}

export const DISPLAY_USERNAME = 'display';

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
