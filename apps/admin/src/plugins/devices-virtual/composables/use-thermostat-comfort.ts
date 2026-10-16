import { type Ref, computed, ref, shallowRef, watch } from 'vue';

import type { ComfortAction, ComfortSnapshot, ComfortTransport } from '../services/thermostat-comfort';

/** Every edit, request, command and connection lifecycle fences older reads; writes never trust their response as actuator evidence. */
export function useThermostatComfort(deviceId: Ref<string>, transport: ComfortTransport) {
	const snapshot = shallowRef<ComfortSnapshot | null>(null);
	const readError = ref<string | null>(null);
	const actionError = ref<string | null>(null);
	const error = computed(() => actionError.value ?? readError.value);
	const loading = ref(false);
	const pending = ref(false);
	const ready = ref(false);
	let reader: AbortController | undefined;
	let generation = 0;
	let minimumRevision = 0;
	let disposed = false;
	let mutation = 0;
	const invalidate = () => {
		reader?.abort();
		generation++;
		ready.value = false;
		loading.value = false;
	};
	const reload = async () => {
		if (pending.value || disposed || !deviceId.value) return;
		const id = deviceId.value,
			ticket = ++generation;
		ready.value = false;
		loading.value = true;
		try {
			reader?.abort();
			reader = new AbortController();
			const result = await transport.read(id, reader.signal);
			if (disposed || ticket !== generation || id !== deviceId.value) return;
			if (result.comfort.controller !== id) throw new Error('controller_conflict');
			if (result.comfort.revision < minimumRevision) return;
			snapshot.value = result;
			readError.value = null;
			ready.value = true;
		} catch (cause) {
			if (!disposed && ticket === generation) readError.value = String(cause);
		} finally {
			if (ticket === generation) loading.value = false;
		}
	};
	const serverRevision = (revision: number) => {
		minimumRevision = Math.max(minimumRevision, revision);
		if ((snapshot.value?.comfort.revision ?? -1) < minimumRevision) {
			ready.value = false;
			if (!loading.value) void reload();
		}
	};
	const edit = () => {
		invalidate();
		void reload();
	};
	const act = async (action: ComfortAction) => {
		if (!ready.value || pending.value || !snapshot.value) return false;
		const state = structuredClone(snapshot.value.comfort),
			request = structuredClone(action);
		const id = deviceId.value,
			operation = ++mutation;
		invalidate();
		pending.value = true;
		actionError.value = null;
		readError.value = null;
		const ticket = generation;
		let accepted = false,
			stale = false;
		try {
			await transport.write(id, state, request);
			accepted = true;
		} catch (cause) {
			if (!disposed && operation === mutation && id === deviceId.value) actionError.value = String(cause);
		} finally {
			if (!disposed && operation === mutation && id === deviceId.value) {
				stale = ticket !== generation;
				pending.value = false;
				await reload();
			}
		}
		return accepted && !stale && !disposed && operation === mutation && id === deviceId.value;
	};
	watch(
		deviceId,
		() => {
			invalidate();
			mutation++;
			pending.value = false;
			snapshot.value = null;
			actionError.value = null;
			readError.value = null;
			minimumRevision = 0;
			void reload();
		},
		{ flush: 'sync' }
	);
	const dispose = () => {
		disposed = true;
		invalidate();
		mutation++;
	};
	return {
		snapshot,
		error,
		loading,
		pending,
		ready,
		canAct: computed(() => ready.value && !pending.value),
		reload,
		invalidate,
		edit,
		act,
		dispose,
		serverRevision,
	};
}
