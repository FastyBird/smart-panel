export const USERS_MODULE_PREFIX = 'users-module';

export const USERS_MODULE_NAME = 'users-module';

export enum EventType {
	USER_CREATED = 'UsersModule.User.Created',
	USER_UPDATED = 'UsersModule.User.Updated',
	USER_DELETED = 'UsersModule.User.Deleted',
	USER_RESET = 'UsersModule.User.Reset',
	DISPLAY_CREATED = 'UsersModule.Display.Created',
	DISPLAY_UPDATED = 'UsersModule.Display.Updated',
	DISPLAY_DELETED = 'UsersModule.Display.Deleted',
	DISPLAY_RESET = 'UsersModule.Display.Reset',
	MODULE_RESET = 'UsersModule.All.Reset',
}

export enum UserRole {
	OWNER = 'owner',
	ADMIN = 'admin',
	USER = 'user',
	DISPLAY = 'display',
}
