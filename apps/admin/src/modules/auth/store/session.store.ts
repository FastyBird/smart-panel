import { ref } from 'vue';
import { useCookies } from 'vue3-cookies';

import { type Pinia, defineStore } from 'pinia';

import { jwtDecode } from 'jwt-decode';

import { getErrorReason, useBackend, useLogger } from '../../../common';
import type {
	AuthModuleGetProfileOperation,
	AuthModuleRegisterOperation,
} from '../../../openapi.constants';
import { type IUser, transformUserResponse } from '../../users';
import { ACCESS_TOKEN_COOKIE_NAME, AUTH_MODULE_PREFIX, AccessTokenType, REFRESH_TOKEN_COOKIE_NAME } from '../auth.constants';
import { AuthApiException, AuthException } from '../auth.exceptions';

import { TokenPairSchema } from './session.store.schemas';
import type {
	ISessionCreateActionPayload,
	ISessionEditActionPayload,
	ISessionRegisterActionPayload,
	ISessionStateSemaphore,
	ITokenPair,
	ITokenPayload,
	SessionStore,
	SessionStoreSetup,
} from './session.store.types';
import { transformTokenPairResponse } from './session.transformers';

const defaultSemaphore: ISessionStateSemaphore = {
	fetching: false,
	creating: false,
	updating: false,
};

export const useSession = defineStore<'auth_module-session', SessionStoreSetup>('auth_module-session', (): SessionStoreSetup => {
	const backend = useBackend();
	const logger = useLogger();

	const { cookies } = useCookies();

	const semaphore = ref<ISessionStateSemaphore>(defaultSemaphore);

	const tokenPair = ref<ITokenPair | null>(null);
	const profile = ref<IUser | null>(null);

	const accessToken = (): string | null => tokenPair.value?.accessToken ?? null;

	const refreshToken = (): string | null => tokenPair.value?.refreshToken ?? null;

	const isSignedIn = (): boolean => tokenPair.value !== null && profile.value !== null;

	const isExpired = (): boolean => {
		if (tokenPair.value === null) {
			return false;
		}

		const expiration = tokenPair.value.expiration;

		return expiration === null || expiration.getTime() < new Date().getTime();
	};

	let pendingGetPromise: Promise<IUser> | undefined;
	let pendingRefreshPromise: Promise<boolean> | undefined;

	const initialize = async (): Promise<boolean> => {
		if (tokenPair.value !== null) {
			return false;
		}

		const accessTokenCookie = readCookie(ACCESS_TOKEN_COOKIE_NAME);
		const refreshTokenCookie = readCookie(REFRESH_TOKEN_COOKIE_NAME);

		if (refreshTokenCookie === null) {
			// Refresh token is missing, user is considered as logged out
			clear();

			return false;
		}

		if (accessTokenCookie !== null) {
			const decodedAccessToken = jwtDecode<ITokenPayload>(accessTokenCookie);

			// Rebuild session instance from stored cookies
			const parsedSession = TokenPairSchema.safeParse({
				accessToken: accessTokenCookie,
				refreshToken: refreshTokenCookie,
				expiration: decodedAccessToken.exp ? decodedAccessToken.exp * 1000 : null,
				type: AccessTokenType.BEARER,
			});

			if (parsedSession.success) {
				tokenPair.value = parsedSession.data;
			} else {
				logger.error('Schema validation failed with:', parsedSession.error);

				clear();

				return false;
			}
		} else {
			try {
				// Access token is missing, need to refresh tokens
				await refresh();
			} catch (error: unknown) {
				if (error instanceof AuthApiException) {
					throw error;
				}

				throw new AuthException('Failed to initialize session.', error instanceof Error ? error : undefined);
			}
		}

		try {
			// Get user profile info
			await get();

			return true;
		} catch (error: unknown) {
			if (error instanceof AuthApiException) {
				throw error;
			}

			throw new AuthException('Failed to initialize session.', error instanceof Error ? error : undefined);
		}
	};

	const clear = (): void => {
		semaphore.value = defaultSemaphore;

		tokenPair.value = null;
		profile.value = null;

		deleteCookie(ACCESS_TOKEN_COOKIE_NAME);
		deleteCookie(REFRESH_TOKEN_COOKIE_NAME);
	};

	const get = async (): Promise<IUser> => {
		if (typeof pendingGetPromise !== 'undefined') {
			return pendingGetPromise;
		}

		const getPromise = (async (): Promise<IUser> => {
			if (semaphore.value.fetching) {
				throw new AuthException('Already fetching profile.');
			}

			semaphore.value.fetching = true;

			try {
				const { data: responseData, error } = await backend.client.GET(`/${AUTH_MODULE_PREFIX}/auth/profile`);

				if (typeof responseData !== 'undefined') {
					profile.value = transformUserResponse(responseData.data);

					return profile.value;
				}

				let errorReason: string | null = 'Failed to get profile.';

				if (error) {
					errorReason = getErrorReason<AuthModuleGetProfileOperation>(error, errorReason);
				}

				throw new AuthException(errorReason);
			} finally {
				semaphore.value.fetching = false;
			}
		})();

		pendingGetPromise = getPromise;

		try {
			return await getPromise;
		} finally {
			pendingGetPromise = undefined;
		}
	};

	const create = async (payload: ISessionCreateActionPayload): Promise<IUser> => {
		if (semaphore.value.creating) {
			throw new AuthException('Already creating session.');
		}

		semaphore.value.creating = true;

		try {
			const { data: responseData, error } = await backend.client.POST(`/${AUTH_MODULE_PREFIX}/auth/login`, {
				body: {
					data: {
						username: payload.data.username,
						password: payload.data.password,
					},
				},
			});

			if (typeof responseData !== 'undefined') {
				tokenPair.value = transformTokenPairResponse(responseData.data);

				writeCookie(ACCESS_TOKEN_COOKIE_NAME, responseData.data.access_token);

				writeCookie(REFRESH_TOKEN_COOKIE_NAME, responseData.data.refresh_token);

				return await get();
			}

			let errorReason: string | null = 'Failed to create user session.';

			if (error) {
				errorReason = getErrorReason<AuthModuleRegisterOperation>(error, errorReason);
			}

			throw new AuthException(errorReason);
		} finally {
			semaphore.value.creating = false;
		}
	};

	const edit = async (payload: ISessionEditActionPayload): Promise<boolean> => {
		// TODO: Handle edit
		logger.log(JSON.stringify(payload));
		return true;
	};

	const register = async (payload: ISessionRegisterActionPayload): Promise<boolean> => {
		// TODO: Handle registration
		logger.log(JSON.stringify(payload));
		return true;
	};

	const refresh = async (): Promise<boolean> => {
		if (typeof pendingRefreshPromise !== 'undefined') {
			return pendingRefreshPromise;
		}

		const refreshPromise = (async (): Promise<boolean> => {
			if (semaphore.value.updating) {
				return false;
			}

			deleteCookie(ACCESS_TOKEN_COOKIE_NAME);

			const refreshToken = readCookie(REFRESH_TOKEN_COOKIE_NAME);

			if (refreshToken === null) {
				deleteCookie(REFRESH_TOKEN_COOKIE_NAME);

				return false;
			}

			semaphore.value.updating = true;

			try {
				const { data: responseData } = await backend.client.POST(`/${AUTH_MODULE_PREFIX}/auth/refresh`, {
					body: {
						data: {
							token: refreshToken,
						},
					},
				});

				if (typeof responseData !== 'undefined') {
					tokenPair.value = transformTokenPairResponse(responseData.data);

					writeCookie(ACCESS_TOKEN_COOKIE_NAME, responseData.data.access_token);

					writeCookie(REFRESH_TOKEN_COOKIE_NAME, responseData.data.refresh_token);

					return true;
				}

				deleteCookie(REFRESH_TOKEN_COOKIE_NAME);

				return false;
			} finally {
				semaphore.value.updating = false;
			}
		})();

		pendingRefreshPromise = refreshPromise;

		try {
			return await refreshPromise;
		} finally {
			pendingRefreshPromise = undefined;
		}
	};

	const readCookie = (name: string): string | null => {
		if (cookies.get(name) !== null && typeof cookies.get(name) !== 'undefined' && cookies.get(name) !== '') {
			return cookies.get(name);
		}

		return null;
	};

	const writeCookie = (name: string, value: string): void => {
		const decodedValue = jwtDecode<ITokenPayload>(value);

		cookies.set(name, value, new Date(decodedValue.exp * 1000).toUTCString(), '/');
	};

	const deleteCookie = (name: string): void => {
		cookies.remove(name);
	};

	return {
		semaphore,
		tokenPair,
		profile,
		accessToken,
		refreshToken,
		isSignedIn,
		isExpired,
		initialize,
		clear,
		get,
		create,
		edit,
		register,
		refresh,
	};
});

export const registerSessionStore = (pinia: Pinia): SessionStore => {
	return useSession(pinia);
};
