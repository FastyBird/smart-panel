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
	 * Bumped whenever the store's discovery changes. A read that started before the bump is older than what the store
	 * holds and is dropped, whether it was a plain fetch or a read following a scan. Only a scan request's own answer
	 * always applies: it is the newest knowledge.
	 */
	let generation = 0;

	/** The newest result that is not a scan in progress (null before any): what a follow that gives up goes back to. */
	let settled: IProtectDiscovery | null = null;

	/**
	 * While a scan runs the backend answers with no consoles; that says nothing about the consoles found before, so a
	 * scan in progress keeps the list (and the count of other devices) the store already holds.
	 */
	const apply = (value: IProtectDiscovery): void => {
		const previous = discovery.value;

		if (isScanInProgress(value)) {
			discovery.value = previous !== null ? { ...value, consoles: previous.consoles, otherUnifiDevices: previous.otherUnifiDevices } : value;
		} else {
			discovery.value = settled = value;
		}

		generation++;
	};

	/** Puts back the newest finished result when a scan in progress is shown that nothing follows any more. */
	const endShownScan = (): void => {
		if (discovery.value !== null && isScanInProgress(discovery.value)) {
			discovery.value = settled;
			generation++;
		}
	};

	/**
	 * Reads the cached discovery and applies it unless a newer result was applied while it ran. `value` is what the store
	 * holds afterwards; `applied` is the generation this read's own answer produced, taken with the apply itself, or null
	 * when the answer was dropped as older.
	 */
	const read = async (deadlineMs: number = PROTECT_STATUS_DEADLINE_MS): Promise<{ value: IProtectDiscovery; applied: number | null }> => {
		const startedAt = generation;
		const deadline = startProtectDeadline(deadlineMs);

		try {
			const { data, error, response } = await backend.client.GET(BASE, { signal: deadline.signal });

			if (data) {
				const value = transformProtectDiscovery(data.data);

				if (startedAt !== generation) {
					return { value: discovery.value ?? value, applied: null };
				}

				apply(value);

				return { value: discovery.value ?? value, applied: generation };
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
	 *
	 * It ends by itself `PROTECT_DISCOVERY_FOLLOW_MS` after it starts, counting the time reads take as well as the
	 * pauses: every pause and every read deadline is cut to what is left. A failed or timed out read is retried while
	 * time is left; the backend may well still be scanning.
	 *
	 * The store is this follow's until another read applies a newer result. Its own reads apply only when nothing newer
	 * landed while they ran, so a late "scanning" answer never hides a completion another read already applied. A newer
	 * result that is not a scan in progress means the scan has ended, so the follow ends with it. Otherwise, out of time,
	 * it puts back the newest result that is not a scan in progress (`settled`), so no scan stays shown as running and no
	 * consoles found meanwhile are lost, and reports what the backend last said: its error, or that the scan is still
	 * running.
	 *
	 * `readNow` reads at once (after a scan request gave up); otherwise the first read waits an interval, because the
	 * caller has just read.
	 */
	const follow = async (readNow: boolean): Promise<IProtectDiscovery> => {
		const endsAt = Date.now() + PROTECT_DISCOVERY_FOLLOW_MS;
		const left = (): number => Math.max(0, endsAt - Date.now());

		/** The generation of this follow's own latest change of the store. */
		let owned = generation;
		let failure: unknown = null;

		const endedElsewhere = (): IProtectDiscovery | null => {
			const current = discovery.value;

			return generation !== owned && current !== null && !isScanInProgress(current) ? current : null;
		};

		for (let first = true; ; first = false) {
			const wait = !first || !readNow ? Math.min(PROTECT_DISCOVERY_FOLLOW_INTERVAL_MS, left()) : 0;

			if (wait > 0) {
				await pause(wait);
			}

			const ended = endedElsewhere();

			if (ended !== null) {
				return ended;
			}

			const deadlineMs = Math.min(PROTECT_STATUS_DEADLINE_MS, left());

			if (deadlineMs <= 0) {
				break;
			}

			try {
				const { value, applied } = await read(deadlineMs);

				if (applied !== null) {
					owned = applied;

					if (!isScanInProgress(value)) {
						return value;
					}
				}

				// The backend answered; a dropped answer leaves the newer result to the check above.
				failure = null;
			} catch (error) {
				// A read cut short by the end of the follow says nothing about the scan; any other failure is the latest word.
				if (!(error instanceof ProtectTimeoutException && deadlineMs < PROTECT_STATUS_DEADLINE_MS)) {
					failure = error;
				}
			}
		}

		// Out of time, and the store is still this follow's (checked just before the loop ended).
		endShownScan();

		throw failure ?? new ProtectScanStillRunningException('The UniFi Protect discovery scan is still running.');
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
			const { value } = await read();

			if (!isScanInProgress(value)) {
				return value;
			}

			// A scan this client runs or already follows reports its own end.
			return pendingScan ?? track(follow(false));
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

	/** Asks the backend to scan; a client timeout comes out as `ProtectTimeoutException`. */
	const requestScan = async (): Promise<IProtectDiscovery> => {
		const deadline = startProtectDeadline(PROTECT_DISCOVERY_SCAN_DEADLINE_MS);

		try {
			const { data, error, response } = await backend.client.POST(`${BASE}/scan`, { signal: deadline.signal });

			if (data) {
				return transformProtectDiscovery(data.data);
			}

			throw new ProtectApiException(
				getErrorReason<DevicesUnifiProtectPluginScanDiscoveryOperation>(error, 'Failed to scan for UniFi Protect consoles.'),
				response?.status
			);
		} catch (error) {
			if (deadline.expired()) {
				throw new ProtectTimeoutException('The UniFi Protect discovery scan did not answer in time.');
			}

			throw error;
		} finally {
			deadline.clear();
		}
	};

	/** A 4xx answer: the backend refused the request, so no scan runs for it. */
	const isRefused = (error: unknown): boolean =>
		error instanceof ProtectApiException && error.code !== undefined && error.code >= 400 && error.code < 500;

	/**
	 * Runs a scan. Every way out leaves no scan in progress shown unless a follow is running: a refused request puts back
	 * the newest finished result (a read meanwhile may have applied the backend's "scanning"), and any other failure
	 * follows the backend's scan, which always ends with a finished result shown.
	 */
	const runScan = async (): Promise<IProtectDiscovery> => {
		const before = settled;
		let value: IProtectDiscovery;

		try {
			value = await requestScan();
		} catch (error) {
			if (isRefused(error)) {
				endShownScan();

				throw error;
			}

			// A client timeout, a lost connection or a server error says nothing about the scan: the backend may still be
			// running it and caches the result, so follow it to that result instead of showing an error, or an empty list.
			const result = await follow(true);

			// After a failure other than the timeout, a result from before the request means the scan never ran.
			if (!(error instanceof ProtectTimeoutException) && before !== null && (result.startedAt ?? null) === (before.startedAt ?? null)) {
				throw error;
			}

			return result;
		}

		apply(value);

		// An answer before the scan finished: follow it to its end rather than leave it shown as running.
		return isScanInProgress(value) ? follow(false) : value;
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
