export const USERS_MODULE_PREFIX = 'users-module';

export enum EventType {
	USER_CREATED = 'UsersModule.User.Created',
	USER_UPDATED = 'UsersModule.User.Updated',
	USER_DELETED = 'UsersModule.User.Deleted',
	DISPLAY_CREATED = 'UsersModule.Display.Created',
	DISPLAY_UPDATED = 'UsersModule.Display.Updated',
	DISPLAY_DELETED = 'UsersModule.Display.Deleted',
}

export enum UserRole {
	OWNER = 'owner',
	ADMIN = 'admin',
	USER = 'user',
	DISPLAY = 'display',
}
