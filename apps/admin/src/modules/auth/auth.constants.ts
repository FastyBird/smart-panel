export const AUTH_MODULE_PREFIX = 'auth';

export const AUTH_MODULE_NAME = 'auth-module';

export enum AccessTokenType {
	BEARER = 'Bearer',
}

export const ACCESS_TOKEN_COOKIE_NAME = 'token';

export const REFRESH_TOKEN_COOKIE_NAME = 'refresh_token';

export enum FormResult {
	NONE = 'none',
	WORKING = 'working',
	ERROR = 'error',
	OK = 'ok',
}

export type FormResultType = FormResult.NONE | FormResult.WORKING | FormResult.ERROR | FormResult.OK;

export enum Layout {
	DEFAULT = 'default',
	PHONE = 'phone',
}

export type LayoutType = Layout.DEFAULT | Layout.PHONE;

export const RouteNames = {
	SIGN: 'auth_module-sign',
	SIGN_IN: 'auth_module-sign_in',
	SIGN_UP: 'auth_module-sign_up',
	SIGN_OUT: 'auth_module-sign_out',
	PROFILE: 'auth_module-profile',
	PROFILE_GENERAL: 'auth_module-profile_general',
	PROFILE_SECURITY: 'auth_module-profile_security',
};
