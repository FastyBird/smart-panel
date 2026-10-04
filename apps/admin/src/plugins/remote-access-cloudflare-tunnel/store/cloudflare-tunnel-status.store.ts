import { ref } from 'vue';

import { type Pinia, type Store, defineStore } from 'pinia';

import { PLUGINS_PREFIX } from '../../../app.constants';
import { getErrorCode, getErrorReason, snakeToCamel, useBackend, useLogger } from '../../../common';
import { EventType, RemoteAccessProviderStatusEventSchema } from '../../../modules/remote-access';
import { createSnapshotOrder } from '../../../modules/remote-access/store/snapshot-order';
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

		const isLoaded = (): boolean => data.value !== null || semaphore.value.getting || order.hasBuffered();

		let pendingGetPromise: Promise<ICloudflareTunnelStatus> | null = null;
		const order = createSnapshotOrder();
		let getController: AbortController | null = null;
		let resynchronizing = false;
		const acceptStatus = (status: ICloudflareTunnelStatus, ticket = order.request()): ICloudflareTunnelStatus => {
			if (order.establish(status, ticket)) {
				if (order.accept(status, 'provider', ticket)) data.value = status;
				for (const [, event] of order.drain(ticket)) {
					if (data.value && order.accept(event, 'provider')) data.value = applyCloudflareTunnelProviderStatusEvent(data.value, event);
				}
			}
			if (data.value === null) throw new Error('Remote access snapshot superseded before initial load.');
			return data.value;
		};

		const get = async (force = false): Promise<ICloudflareTunnelStatus> => {
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
			getController = controller;
			const fetchPromise = (async (): Promise<ICloudflareTunnelStatus> => {
				semaphore.value.getting = true;

				try {
					const { data: responseData, error, response } = await backend.client.GET(CLOUDFLARE_TUNNEL_STATUS_PATH, { signal: controller.signal });

					if (typeof responseData !== 'undefined') {
						const accepted = acceptStatus(transformCloudflareTunnelStatusResponse(responseData.data), ticket);
						firstLoad.value = true;
						if (order.hasBuffered() && !resynchronizing) return get(true);

						return accepted;
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
				} catch (error: unknown) {
					if (!order.currentRequest(ticket)) {
						if (pendingGetPromise) return pendingGetPromise;
						if (data.value) return data.value;
					}
					throw error;
				} finally {
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
			const ticket = order.request();
			semaphore.value.resetting = true;

			try {
				const { data: responseData, error, response } = await backend.client.POST(CLOUDFLARE_TUNNEL_RESET_PATH);

				if (typeof responseData !== 'undefined') {
					return acceptStatus(transformCloudflareTunnelStatusResponse(responseData.data), ticket);
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
				case EventType.PROVIDER_STATUS: {
					if (typeof payload.data.type !== 'string') return;
					const expectedType = data.value?.type ?? 'remote-access-cloudflare-tunnel-plugin';
					if (payload.data.type !== expectedType) return;
					const parsed = RemoteAccessProviderStatusEventSchema.safeParse(snakeToCamel(payload.data));
					if (!parsed.success) {
						if (data.value !== null) applyCloudflareTunnelProviderStatusEvent(data.value, payload.data);
						return;
					}
					const decision = order.event(parsed.data, 'provider', parsed.data);
					if (decision === 'buffer') {
						if (data.value !== null && !resynchronizing)
							void get(true).catch((error: unknown) => logger.error('Failed to resynchronize remote access status.', error));
						return;
					}
					if (decision === 'accept' && data.value !== null) data.value = applyCloudflareTunnelProviderStatusEvent(data.value, parsed.data);
					return;
				}

				case EventType.SETUP_PROGRESS:
					setupProgress.value = transformCloudflareTunnelSetupProgressEvent(payload.data);

					return;

				default:
					logger.warn(`Unhandled Cloudflare Tunnel plugin event: ${payload.event}`);
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
