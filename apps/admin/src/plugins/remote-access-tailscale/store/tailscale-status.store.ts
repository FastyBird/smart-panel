import { ref } from 'vue';

import { type Pinia, type Store, defineStore } from 'pinia';

import { PLUGINS_PREFIX } from '../../../app.constants';
import { getErrorCode, getErrorReason, snakeToCamel, useBackend, useLogger } from '../../../common';
import { EventType, RemoteAccessProviderStatusEventSchema } from '../../../modules/remote-access';
import { createSnapshotOrder } from '../../../modules/remote-access/store/snapshot-order';
import type {
	RemoteAccessTailscalePluginCreateConnectOperation,
	RemoteAccessTailscalePluginCreateDisconnectOperation,
	RemoteAccessTailscalePluginCreateInstallOperation,
	RemoteAccessTailscalePluginCreateLoginOperation,
	RemoteAccessTailscalePluginCreateLogoutOperation,
	RemoteAccessTailscalePluginCreateResetPreferencesOperation,
	RemoteAccessTailscalePluginGetStatusOperation,
} from '../../../openapi.constants';
import { REMOTE_ACCESS_TAILSCALE_PLUGIN_PREFIX } from '../remote-access-tailscale.constants';
import { RemoteAccessTailscaleApiException } from '../remote-access-tailscale.exceptions';

import { TailscaleLoginRequestSchema } from './tailscale-status.store.schemas';
import type {
	ITailscaleInstallResult,
	ITailscaleLoginResult,
	ITailscaleSetupProgress,
	ITailscaleStatus,
	ITailscaleStatusOnEventActionPayload,
	ITailscaleStatusStateSemaphore,
	ITailscaleStatusStoreActions,
	ITailscaleStatusStoreState,
	TailscaleStatusStoreSetup,
} from './tailscale-status.store.types';
import {
	applyTailscaleProviderStatusEvent,
	transformTailscaleInstallResponse,
	transformTailscaleLoginResponse,
	transformTailscaleSetupProgressEvent,
	transformTailscaleStatusResponse,
} from './tailscale-status.transformers';

const TAILSCALE_CONNECT_PATH = `/${PLUGINS_PREFIX}/${REMOTE_ACCESS_TAILSCALE_PLUGIN_PREFIX}/connect` as const;
const TAILSCALE_DISCONNECT_PATH = `/${PLUGINS_PREFIX}/${REMOTE_ACCESS_TAILSCALE_PLUGIN_PREFIX}/disconnect` as const;

const TAILSCALE_STATUS_PATH = `/${PLUGINS_PREFIX}/${REMOTE_ACCESS_TAILSCALE_PLUGIN_PREFIX}/status` as const;
const TAILSCALE_INSTALL_PATH = `/${PLUGINS_PREFIX}/${REMOTE_ACCESS_TAILSCALE_PLUGIN_PREFIX}/install` as const;
const TAILSCALE_LOGIN_PATH = `/${PLUGINS_PREFIX}/${REMOTE_ACCESS_TAILSCALE_PLUGIN_PREFIX}/login` as const;
const TAILSCALE_LOGOUT_PATH = `/${PLUGINS_PREFIX}/${REMOTE_ACCESS_TAILSCALE_PLUGIN_PREFIX}/logout` as const;
const TAILSCALE_RESET_PREFERENCES_PATH = `/${PLUGINS_PREFIX}/${REMOTE_ACCESS_TAILSCALE_PLUGIN_PREFIX}/reset-preferences` as const;

// A factory, not a shared constant - see the identical note on `createDefaultSemaphore` in the
// remote-access module's own status store.
const createDefaultSemaphore = (): ITailscaleStatusStateSemaphore => ({
	getting: false,
	connecting: false,
	disconnecting: false,
	installing: false,
	loggingIn: false,
	loggingOut: false,
	resettingPreferences: false,
});

export const useTailscaleStatusStore = defineStore<'remote_access_tailscale_plugin-status', TailscaleStatusStoreSetup>(
	'remote_access_tailscale_plugin-status',
	(): TailscaleStatusStoreSetup => {
		const backend = useBackend();
		const logger = useLogger();

		const semaphore = ref<ITailscaleStatusStateSemaphore>(createDefaultSemaphore());

		const firstLoad = ref<boolean>(false);

		const data = ref<ITailscaleStatus | null>(null);

		const setupProgress = ref<ITailscaleSetupProgress | null>(null);

		const firstLoadFinished = (): boolean => firstLoad.value;

		const isLoaded = (): boolean => data.value !== null || semaphore.value.getting || order.hasBuffered();

		let pendingGetPromise: Promise<ITailscaleStatus> | null = null;
		const order = createSnapshotOrder();
		let getController: AbortController | null = null;
		let resynchronizing = false;
		const acceptStatus = (status: ITailscaleStatus, ticket = order.request()): ITailscaleStatus => {
			if (order.establish(status, ticket)) {
				if (order.accept(status, 'provider', ticket)) data.value = status;
				for (const [, event] of order.drain(ticket)) {
					if (data.value && order.accept(event, 'provider')) data.value = applyTailscaleProviderStatusEvent(data.value, event);
				}
			}
			if (data.value === null) throw new Error('Remote access snapshot superseded before initial load.');
			return data.value;
		};

		const get = async (force = false): Promise<ITailscaleStatus> => {
			if (force) {
				resynchronizing = true;
				order.resync();
				getController?.abort();
				pendingGetPromise = null;
			}
			if (pendingGetPromise) {
				return pendingGetPromise;
			}

			const ticket = order.request();
			const controller = new AbortController();
			const deadline = setTimeout(() => controller.abort(), 10_000);
			getController = controller;
			const fetchPromise = (async (): Promise<ITailscaleStatus> => {
				semaphore.value.getting = true;

				try {
					const { data: responseData, error, response } = await backend.client.GET(TAILSCALE_STATUS_PATH, { signal: controller.signal });

					if (typeof responseData !== 'undefined') {
						const accepted = acceptStatus(transformTailscaleStatusResponse(responseData.data), ticket);
						firstLoad.value = true;
						if (order.hasBuffered() && !resynchronizing) return get(true);

						return accepted;
					}

					// `get-remote-access-tailscale-plugin-status` documents only a `200` response, so
					// openapi-fetch's generated error union has no inhabitable member and TypeScript
					// narrows `response` itself to `never` here - captured with an explicit type first,
					// same as the remote-access module's own status store. `response` is always a real
					// `Response` at runtime regardless of which branch openapi-fetch took.
					const httpResponse: Response = response;

					throw new RemoteAccessTailscaleApiException(
						getErrorReason<RemoteAccessTailscalePluginGetStatusOperation>(error, 'Failed to load the Tailscale status.'),
						httpResponse.status,
						null,
						getErrorCode<RemoteAccessTailscalePluginGetStatusOperation>(error)
					);
				} catch (error: unknown) {
					if (!order.currentRequest(ticket)) {
						if (pendingGetPromise) return pendingGetPromise;
						if (data.value) return data.value;
					}
					throw error;
				} finally {
					clearTimeout(deadline);
					if (order.currentRequest(ticket)) {
						semaphore.value.getting = false;
						resynchronizing = false;
					}
				}
			})();

			pendingGetPromise = fetchPromise;

			try {
				return await fetchPromise;
			} finally {
				if (pendingGetPromise === fetchPromise) pendingGetPromise = null;
			}
		};

		const install = async (): Promise<ITailscaleInstallResult> => {
			semaphore.value.installing = true;
			setupProgress.value = null;
			const controller = new AbortController();
			const deadline = setTimeout(() => controller.abort(), 15_000);

			try {
				const { data: responseData, error, response } = await backend.client.POST(TAILSCALE_INSTALL_PATH, { signal: controller.signal });

				if (typeof responseData !== 'undefined') {
					return transformTailscaleInstallResponse(responseData.data);
				}

				// Same `never`-narrowing note as `get()` above.
				const httpResponse: Response = response;

				throw new RemoteAccessTailscaleApiException(
					getErrorReason<RemoteAccessTailscalePluginCreateInstallOperation>(error, 'Failed to start the Tailscale setup job.'),
					httpResponse.status,
					null,
					getErrorCode<RemoteAccessTailscalePluginCreateInstallOperation>(error)
				);
			} finally {
				clearTimeout(deadline);
				semaphore.value.installing = false;
			}
		};

		const login = async (authKey?: string): Promise<ITailscaleLoginResult> => {
			const ticket = order.request();
			const sequence = order.action();
			semaphore.value.loggingIn = true;
			const controller = new AbortController();
			const deadline = setTimeout(() => controller.abort(), authKey ? 150_000 : 45_000);

			try {
				// `authKey` is forwarded straight into the request body and never assigned to a ref or
				// store field - see `TailscaleLoginRequestSchema`.
				const body = TailscaleLoginRequestSchema.parse(typeof authKey === 'undefined' ? {} : { auth_key: authKey });

				const { data: responseData, error, response } = await backend.client.POST(TAILSCALE_LOGIN_PATH, { body, signal: controller.signal });

				if (typeof responseData !== 'undefined') {
					const result = transformTailscaleLoginResponse(responseData.data);

					// The login result never carries endpoints/details/requirements - merge only what it
					// does carry into an already-loaded status; a caller that needs the rest calls `get()`.
					if (data.value !== null && data.value.epoch === undefined && order.actionCurrent(sequence, ticket)) {
						data.value = {
							...data.value,
							state: result.state,
							authUrl: result.authUrl,
							qr: result.qr,
						};
					}

					if (data.value?.epoch !== undefined && order.actionCurrent(sequence, ticket)) {
						try {
							await get(true);
						} catch (error: unknown) {
							logger.error('Failed to resynchronize remote access status after sign-in.', error);
						}
					}
					return result;
				}

				// Same `never`-narrowing note as `get()` above.
				const httpResponse: Response = response;

				throw new RemoteAccessTailscaleApiException(
					getErrorReason<RemoteAccessTailscalePluginCreateLoginOperation>(error, 'Failed to sign in to Tailscale.'),
					httpResponse.status,
					null,
					getErrorCode<RemoteAccessTailscalePluginCreateLoginOperation>(error)
				);
			} finally {
				clearTimeout(deadline);
				semaphore.value.loggingIn = false;
			}
		};

		const runConnectionAction = async (action: 'connect' | 'disconnect'): Promise<ITailscaleStatus> => {
			const flag = action === 'connect' ? 'connecting' : 'disconnecting';
			if (semaphore.value[flag]) {
				throw new RemoteAccessTailscaleApiException('A Tailscale operation is already in progress.', 409, null, 'operation-in-progress');
			}
			const ticket = order.request();
			semaphore.value[flag] = true;
			const controller = new AbortController();
			const deadline = setTimeout(() => controller.abort(), 45_000);
			try {
				const {
					data: responseData,
					error,
					response,
				} = await backend.client.POST(action === 'connect' ? TAILSCALE_CONNECT_PATH : TAILSCALE_DISCONNECT_PATH, { signal: controller.signal });
				if (typeof responseData !== 'undefined') {
					return acceptStatus(transformTailscaleStatusResponse(responseData.data), ticket);
				}
				const httpResponse: Response = response;
				throw new RemoteAccessTailscaleApiException(
					getErrorReason<RemoteAccessTailscalePluginCreateConnectOperation | RemoteAccessTailscalePluginCreateDisconnectOperation>(
						error,
						`Failed to ${action} Tailscale.`
					),
					httpResponse.status,
					null,
					getErrorCode<RemoteAccessTailscalePluginCreateConnectOperation | RemoteAccessTailscalePluginCreateDisconnectOperation>(error)
				);
			} finally {
				clearTimeout(deadline);
				semaphore.value[flag] = false;
			}
		};

		const connect = (): Promise<ITailscaleStatus> => runConnectionAction('connect');
		const disconnect = (): Promise<ITailscaleStatus> => runConnectionAction('disconnect');

		const logout = async (): Promise<ITailscaleStatus> => {
			const ticket = order.request();
			semaphore.value.loggingOut = true;
			const controller = new AbortController();
			const deadline = setTimeout(() => controller.abort(), 45_000);

			try {
				const { data: responseData, error, response } = await backend.client.POST(TAILSCALE_LOGOUT_PATH, { signal: controller.signal });

				if (typeof responseData !== 'undefined') {
					return acceptStatus(transformTailscaleStatusResponse(responseData.data), ticket);
				}

				// Same `never`-narrowing note as `get()` above.
				const httpResponse: Response = response;

				throw new RemoteAccessTailscaleApiException(
					getErrorReason<RemoteAccessTailscalePluginCreateLogoutOperation>(error, 'Failed to sign out of Tailscale.'),
					httpResponse.status,
					null,
					getErrorCode<RemoteAccessTailscalePluginCreateLogoutOperation>(error)
				);
			} finally {
				clearTimeout(deadline);
				semaphore.value.loggingOut = false;
			}
		};

		const resetPreferences = async (): Promise<ITailscaleStatus> => {
			const ticket = order.request();
			semaphore.value.resettingPreferences = true;
			const controller = new AbortController();
			const deadline = setTimeout(() => controller.abort(), 45_000);

			try {
				const { data: responseData, error, response } = await backend.client.POST(TAILSCALE_RESET_PREFERENCES_PATH, { signal: controller.signal });

				if (typeof responseData !== 'undefined') {
					return acceptStatus(transformTailscaleStatusResponse(responseData.data), ticket);
				}

				// Same `never`-narrowing note as `get()` above.
				const httpResponse: Response = response;

				throw new RemoteAccessTailscaleApiException(
					getErrorReason<RemoteAccessTailscalePluginCreateResetPreferencesOperation>(error, 'Failed to reset Tailscale preferences.'),
					httpResponse.status,
					null,
					getErrorCode<RemoteAccessTailscalePluginCreateResetPreferencesOperation>(error)
				);
			} finally {
				clearTimeout(deadline);
				semaphore.value.resettingPreferences = false;
			}
		};

		// `RemoteAccessModule.Provider.Status` updates the loaded snapshot in place, same as the
		// remote-access module's own store; `RemoteAccessModule.Setup.Progress` always updates
		// regardless of whether a status has been fetched yet, since a progress tick can arrive
		// while the very first `GET /status` this page ever makes is still in flight.
		const onEvent = (payload: ITailscaleStatusOnEventActionPayload): void => {
			switch (payload.event) {
				case EventType.PROVIDER_STATUS: {
					if (typeof payload.data.type !== 'string') return;
					const expectedType = data.value?.type ?? 'remote-access-tailscale-plugin';
					if (payload.data.type !== expectedType) return;
					const parsed = RemoteAccessProviderStatusEventSchema.safeParse(snakeToCamel(payload.data));
					if (!parsed.success) {
						if (data.value !== null) applyTailscaleProviderStatusEvent(data.value, payload.data);
						return;
					}
					const decision = order.event(parsed.data, 'provider', parsed.data);
					if (decision === 'buffer') {
						if (data.value !== null && !resynchronizing)
							void get(true).catch((error: unknown) => logger.error('Failed to resynchronize remote access status.', error));
						return;
					}
					if (decision === 'accept' && data.value !== null) data.value = applyTailscaleProviderStatusEvent(data.value, parsed.data);
					return;
				}

				case EventType.SETUP_PROGRESS:
					setupProgress.value = transformTailscaleSetupProgressEvent(payload.data);

					return;

				default:
					logger.warn(`Unhandled Tailscale plugin event: ${payload.event}`);
			}
		};

		const refresh = (): Promise<unknown> => get(true);

		return {
			data,
			setupProgress,
			semaphore,
			firstLoad,
			firstLoadFinished,
			isLoaded,
			get,
			install,
			login,
			connect,
			disconnect,
			logout,
			resetPreferences,
			onEvent,
			refresh,
		};
	}
);

export const registerTailscaleStatusStore = (pinia: Pinia): Store<string, ITailscaleStatusStoreState, object, ITailscaleStatusStoreActions> => {
	return useTailscaleStatusStore(pinia);
};
