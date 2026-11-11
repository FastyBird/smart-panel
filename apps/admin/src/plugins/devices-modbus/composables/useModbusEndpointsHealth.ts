import { onBeforeUnmount, onMounted } from 'vue';

import { injectStoresManager } from '../../../common';
import { modbusEndpointsStoreKey } from '../store/keys';

/**
 * Health requests one admin tab may send per minute. The backend allows 240 a minute per client across all endpoints;
 * half of that leaves room for a second tab and for manual refreshes.
 */
export const MODBUS_HEALTH_REQUESTS_PER_MINUTE = 120;

/**
 * Endpoints asked in one round. Each round is sent at once, so with more endpoints than this a round takes the next
 * slice of the list and the following rounds continue from there.
 */
export const MODBUS_HEALTH_ROUND_SIZE = MODBUS_HEALTH_REQUESTS_PER_MINUTE;

/** The pause between rounds: `intervalMs`, stretched so a round per endpoint stays within the request budget. */
export const healthRoundDelay = (endpointCount: number, intervalMs: number): number =>
	Math.max(intervalMs, Math.ceil((Math.min(endpointCount, MODBUS_HEALTH_ROUND_SIZE) * 60_000) / MODBUS_HEALTH_REQUESTS_PER_MINUTE));

/** The endpoints of the round starting at `offset`, wrapping around the end of the list. */
export const healthRoundSlice = <T>(items: T[], offset: number): T[] => {
	if (items.length <= MODBUS_HEALTH_ROUND_SIZE) {
		return items;
	}

	const start = offset % items.length;

	return [...items.slice(start), ...items.slice(0, start)].slice(0, MODBUS_HEALTH_ROUND_SIZE);
};

export const useModbusEndpointsHealth = (intervalMs: number = 5000): { refresh: () => Promise<void> } => {
	const endpointsStore = injectStoresManager().getStore(modbusEndpointsStoreKey);

	let timer: ReturnType<typeof setTimeout> | null = null;
	let running = false;
	let stopped = false;
	let offset = 0;

	const round = async (): Promise<void> => {
		if (running || stopped) {
			return;
		}

		running = true;

		try {
			// One failing endpoint (e.g. deleted meanwhile) must not hide the others.
			const endpoints = endpointsStore.findAll();
			const slice = healthRoundSlice(endpoints, offset);

			offset = endpoints.length === 0 ? 0 : (offset + slice.length) % endpoints.length;

			await Promise.allSettled(slice.map((endpoint) => endpointsStore.fetchHealth(endpoint.id)));
		} finally {
			running = false;
		}
	};

	// The next round is planned after this one, from the current endpoint count, so many endpoints poll less often.
	const schedule = (): void => {
		if (stopped) {
			return;
		}

		timer = setTimeout(
			() => {
				void round().finally(schedule);
			},
			healthRoundDelay(endpointsStore.findAll().length, intervalMs)
		);
	};

	// Runs a round now (e.g. after the endpoints were loaded); skipped while another round is running.
	const refresh = (): Promise<void> => round();

	onMounted((): void => {
		stopped = false;
		void round().finally(schedule);
	});

	onBeforeUnmount((): void => {
		stopped = true;

		if (timer !== null) {
			clearTimeout(timer);
			timer = null;
		}
	});

	return { refresh };
};
