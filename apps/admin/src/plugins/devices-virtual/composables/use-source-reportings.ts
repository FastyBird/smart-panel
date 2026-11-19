import { type MaybeRefOrGetter, computed, reactive, toValue, watch } from 'vue';

import { PLUGINS_PREFIX } from '../../../app.constants';
import { useBackend } from '../../../common';
import { DEVICES_VIRTUAL_PLUGIN_PREFIX } from '../devices-virtual.constants';
import { type ISourceReporting, transformSourceReporting } from '../utils/source-reporting';

/**
 * Loads how often each selected source reports. Entries follow the selection order (duplicates and unselected
 * entries removed); an entry is null while its profile is loading or could not be loaded. A source is fetched once
 * while it stays selected, and a response of a superseded load (deselected, then selected again) is dropped.
 * Guidance only: a failed load leaves the entry null and never blocks the form.
 */
export function useSourceReportings(properties: MaybeRefOrGetter<(string | null | undefined)[]>) {
	const backend = useBackend();
	const reportings = reactive(new Map<string, ISourceReporting | null>());
	const loads = new Map<string, number>();
	let lastLoad = 0;

	const selected = computed<string[]>(() => [...new Set(toValue(properties).filter((id): id is string => typeof id === 'string' && id.length > 0))]);

	const load = async (id: string): Promise<void> => {
		const token = ++lastLoad;
		loads.set(id, token);
		reportings.set(id, null);
		try {
			const { data } = await backend.client.GET(`/${PLUGINS_PREFIX}/${DEVICES_VIRTUAL_PLUGIN_PREFIX}/producers/source-reporting/{id}`, {
				params: { path: { id } },
			});
			if (loads.get(id) !== token || !data) return;
			reportings.set(id, transformSourceReporting(data.data));
		} catch {
			// Guidance only: without it the field works as before.
		}
	};

	watch(
		selected,
		(ids) => {
			for (const id of [...reportings.keys()])
				if (!ids.includes(id)) {
					reportings.delete(id);
					loads.delete(id);
				}
			for (const id of ids) if (!reportings.has(id)) void load(id);
		},
		{ immediate: true }
	);

	return computed<(ISourceReporting | null)[]>(() => selected.value.map((id) => reportings.get(id) ?? null));
}
