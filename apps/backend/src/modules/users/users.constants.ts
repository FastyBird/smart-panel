export const USERS_MODULE_PREFIX = 'users-module';

export enum EventType {
	USER_CREATED = 'UsersModule.User.Created',
	USER_UPDATED = 'UsersModule.User.Updated',
	USER_DELETED = 'UsersModule.User.Deleted',
}

export enum UserRole {
	OWNER = 'owner',
	ADMIN = 'admin',
	USER = 'user',
	DISPLAY = 'display',
}

export const DISPLAY_USERNAME = 'display';
