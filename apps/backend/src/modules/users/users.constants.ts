export const USERS_MODULE_PREFIX = 'users-module';

export const USERS_MODULE_NAME = 'users-module';

export const USERS_MODULE_API_TAG_NAME = 'Users module';

export const USERS_MODULE_API_TAG_DESCRIPTION =
	'Endpoints for managing users, including user roles, permissions, and profile details.';

export enum EventType {
	USER_CREATED = 'UsersModule.User.Created',
	USER_UPDATED = 'UsersModule.User.Updated',
	USER_DELETED = 'UsersModule.User.Deleted',
	USER_RESET = 'UsersModule.User.Reset',
	MODULE_RESET = 'UsersModule.All.Reset',
}

export enum UserRole {
	OWNER = 'owner',
	ADMIN = 'admin',
	USER = 'user',
}
