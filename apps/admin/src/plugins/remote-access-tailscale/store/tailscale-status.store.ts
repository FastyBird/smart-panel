import { ref } from 'vue';

import { type Pinia, type Store, defineStore } from 'pinia';

import { PLUGINS_PREFIX } from '../../../app.constants';
import { getErrorReason, useBackend, useLogger } from '../../../common';
import { EventType } from '../../../modules/remote-access';
import type {
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

const TAILSCALE_STATUS_PATH = `/${PLUGINS_PREFIX}/${REMOTE_ACCESS_TAILSCALE_PLUGIN_PREFIX}/status` as const;
const TAILSCALE_INSTALL_PATH = `/${PLUGINS_PREFIX}/${REMOTE_ACCESS_TAILSCALE_PLUGIN_PREFIX}/install` as const;
const TAILSCALE_LOGIN_PATH = `/${PLUGINS_PREFIX}/${REMOTE_ACCESS_TAILSCALE_PLUGIN_PREFIX}/login` as const;
const TAILSCALE_LOGOUT_PATH = `/${PLUGINS_PREFIX}/${REMOTE_ACCESS_TAILSCALE_PLUGIN_PREFIX}/logout` as const;
const TAILSCALE_RESET_PREFERENCES_PATH = `/${PLUGINS_PREFIX}/${REMOTE_ACCESS_TAILSCALE_PLUGIN_PREFIX}/reset-preferences` as const;

// A factory, not a shared constant - see the identical note on `createDefaultSemaphore` in the
// remote-access module's own status store.
const createDefaultSemaphore = (): ITailscaleStatusStateSemaphore => ({
	getting: false,
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

		const isLoaded = (): boolean => data.value !== null;

		let pendingGetPromise: Promise<ITailscaleStatus> | null = null;

		const get = async (): Promise<ITailscaleStatus> => {
			if (pendingGetPromise) {
				return pendingGetPromise;
			}

			const fetchPromise = (async (): Promise<ITailscaleStatus> => {
				semaphore.value.getting = true;

				try {
					const { data: responseData, error, response } = await backend.client.GET(TAILSCALE_STATUS_PATH);

					if (typeof responseData !== 'undefined') {
						data.value = transformTailscaleStatusResponse(responseData.data);
						firstLoad.value = true;

						return data.value;
					}

					// `get-remote-access-tailscale-plugin-status` documents only a `200` response, so
					// openapi-fetch's generated error union has no inhabitable member and TypeScript
					// narrows `response` itself to `never` here - captured with an explicit type first,
					// same as the remote-access module's own status store. `response` is always a real
					// `Response` at runtime regardless of which branch openapi-fetch took.
					const httpResponse: Response = response;

					throw new RemoteAccessTailscaleApiException(
						getErrorReason<RemoteAccessTailscalePluginGetStatusOperation>(error, 'Failed to load the Tailscale status.'),
						httpResponse.status
					);
				} finally {
					semaphore.value.getting = false;
				}
			})();

			pendingGetPromise = fetchPromise;

			try {
				return await fetchPromise;
			} finally {
				pendingGetPromise = null;
			}
		};

		const install = async (): Promise<ITailscaleInstallResult> => {
			semaphore.value.installing = true;

			try {
				const { data: responseData, error, response } = await backend.client.POST(TAILSCALE_INSTALL_PATH);

				if (typeof responseData !== 'undefined') {
					return transformTailscaleInstallResponse(responseData.data);
				}

				// Same `never`-narrowing note as `get()` above.
				const httpResponse: Response = response;

				throw new RemoteAccessTailscaleApiException(
					getErrorReason<RemoteAccessTailscalePluginCreateInstallOperation>(error, 'Failed to start the Tailscale setup job.'),
					httpResponse.status
				);
			} finally {
				semaphore.value.installing = false;
			}
		};

		const login = async (authKey?: string): Promise<ITailscaleLoginResult> => {
			semaphore.value.loggingIn = true;

			try {
				// `authKey` is forwarded straight into the request body and never assigned to a ref or
				// store field - see `TailscaleLoginRequestSchema`.
				const body = TailscaleLoginRequestSchema.parse(typeof authKey === 'undefined' ? {} : { auth_key: authKey });

				const { data: responseData, error, response } = await backend.client.POST(TAILSCALE_LOGIN_PATH, { body });

				if (typeof responseData !== 'undefined') {
					const result = transformTailscaleLoginResponse(responseData.data);

					// The login result never carries endpoints/details/requirements - merge only what it
					// does carry into an already-loaded status; a caller that needs the rest calls `get()`.
					if (data.value !== null) {
						data.value = {
							...data.value,
							state: result.state,
							authUrl: result.authUrl,
							qr: result.qr,
						};
					}

					return result;
				}

				// Same `never`-narrowing note as `get()` above.
				const httpResponse: Response = response;

				throw new RemoteAccessTailscaleApiException(
					getErrorReason<RemoteAccessTailscalePluginCreateLoginOperation>(error, 'Failed to sign in to Tailscale.'),
					httpResponse.status
				);
			} finally {
				semaphore.value.loggingIn = false;
			}
		};

		const logout = async (): Promise<ITailscaleStatus> => {
			semaphore.value.loggingOut = true;

			try {
				const { data: responseData, error, response } = await backend.client.POST(TAILSCALE_LOGOUT_PATH);

				if (typeof responseData !== 'undefined') {
					data.value = transformTailscaleStatusResponse(responseData.data);

					return data.value;
				}

				// Same `never`-narrowing note as `get()` above.
				const httpResponse: Response = response;

				throw new RemoteAccessTailscaleApiException(
					getErrorReason<RemoteAccessTailscalePluginCreateLogoutOperation>(error, 'Failed to sign out of Tailscale.'),
					httpResponse.status
				);
			} finally {
				semaphore.value.loggingOut = false;
			}
		};

		const resetPreferences = async (): Promise<ITailscaleStatus> => {
			semaphore.value.resettingPreferences = true;

			try {
				const { data: responseData, error, response } = await backend.client.POST(TAILSCALE_RESET_PREFERENCES_PATH);

				if (typeof responseData !== 'undefined') {
					data.value = transformTailscaleStatusResponse(responseData.data);

					return data.value;
				}

				// Same `never`-narrowing note as `get()` above.
				const httpResponse: Response = response;

				throw new RemoteAccessTailscaleApiException(
					getErrorReason<RemoteAccessTailscalePluginCreateResetPreferencesOperation>(error, 'Failed to reset Tailscale preferences.'),
					httpResponse.status
				);
			} finally {
				semaphore.value.resettingPreferences = false;
			}
		};

		// `RemoteAccessModule.Provider.Status` updates the loaded snapshot in place, same as the
		// remote-access module's own store; `RemoteAccessModule.Setup.Progress` always updates
		// regardless of whether a status has been fetched yet, since a progress tick can arrive
		// while the very first `GET /status` this page ever makes is still in flight.
		const onEvent = (payload: ITailscaleStatusOnEventActionPayload): void => {
			switch (payload.event) {
				case EventType.PROVIDER_STATUS:
					if (data.value === null) {
						logger.warn('Received a Tailscale provider status event before the initial status fetch; ignoring.');

						return;
					}

					data.value = applyTailscaleProviderStatusEvent(data.value, payload.data);

					return;

				case EventType.SETUP_PROGRESS:
					setupProgress.value = transformTailscaleSetupProgressEvent(payload.data);

					return;

				default:
					logger.warn(`Unhandled Tailscale plugin event: ${payload.event}`);
			}
		};

		const refresh = (): Promise<unknown> => get();

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
