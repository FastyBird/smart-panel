export const AUTH_MODULE_PREFIX = 'auth-module';

export const AUTH_MODULE_NAME = 'auth-module';

export const AUTH_MODULE_API_TAG_NAME = 'Auth module';

export const AUTH_MODULE_API_TAG_DESCRIPTION =
	'Endpoints related to user authentication, including registration, login, token validation, and session management.';

export enum TokenType {
	ACCESS = 'access',
	REFRESH = 'refresh',
	LONG_LIVE = 'long-live',
}

export enum TokenOwnerType {
	USER = 'user',
	DISPLAY = 'display',
	THIRD_PARTY = 'third_party',
}

export const ACCESS_TOKEN_TYPE = 'Bearer';
