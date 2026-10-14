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
	const execute = async <T, R>(
		request: T,
		send: (request: T) => Promise<R>,
		handlers: { success: (result: R) => void; error: (error: unknown) => void; pending: (pending: boolean) => void }
	): Promise<void> => {
		const ticket = begin(request);
		handlers.pending(true);
		try {
			const result = await send(ticket.request);
			if (!isCurrent(ticket)) return;
			approve(ticket);
			handlers.success(result);
		} catch (error) {
			if (isCurrent(ticket)) handlers.error(error);
		} finally {
			if (isCurrent(ticket)) handlers.pending(false);
		}
	};
	return { execute, canSave, invalidate };
}
