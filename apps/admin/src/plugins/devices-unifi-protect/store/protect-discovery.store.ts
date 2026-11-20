import { ref } from 'vue';

import { type Pinia, defineStore } from 'pinia';

import { PLUGINS_PREFIX } from '../../../app.constants';
import { getErrorReason, useBackend } from '../../../common';
import {
	DevicesUnifiProtectPluginDiscoveryStatus,
	type DevicesUnifiProtectPluginGetDiscoveryOperation,
	type DevicesUnifiProtectPluginProbeDiscoveryOperation,
	type DevicesUnifiProtectPluginScanDiscoveryOperation,
} from '../../../openapi.constants';
import {
	DEVICES_UNIFI_PROTECT_PLUGIN_PREFIX,
	PROTECT_DEFAULT_PORT,
	PROTECT_DISCOVERY_FOLLOW_INTERVAL_MS,
	PROTECT_DISCOVERY_FOLLOW_MS,
	PROTECT_DISCOVERY_SCAN_DEADLINE_MS,
	PROTECT_PROBE_DEADLINE_MS,
	PROTECT_STATUS_DEADLINE_MS,
} from '../devices-unifi-protect.constants';
import { ProtectApiException, ProtectScanStillRunningException, ProtectTimeoutException } from '../devices-unifi-protect.exceptions';

import { startProtectDeadline } from './protect.deadline';
import { transformProtectDiscovery, transformProtectProbe } from './protect.transformers';
import type { IProtectDiscovery, IProtectProbe, IProtectProbeInput } from './protect.types';

const BASE = `/${PLUGINS_PREFIX}/${DEVICES_UNIFI_PROTECT_PLUGIN_PREFIX}/discovery`;

/** Keys a probe the way the backend normalizes its host (trimmed, lower case), so a typed host finds its entry. */
export const protectProbeKey = (host: string, port: number = PROTECT_DEFAULT_PORT): string => `${host.trim().toLowerCase()}:${port}`;

const isScanInProgress = (value: IProtectDiscovery): boolean => value.status === DevicesUnifiProtectPluginDiscoveryStatus.scanning;

const pause = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

export const useProtectDiscovery = defineStore('devices_unifi_protect_plugin-discovery', () => {
	const backend = useBackend();

	const discovery = ref<IProtectDiscovery | null>(null);
	/** Probe results by `host:port`, see `protectProbeKey`. */
	const probes = ref<Record<string, IProtectProbe>>({});
	/** True while this client runs a scan or follows one the backend reports in progress. */
	const scanning = ref(false);
	/** Probes in flight by `host:port`, so one slow probe does not mark another as busy. */
	const probingKeys = ref<Record<string, number>>({});

	const isProbing = (host: string, port?: number): boolean => (probingKeys.value[protectProbeKey(host, port)] ?? 0) > 0;

	/**
	 * Bumped whenever a result is applied. A plain read that started before the bump is older than what the store holds
	 * and is dropped. A scan, and the reads that follow a scan in progress, always apply: they are the newest knowledge.
	 */
	let generation = 0;

	/**
	 * While a scan runs the backend answers with no consoles; that says nothing about the consoles found before, so a
	 * scan in progress keeps the list (and the count of other devices) the store already holds.
	 */
	const apply = (value: IProtectDiscovery): void => {
		const previous = discovery.value;

		discovery.value =
			isScanInProgress(value) && previous !== null ? { ...value, consoles: previous.consoles, otherUnifiDevices: previous.otherUnifiDevices } : value;
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

					return discovery.value ?? value;
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

	/**
	 * Re-reads the cached discovery while the backend reports a scan in progress, until it reports how the scan ended.
	 * It gives up after `PROTECT_DISCOVERY_FOLLOW_MS` (each read under the status deadline), so it always ends by itself.
	 * When it gives up or a read fails, the store goes back to what it held before (`restore`), so no scan stays shown
	 * as running. `readNow` reads at once (after a scan request gave up); otherwise the first read waits an interval,
	 * because the caller has just read.
	 */
	const follow = async (restore: IProtectDiscovery | null, readNow: boolean): Promise<IProtectDiscovery> => {
		try {
			let waited = 0;

			if (!readNow) {
				await pause(PROTECT_DISCOVERY_FOLLOW_INTERVAL_MS);

				waited = PROTECT_DISCOVERY_FOLLOW_INTERVAL_MS;
			}

			for (;;) {
				const value = await read(true);

				if (!isScanInProgress(value)) {
					return value;
				}

				if (waited + PROTECT_DISCOVERY_FOLLOW_INTERVAL_MS > PROTECT_DISCOVERY_FOLLOW_MS) {
					throw new ProtectScanStillRunningException('The UniFi Protect discovery scan is still running.');
				}

				await pause(PROTECT_DISCOVERY_FOLLOW_INTERVAL_MS);

				waited += PROTECT_DISCOVERY_FOLLOW_INTERVAL_MS;
			}
		} catch (error) {
			discovery.value = restore;
			generation++;

			throw error;
		}
	};

	let pendingScan: Promise<IProtectDiscovery> | null = null;

	/** Marks a scan, or the following of one, as the one in progress until it settles. */
	const track = (request: Promise<IProtectDiscovery>): Promise<IProtectDiscovery> => {
		scanning.value = true;
		pendingScan = request;

		const release = (): void => {
			if (pendingScan === request) {
				pendingScan = null;
				scanning.value = false;
			}
		};

		request.then(release, release);

		return request;
	};

	let pendingFetch: Promise<IProtectDiscovery> | null = null;

	/** Reads the cached discovery; when the backend reports a scan in progress (one started elsewhere), follows it. */
	const fetch = (): Promise<IProtectDiscovery> => {
		if (pendingFetch) {
			return pendingFetch;
		}

		const request = (async (): Promise<IProtectDiscovery> => {
			const before = discovery.value;
			const value = await read(false);

			if (!isScanInProgress(value)) {
				return value;
			}

			// A scan this client runs or already follows reports its own end.
			return pendingScan ?? track(follow(before, false));
		})();

		pendingFetch = request;

		const release = (): void => {
			if (pendingFetch === request) {
				pendingFetch = null;
			}
		};

		request.then(release, release);

		return request;
	};

	const runScan = async (): Promise<IProtectDiscovery> => {
		const before = discovery.value;
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
				// The client gave up but the backend keeps scanning and caches the result, so follow it to that result
				// instead of showing an error, or an empty list while it still runs.
				return follow(before, true);
			}

			throw error;
		} finally {
			deadline.clear();
		}
	};

	const scan = (): Promise<IProtectDiscovery> => pendingScan ?? track(runScan());

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
