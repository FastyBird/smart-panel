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

/** Keys a probe the way the backend normalizes its host (trimmed, lower case), so a typed host finds its entry. */
export const protectProbeKey = (host: string, port: number = PROTECT_DEFAULT_PORT): string => `${host.trim().toLowerCase()}:${port}`;

export const useProtectDiscovery = defineStore('devices_unifi_protect_plugin-discovery', () => {
	const backend = useBackend();

	const discovery = ref<IProtectDiscovery | null>(null);
	/** Probe results by `host:port`, see `protectProbeKey`. */
	const probes = ref<Record<string, IProtectProbe>>({});
	const scanning = ref(false);
	/** Probes in flight by `host:port`, so one slow probe does not mark another as busy. */
	const probingKeys = ref<Record<string, number>>({});

	const isProbing = (host: string, port?: number): boolean => (probingKeys.value[protectProbeKey(host, port)] ?? 0) > 0;

	/**
	 * Bumped whenever a result is applied. A plain read that started before the bump is older than what the store holds
	 * and is dropped. A scan, and the read that follows a scan timeout, always apply: they are the newest knowledge.
	 */
	let generation = 0;

	const apply = (value: IProtectDiscovery): void => {
		discovery.value = value;
		generation++;
	};

	const read = async (force: boolean): Promise<IProtectDiscovery> => {
		const startedAt = generation;
		const deadline = startProtectDeadline(PROTECT_STATUS_DEADLINE_MS);

		try {
			const { data, error, response } = await backend.client.GET(BASE, { signal: deadline.signal });

			if (data) {
				const value = transformProtectDiscovery(data.data);

				if (force || startedAt === generation) {
					apply(value);

					return value;
				}

				return discovery.value ?? value;
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

	let pendingFetch: Promise<IProtectDiscovery> | null = null;

	const fetch = (): Promise<IProtectDiscovery> => {
		if (pendingFetch) {
			return pendingFetch;
		}

		const request = read(false);

		pendingFetch = request;

		const release = (): void => {
			if (pendingFetch === request) {
				pendingFetch = null;
			}
		};

		request.then(release, release);

		return request;
	};

	let pendingScan: Promise<IProtectDiscovery> | null = null;

	const runScan = async (): Promise<IProtectDiscovery> => {
		const deadline = startProtectDeadline(PROTECT_DISCOVERY_SCAN_DEADLINE_MS);

		try {
			const { data, error, response } = await backend.client.POST(`${BASE}/scan`, { signal: deadline.signal });

			if (data) {
				const value = transformProtectDiscovery(data.data);

				apply(value);

				return value;
			}

			throw new ProtectApiException(
				getErrorReason<DevicesUnifiProtectPluginScanDiscoveryOperation>(error, 'Failed to scan for UniFi Protect consoles.'),
				response?.status
			);
		} catch (error) {
			if (deadline.expired()) {
				// The client gave up but the backend keeps scanning and caches the result, so show that instead of an error.
				return read(true);
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
		const inFlightKey = protectProbeKey(input.host, input.port);

		probingKeys.value = { ...probingKeys.value, [inFlightKey]: (probingKeys.value[inFlightKey] ?? 0) + 1 };

		try {
			const { data, error, response } = await backend.client.POST(`${BASE}/probe`, {
				body: { data: { host: input.host, ...(input.port !== undefined ? { port: input.port } : {}) } },
				signal: deadline.signal,
			});

			if (data) {
				const result = transformProtectProbe(data.data);

				probes.value = { ...probes.value, [protectProbeKey(result.host, result.port)]: result };

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

			const { [inFlightKey]: count = 1, ...rest } = probingKeys.value;

			probingKeys.value = count > 1 ? { ...rest, [inFlightKey]: count - 1 } : rest;
		}
	};

	return { discovery, probes, scanning, isProbing, fetch, scan, probe };
});

export const registerProtectDiscoveryStore = (pinia: Pinia): ReturnType<typeof useProtectDiscovery> => useProtectDiscovery(pinia);
