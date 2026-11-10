import { onBeforeUnmount, onMounted } from 'vue';

import { injectStoresManager } from '../../../common';
import { modbusEndpointsStoreKey } from '../store/keys';

export const useModbusEndpointsHealth = (intervalMs: number = 5000): { refresh: () => Promise<void> } => {
	const endpointsStore = injectStoresManager().getStore(modbusEndpointsStoreKey);

	let timer: ReturnType<typeof setInterval> | null = null;
	let running = false;
	let stopped = false;

	const round = async (): Promise<void> => {
		if (running || stopped) {
			return;
		}

		running = true;

		try {
			// One failing endpoint (e.g. deleted meanwhile) must not hide the others.
			await Promise.allSettled(endpointsStore.findAll().map((endpoint) => endpointsStore.fetchHealth(endpoint.id)));
		} finally {
			running = false;
		}
	};

	// Runs a round now (e.g. after the endpoints were loaded); skipped while another round is running.
	const refresh = (): Promise<void> => round();

	onMounted((): void => {
		stopped = false;
		void round();
		timer = setInterval(() => void round(), intervalMs);
	});

	onBeforeUnmount((): void => {
		stopped = true;

		if (timer !== null) {
			clearInterval(timer);
			timer = null;
		}
	});

	return { refresh };
};
