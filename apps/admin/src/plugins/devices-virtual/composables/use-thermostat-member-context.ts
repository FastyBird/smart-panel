import { type Ref, onScopeDispose, ref, shallowRef, watch } from 'vue';

/** A source/profile change or disposal revokes every earlier read; a failed read never leaves usable cached context. */
export function useThermostatMemberContext<T>(key: Ref<string>, read: (key: string, signal: AbortSignal) => Promise<T>) {
	const value = shallowRef<T | null>(null),
		error = ref<string | null>(null),
		loading = ref(false);
	let generation = 0,
		disposed = false,
		reader: AbortController | undefined;
	const invalidate = () => {
		generation++;
		reader?.abort();
		value.value = null;
		loading.value = false;
	};
	const reload = async () => {
		const ticket = ++generation,
			identity = key.value;
		reader?.abort();
		value.value = null;
		error.value = null;
		if (!identity || disposed) {
			loading.value = false;
			return;
		}
		reader = new AbortController();
		loading.value = true;
		try {
			const result = await read(identity, reader.signal);
			if (!disposed && ticket === generation && identity === key.value) value.value = result;
		} catch (cause) {
			if (!disposed && ticket === generation) error.value = String(cause);
		} finally {
			if (ticket === generation) loading.value = false;
		}
	};
	watch(
		key,
		() => {
			void reload();
		},
		{ immediate: true, flush: 'sync' }
	);
	onScopeDispose(() => {
		disposed = true;
		generation++;
		reader?.abort();
	});
	return { value, error, loading, reload, invalidate };
}
