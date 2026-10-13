import { type WatchSource, computed, ref, watch } from 'vue';

export interface ThermostatPreviewTicket<T> {
	generation: number;
	snapshot: string;
	request: T;
}

/** Binds preview approval to one immutable request and one current editor draft. */
export function useThermostatPreviewGate(snapshot: () => string, sources: WatchSource[], onInvalidate?: () => void) {
	let generation = 0;
	const approvedSnapshot = ref<string | null>(null);
	const invalidate = () => {
		generation += 1;
		approvedSnapshot.value = null;
		onInvalidate?.();
	};
	watch(sources, invalidate, { deep: true, flush: 'sync' });
	const begin = <T>(request: T): ThermostatPreviewTicket<T> => {
		invalidate();
		return { generation, snapshot: snapshot(), request: JSON.parse(JSON.stringify(request)) as T };
	};
	const isCurrent = (ticket: ThermostatPreviewTicket<unknown>): boolean => ticket.generation === generation && ticket.snapshot === snapshot();
	const approve = (ticket: ThermostatPreviewTicket<unknown>): boolean => {
		if (!isCurrent(ticket)) return false;
		approvedSnapshot.value = ticket.snapshot;
		return true;
	};
	const canSave = computed(() => approvedSnapshot.value !== null && approvedSnapshot.value === snapshot());
	return { begin, isCurrent, approve, canSave, invalidate };
}
