import type { Middleware } from 'openapi-fetch';

import { MODULES_PREFIX } from '../../app.constants';

import { AUTH_MODULE_PREFIX } from './auth.constants';
import type { SessionStore } from './store/session.store.types';

const REFRESH_PATH = `/${MODULES_PREFIX}/${AUTH_MODULE_PREFIX}/auth/refresh`;
const SESSION_REJECTIONS = new Set([
	'Token not found',
	'Token revoked',
	'Token expired',
	'Invalid or expired token',
	'Authentication required',
	'Invalid user',
]);

// Distinguish rejection by our auth guard from a provider's unrelated 401.
const isSessionRejection = async (response: Response): Promise<boolean> => {
	if (response.status !== 401) return false;
	try {
		const body: unknown = await response.clone().json();
		return typeof body === 'object' && body !== null && 'message' in body && typeof body.message === 'string' && SESSION_REJECTIONS.has(body.message);
	} catch {
		return false;
	}
};

export const createSessionMiddleware = (sessionStore: SessionStore, onSessionExpired?: () => void): Middleware => {
	// Fetch consumes POST bodies, including catalog and draft-preview requests. Keep a replay
	// before sending so a rejected authentication can be retried with the identical body once.
	const replays = new WeakMap<Request, { request: Request; generation: number }>();
	let expirationReported = false;
	const expireSession = () => {
		sessionStore.clear();
		if (!expirationReported) {
			expirationReported = true;
			onSessionExpired?.();
		}
	};
	return {
		async onRequest({ request, schemaPath }) {
			// Refresh authenticates with its body token; it must never await itself.
			if (schemaPath === REFRESH_PATH) return request;
			const generation = sessionStore.sessionGeneration;
			if (sessionStore.tokenPair !== null && sessionStore.isExpired()) {
				if (!(await sessionStore.refresh()) && generation === sessionStore.sessionGeneration) expireSession();
			}
			if (generation !== sessionStore.sessionGeneration) return Response.json({ message: 'Authentication required' }, { status: 401 });
			if (sessionStore.tokenPair !== null) {
				request.headers.set('Authorization', `Bearer ${sessionStore.tokenPair.accessToken}`);
				replays.set(request, { request: request.clone(), generation });
			}
			return request;
		},
		async onResponse({ request, response, schemaPath }) {
			const replay = replays.get(request);
			replays.delete(request);
			if (schemaPath === REFRESH_PATH) return;
			if (response.status !== 401) {
				if (response.ok && sessionStore.tokenPair !== null) expirationReported = false;
				return;
			}
			if (!replay || replay.generation !== sessionStore.sessionGeneration || request.headers.has('X-Retried') || request.signal.aborted) return;
			const rejectedSession = await isSessionRejection(response);
			if (replay.generation !== sessionStore.sessionGeneration) return;
			const pair = sessionStore.tokenPair;
			if (pair === null) return;
			if (!rejectedSession) return;
			const currentAuthorization = `Bearer ${pair.accessToken}`;
			const tokenChanged = request.headers.get('Authorization') !== currentAuthorization;
			// A concurrent request may already have refreshed the rejected token. Use the newer
			// token rather than rotating it again and invalidating the other request's retry.
			if (!tokenChanged || sessionStore.isExpired()) {
				if (!(await sessionStore.refresh())) {
					if (replay.generation === sessionStore.sessionGeneration && sessionStore.tokenPair === pair) expireSession();
					return;
				}
			}
			if (replay.generation !== sessionStore.sessionGeneration || sessionStore.tokenPair === null || request.signal.aborted) return;
			const retryAuthorization = `Bearer ${sessionStore.tokenPair.accessToken}`;
			const headers = new Headers(request.headers);
			headers.set('X-Retried', '1');
			headers.set('Authorization', retryAuthorization);
			const retryResponse = await fetch(new Request(replay.request, { headers }));
			if (
				(await isSessionRejection(retryResponse)) &&
				replay.generation === sessionStore.sessionGeneration &&
				`Bearer ${sessionStore.tokenPair?.accessToken}` === retryAuthorization
			) {
				expireSession();
			} else if (retryResponse.ok) {
				expirationReported = false;
			}
			return retryResponse;
		},
	};
};
