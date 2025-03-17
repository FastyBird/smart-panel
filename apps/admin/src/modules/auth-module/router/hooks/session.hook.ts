import { type RouteLocation } from 'vue-router';

import { jwtDecode } from 'jwt-decode';

import * as Sentry from '@sentry/vue';

import type { IStoresManager } from '../../../../common';
import { type ITokenPayload, sessionStoreKey } from '../../store';

const sessionHook = async (storesManager: IStoresManager): Promise<boolean | RouteLocation | undefined> => {
	const sessionStore = storesManager.getStore(sessionStoreKey);

	await sessionStore.initialize();

	// ///////////////////////////////
	// Both tokens cookies are present
	// ///////////////////////////////
	if (sessionStore.accessToken() && sessionStore.refreshToken()) {
		const decodedAccessToken = jwtDecode<ITokenPayload>(sessionStore.accessToken()!);
		const decodedRefreshToken = jwtDecode<ITokenPayload>(sessionStore.refreshToken()!);

		// Check if refresh token is expired
		if (new Date().getTime() / 1000 >= new Date(decodedRefreshToken.exp * 1000).getTime() / 1000) {
			sessionStore.clear();

			console.log('ROUTE GUARD: Refresh token is expired');

			return;
		}

		// Check if access token is expired
		if (new Date().getTime() / 1000 >= new Date(decodedAccessToken.exp * 1000).getTime() / 1000) {
			// ///////////////////////////////
			// Perform session refresh process
			// ///////////////////////////////
			try {
				if (!(await sessionStore.refresh())) {
					// Session refreshing failed
					sessionStore.clear();

					console.log('ROUTE GUARD: Session refresh failed');

					return;
				}
			} catch (error: unknown) {
				// Session refreshing failed
				sessionStore.clear();

				if (import.meta.env.PROD) {
					Sentry.captureException(error);
				} else {
					console.log('ROUTE GUARD: Session refresh failed with unknown error');
				}

				return;
			}
		}

		if (sessionStore.profile === null) {
			// ///////////////////////////////////////
			// Session profile is not loaded in store
			// Try to load session profile from server
			// ///////////////////////////////////////
			try {
				if (!(await sessionStore.get())) {
					// Fetching profile failed
					sessionStore.clear();

					console.log('ROUTE GUARD: User fetch failed');

					return;
				}
			} catch (error: unknown) {
				// Fetching user failed
				sessionStore.clear();

				if (import.meta.env.PROD) {
					Sentry.captureException(error);
				} else {
					console.log('ROUTE GUARD: User fetch failed with unknown error');
				}
			}
		}

		// /////////////////////////////////////////
		// Try to refresh session with refresh token
		// /////////////////////////////////////////
	} else if (sessionStore.refreshToken() !== null) {
		try {
			if (!(await sessionStore.refresh())) {
				// Session refreshing failed
				sessionStore.clear();

				console.log('ROUTE GUARD: Session refresh failed');

				return;
			}
		} catch (error: unknown) {
			// Session refreshing failed
			sessionStore.clear();

			if (import.meta.env.PROD) {
				Sentry.captureException(error);
			} else {
				console.log('ROUTE GUARD: Session refresh failed with unknown error');
			}
		}

		// ///////////////////////////////////////////////////////////////////////
		// Both tokens are missing, we could not continue with authenticated user
		// ///////////////////////////////////////////////////////////////////////
	} else {
		sessionStore.clear();
	}
};

export default sessionHook;
