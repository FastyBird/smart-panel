import type { Middleware } from 'openapi-fetch';

import { MODULES_PREFIX } from '../../app.constants';

import { AUTH_MODULE_PREFIX } from './auth.constants';
import type { SessionStore } from './store/session.store.types';

const REFRESH_PATH = `/${MODULES_PREFIX}/${AUTH_MODULE_PREFIX}/auth/refresh`;

export const createSessionMiddleware = (sessionStore: SessionStore): Middleware => ({
	async onRequest({ request, schemaPath }) {
		// Refresh authenticates with its body token. Re-entering refresh here can clear
		// the loaded profile while the original refresh is still completing.
		if (schemaPath === REFRESH_PATH) {
			return request;
		}

		if (sessionStore.tokenPair !== null && sessionStore.isExpired()) {
			if (!(await sessionStore.refresh())) {
				sessionStore.clear();
			}
		}

		if (sessionStore.tokenPair !== null) {
			request.headers.set('Authorization', `Bearer ${sessionStore.tokenPair.accessToken}`);
		}

		return request;
	},
	async onResponse({ request, response, schemaPath }) {
		// Let the refresh caller handle rejection; retrying it can await its own promise.
		if (schemaPath === REFRESH_PATH || response.status !== 401) {
			return;
		}

		const headers = request.headers instanceof Headers ? request.headers : new Headers(request.headers as Record<string, string>);

		if (headers.get('X-Retried') !== null) {
			return;
		}

		if (sessionStore.tokenPair && sessionStore.isExpired()) {
			if (!(await sessionStore.refresh())) {
				sessionStore.clear();
			}
		} else if ((headers.get('Authorization') || '').startsWith('Bearer')) {
			return;
		}

		if (sessionStore.tokenPair === null) {
			return;
		}

		const retryHeaders = new Headers(headers);

		retryHeaders.set('X-Retried', '1');
		retryHeaders.set('Authorization', `Bearer ${sessionStore.tokenPair.accessToken}`);

		const retryReq = new Request(request, { headers: retryHeaders });

		return fetch(retryReq);
	},
});
