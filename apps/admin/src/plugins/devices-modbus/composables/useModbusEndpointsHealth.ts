import { onBeforeUnmount, onMounted } from 'vue';

import { injectStoresManager } from '../../../common';
import { MODBUS_HEALTH_REQUESTS_PER_MINUTE } from '../devices-modbus.constants';
import { modbusEndpointsStoreKey } from '../store/keys';

/**
 * Endpoints asked in one round. Each round is sent at once, so with more endpoints than this a round takes the next
 * slice of the list and the following rounds continue from there.
 */
export const MODBUS_HEALTH_ROUND_SIZE = MODBUS_HEALTH_REQUESTS_PER_MINUTE;

/** The pause between rounds: `intervalMs`, stretched so a round per endpoint stays within the request budget. */
export const healthRoundDelay = (endpointCount: number, intervalMs: number): number =>
	Math.max(intervalMs, Math.ceil((Math.min(endpointCount, MODBUS_HEALTH_ROUND_SIZE) * 60_000) / MODBUS_HEALTH_REQUESTS_PER_MINUTE));

/** At most `size` endpoints of the round starting at `offset`, wrapping around the end of the list. */
export const healthRoundSlice = <T>(items: T[], offset: number, size: number = MODBUS_HEALTH_ROUND_SIZE): T[] => {
	if (size <= 0) {
		return [];
	}

	if (items.length <= size) {
		return items;
	}

	const start = offset % items.length;

	return [...items.slice(start), ...items.slice(0, start)].slice(0, size);
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
			const endpoints = endpointsStore.findAll();
			// Scheduled rounds, refresh() and earlier visits of the page share the store's per-minute budget, so neither
			// a refresh right before a round nor reopening the page can exceed the requests the backend allows.
			const granted = endpointsStore.reserveHealthRequests(Math.min(endpoints.length, MODBUS_HEALTH_ROUND_SIZE));
			const slice = healthRoundSlice(endpoints, offset, granted);

			offset = endpoints.length === 0 ? 0 : (offset + slice.length) % endpoints.length;

			// One failing endpoint (e.g. deleted meanwhile) must not hide the others.
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
