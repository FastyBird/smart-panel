import { ref } from 'vue';

import { type Pinia, type Store, defineStore } from 'pinia';

import { PLUGINS_PREFIX } from '../../../app.constants';
import { getErrorCode, getErrorReason, useBackend, useLogger } from '../../../common';
import { EventType } from '../../../modules/remote-access';
import type {
	RemoteAccessCloudflareTunnelPluginCreateInstallOperation,
	RemoteAccessCloudflareTunnelPluginCreateResetOperation,
	RemoteAccessCloudflareTunnelPluginGetStatusOperation,
} from '../../../openapi.constants';
import { REMOTE_ACCESS_CLOUDFLARE_TUNNEL_PLUGIN_PREFIX } from '../remote-access-cloudflare-tunnel.constants';
import { RemoteAccessCloudflareTunnelApiException } from '../remote-access-cloudflare-tunnel.exceptions';

import type {
	CloudflareTunnelStatusStoreSetup,
	ICloudflareTunnelInstallResult,
	ICloudflareTunnelSetupProgress,
	ICloudflareTunnelStatus,
	ICloudflareTunnelStatusOnEventActionPayload,
	ICloudflareTunnelStatusStateSemaphore,
	ICloudflareTunnelStatusStoreActions,
	ICloudflareTunnelStatusStoreState,
} from './cloudflare-tunnel-status.store.types';
import {
	applyCloudflareTunnelProviderStatusEvent,
	transformCloudflareTunnelInstallResponse,
	transformCloudflareTunnelSetupProgressEvent,
	transformCloudflareTunnelStatusResponse,
} from './cloudflare-tunnel-status.transformers';

const CLOUDFLARE_TUNNEL_STATUS_PATH = `/${PLUGINS_PREFIX}/${REMOTE_ACCESS_CLOUDFLARE_TUNNEL_PLUGIN_PREFIX}/status` as const;
const CLOUDFLARE_TUNNEL_INSTALL_PATH = `/${PLUGINS_PREFIX}/${REMOTE_ACCESS_CLOUDFLARE_TUNNEL_PLUGIN_PREFIX}/install` as const;
const CLOUDFLARE_TUNNEL_RESET_PATH = `/${PLUGINS_PREFIX}/${REMOTE_ACCESS_CLOUDFLARE_TUNNEL_PLUGIN_PREFIX}/reset` as const;

// A factory, not a shared constant - see the identical note on `createDefaultSemaphore` in the
// Tailscale plugin's own status store.
const createDefaultSemaphore = (): ICloudflareTunnelStatusStateSemaphore => ({
	getting: false,
	installing: false,
	resetting: false,
});

export const useCloudflareTunnelStatusStore = defineStore<'remote_access_cloudflare_tunnel_plugin-status', CloudflareTunnelStatusStoreSetup>(
	'remote_access_cloudflare_tunnel_plugin-status',
	(): CloudflareTunnelStatusStoreSetup => {
		const backend = useBackend();
		const logger = useLogger();

		const semaphore = ref<ICloudflareTunnelStatusStateSemaphore>(createDefaultSemaphore());

		const firstLoad = ref<boolean>(false);

		const data = ref<ICloudflareTunnelStatus | null>(null);

		const setupProgress = ref<ICloudflareTunnelSetupProgress | null>(null);

		const firstLoadFinished = (): boolean => firstLoad.value;

		const isLoaded = (): boolean => data.value !== null;

		let pendingGetPromise: Promise<ICloudflareTunnelStatus> | null = null;

		const get = async (): Promise<ICloudflareTunnelStatus> => {
			if (pendingGetPromise) {
				return pendingGetPromise;
			}

			const fetchPromise = (async (): Promise<ICloudflareTunnelStatus> => {
				semaphore.value.getting = true;

				try {
					const { data: responseData, error, response } = await backend.client.GET(CLOUDFLARE_TUNNEL_STATUS_PATH);

					if (typeof responseData !== 'undefined') {
						data.value = transformCloudflareTunnelStatusResponse(responseData.data);
						firstLoad.value = true;

						return data.value;
					}

					// `get-remote-access-cloudflare-tunnel-plugin-status` documents only a `200`
					// response, so openapi-fetch's generated error union has no inhabitable member and
					// TypeScript narrows `response` itself to `never` here - captured with an explicit
					// type first, same as the Tailscale plugin's own status store. `response` is always
					// a real `Response` at runtime regardless of which branch openapi-fetch took.
					const httpResponse: Response = response;

					throw new RemoteAccessCloudflareTunnelApiException(
						getErrorReason<RemoteAccessCloudflareTunnelPluginGetStatusOperation>(error, 'Failed to load the Cloudflare Tunnel status.'),
						httpResponse.status,
						null,
						getErrorCode<RemoteAccessCloudflareTunnelPluginGetStatusOperation>(error)
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

		const install = async (): Promise<ICloudflareTunnelInstallResult> => {
			semaphore.value.installing = true;

			try {
				const { data: responseData, error, response } = await backend.client.POST(CLOUDFLARE_TUNNEL_INSTALL_PATH);

				if (typeof responseData !== 'undefined') {
					return transformCloudflareTunnelInstallResponse(responseData.data);
				}

				// Same `never`-narrowing note as `get()` above.
				const httpResponse: Response = response;

				throw new RemoteAccessCloudflareTunnelApiException(
					getErrorReason<RemoteAccessCloudflareTunnelPluginCreateInstallOperation>(error, 'Failed to start the Cloudflare Tunnel setup job.'),
					httpResponse.status,
					null,
					getErrorCode<RemoteAccessCloudflareTunnelPluginCreateInstallOperation>(error)
				);
			} finally {
				semaphore.value.installing = false;
			}
		};

		const reset = async (): Promise<ICloudflareTunnelStatus> => {
			semaphore.value.resetting = true;

			try {
				const { data: responseData, error, response } = await backend.client.POST(CLOUDFLARE_TUNNEL_RESET_PATH);

				if (typeof responseData !== 'undefined') {
					data.value = transformCloudflareTunnelStatusResponse(responseData.data);

					return data.value;
				}

				// Same `never`-narrowing note as `get()` above.
				const httpResponse: Response = response;

				throw new RemoteAccessCloudflareTunnelApiException(
					getErrorReason<RemoteAccessCloudflareTunnelPluginCreateResetOperation>(error, 'Failed to remove the Cloudflare Tunnel.'),
					httpResponse.status,
					null,
					getErrorCode<RemoteAccessCloudflareTunnelPluginCreateResetOperation>(error)
				);
			} finally {
				semaphore.value.resetting = false;
			}
		};

		// `RemoteAccessModule.Provider.Status` updates the loaded snapshot in place, same as the
		// remote-access module's own store; `RemoteAccessModule.Setup.Progress` always updates
		// regardless of whether a status has been fetched yet, since a progress tick can arrive
		// while the very first `GET /status` this page ever makes is still in flight.
		const onEvent = (payload: ICloudflareTunnelStatusOnEventActionPayload): void => {
			switch (payload.event) {
				case EventType.PROVIDER_STATUS:
					if (data.value === null) {
						logger.warn('Received a Cloudflare Tunnel provider status event before the initial status fetch; ignoring.');

						return;
					}

					data.value = applyCloudflareTunnelProviderStatusEvent(data.value, payload.data);

					return;

				case EventType.SETUP_PROGRESS:
					setupProgress.value = transformCloudflareTunnelSetupProgressEvent(payload.data);

					return;

				default:
					logger.warn(`Unhandled Cloudflare Tunnel plugin event: ${payload.event}`);
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
			reset,
			onEvent,
			refresh,
		};
	}
);

export const registerCloudflareTunnelStatusStore = (
	pinia: Pinia
): Store<string, ICloudflareTunnelStatusStoreState, object, ICloudflareTunnelStatusStoreActions> => {
	return useCloudflareTunnelStatusStore(pinia);
};
