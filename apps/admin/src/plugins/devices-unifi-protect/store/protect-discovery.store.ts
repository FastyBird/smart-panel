import { ref } from 'vue';

import { type Pinia, defineStore } from 'pinia';

import { PLUGINS_PREFIX } from '../../../app.constants';
import { getErrorReason, useBackend } from '../../../common';
import type {
	DevicesUnifiProtectPluginGetDiscoveryOperation,
	DevicesUnifiProtectPluginProbeDiscoveryOperation,
	DevicesUnifiProtectPluginScanDiscoveryOperation,
} from '../../../openapi.constants';
import {
	DEVICES_UNIFI_PROTECT_PLUGIN_PREFIX,
	PROTECT_DEFAULT_PORT,
	PROTECT_DISCOVERY_SCAN_DEADLINE_MS,
	PROTECT_PROBE_DEADLINE_MS,
	PROTECT_STATUS_DEADLINE_MS,
} from '../devices-unifi-protect.constants';
import { ProtectApiException, ProtectTimeoutException } from '../devices-unifi-protect.exceptions';

import { startProtectDeadline } from './protect.deadline';
import { transformProtectDiscovery, transformProtectProbe } from './protect.transformers';
import type { IProtectDiscovery, IProtectProbe, IProtectProbeInput } from './protect.types';

const BASE = `/${PLUGINS_PREFIX}/${DEVICES_UNIFI_PROTECT_PLUGIN_PREFIX}/discovery`;

export const protectProbeKey = (host: string, port: number): string => `${host}:${port}`;

export const useProtectDiscovery = defineStore('devices_unifi_protect_plugin-discovery', () => {
	const backend = useBackend();

	const discovery = ref<IProtectDiscovery | null>(null);
	/** Probe results by `host:port`. */
	const probes = ref<Record<string, IProtectProbe>>({});
	const scanning = ref(false);
	const probing = ref(false);

	const fetch = async (): Promise<IProtectDiscovery> => {
		const deadline = startProtectDeadline(PROTECT_STATUS_DEADLINE_MS);

		try {
			const { data, error, response } = await backend.client.GET(BASE, { signal: deadline.signal });

			if (data) {
				return (discovery.value = transformProtectDiscovery(data.data));
			}

			throw new ProtectApiException(
				getErrorReason<DevicesUnifiProtectPluginGetDiscoveryOperation>(error, 'Failed to load UniFi Protect discovery.'),
				response?.status
			);
		} catch (error) {
			if (deadline.expired()) {
				throw new ProtectTimeoutException('UniFi Protect discovery did not answer in time.');
			}

			throw error;
		} finally {
			deadline.clear();
		}
	};

	let pendingScan: Promise<IProtectDiscovery> | null = null;

	const runScan = async (): Promise<IProtectDiscovery> => {
		const deadline = startProtectDeadline(PROTECT_DISCOVERY_SCAN_DEADLINE_MS);

		try {
			const { data, error, response } = await backend.client.POST(`${BASE}/scan`, { signal: deadline.signal });

			if (data) {
				return (discovery.value = transformProtectDiscovery(data.data));
			}

			throw new ProtectApiException(
				getErrorReason<DevicesUnifiProtectPluginScanDiscoveryOperation>(error, 'Failed to scan for UniFi Protect consoles.'),
				response?.status
			);
		} catch (error) {
			if (deadline.expired()) {
				// The client gave up but the backend keeps scanning and caches the result, so show that instead of an error.
				return fetch();
			}

			throw error;
		} finally {
			deadline.clear();
		}
	};

	const scan = (): Promise<IProtectDiscovery> => {
		if (pendingScan) {
			return pendingScan;
		}

		scanning.value = true;

		const request = runScan();

		pendingScan = request;

		const release = (): void => {
			pendingScan = null;
			scanning.value = false;
		};

		request.then(release, release);

		return request;
	};

	const probe = async (input: IProtectProbeInput): Promise<IProtectProbe> => {
		const deadline = startProtectDeadline(PROTECT_PROBE_DEADLINE_MS);

		probing.value = true;

		try {
			const { data, error, response } = await backend.client.POST(`${BASE}/probe`, {
				body: { data: { host: input.host, ...(input.port !== undefined ? { port: input.port } : {}) } },
				signal: deadline.signal,
			});

			if (data) {
				const result = transformProtectProbe(data.data);

				probes.value = { ...probes.value, [protectProbeKey(result.host, result.port ?? PROTECT_DEFAULT_PORT)]: result };

				return result;
			}

			throw new ProtectApiException(
				getErrorReason<DevicesUnifiProtectPluginProbeDiscoveryOperation>(error, 'Failed to probe the UniFi Protect console.'),
				response?.status
			);
		} catch (error) {
			if (deadline.expired()) {
				throw new ProtectTimeoutException('The console did not answer the probe in time.');
			}

			throw error;
		} finally {
			deadline.clear();
			probing.value = false;
		}
	};

	return { discovery, probes, scanning, probing, fetch, scan, probe };
});

export const registerProtectDiscoveryStore = (pinia: Pinia): ReturnType<typeof useProtectDiscovery> => useProtectDiscovery(pinia);
