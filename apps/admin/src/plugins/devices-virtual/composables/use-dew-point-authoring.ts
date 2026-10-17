import { computed, onMounted, reactive, ref, toRaw, watch } from 'vue';

import { useBackend } from '../../../common';
import {
	DevicesVirtualPluginConfigureDewPointFormula_version,
	DevicesVirtualPluginConfigureDewPointSchema_version,
	DevicesVirtualPluginDewPointSourceRole,
	type components,
} from '../../../openapi';
import { DevicesVirtualPluginDeviceMode } from '../../../openapi.constants';
import { measurementDraft } from '../utils/measurement-authoring.utils';

type Configuration = components['schemas']['DevicesVirtualPluginConfigureDewPoint'];
type State = components['schemas']['DevicesVirtualPluginDataDewPoint'];
const formula = DevicesVirtualPluginConfigureDewPointFormula_version.magnus_water_17_62_243_12_v1;

/** Revision/preview fencing and atomic authoring; no client value becomes protective evidence. */
export function useDewPointAuthoring(outputId?: string) {
	const backend = useBackend();
	const ids = { output: outputId ?? crypto.randomUUID(), device: crypto.randomUUID(), channel: crypto.randomUUID() };
	const model = reactive({ name: '', dryBulb: null as string | null, humidity: null as string | null, maximumAgeSeconds: 60, maximumSkewSeconds: 5 });
	const current = ref<State | null>(null),
		preview = ref<State | null>(null),
		busy = ref(false),
		error = ref<string | null>(null);
	let revision = 0,
		graphRevision: number | undefined,
		generation = 0,
		reviewed: string | null = null;
	const snapshot = () => JSON.stringify(toRaw(model));
	const canSave = computed(() => !!preview.value && reviewed === snapshot() && !busy.value);
	const configuration = (): Configuration => ({
		schema_version: DevicesVirtualPluginConfigureDewPointSchema_version.Value1,
		formula_version: formula,
		expected_revision: revision,
		...(graphRevision === undefined ? {} : { expected_graph_revision: graphRevision }),
		maximum_age_seconds: model.maximumAgeSeconds,
		maximum_skew_seconds: model.maximumSkewSeconds,
		sources: [
			{ role: DevicesVirtualPluginDewPointSourceRole.dry_bulb, source_property: model.dryBulb },
			{ role: DevicesVirtualPluginDewPointSourceRole.relative_humidity, source_property: model.humidity },
		],
	});
	const draft = () => ({
		device: measurementDraft(DevicesVirtualPluginDeviceMode.sensor_transform, model.name, false, ids.output, ids.device, ids.channel, {
			minimum: -45,
			maximum: 60,
		}),
		output_property: ids.output,
		configuration: configuration(),
	});
	const valid = () =>
		(outputId || model.name.trim()) &&
		(model.dryBulb || current.value?.sources.some((s) => s.role === 'dry_bulb' && s.source_property === null)) &&
		(model.humidity || current.value?.sources.some((s) => s.role === 'relative_humidity' && s.source_property === null));
	async function reload() {
		if (!outputId) return;
		const token = ++generation;
		busy.value = true;
		reviewed = null;
		preview.value = null;
		try {
			const result = await backend.client.GET('/plugins/devices-virtual/producers/dew-points/{id}', { params: { path: { id: outputId } } });
			if (!result.data || result.error) throw new Error('dewPointReload');
			if (token !== generation) return;
			const state = result.data.data;
			current.value = state;
			revision = state.revision;
			graphRevision = state.graph_revision;
			model.dryBulb = state.sources.find((s) => s.role === 'dry_bulb')?.source_property ?? null;
			model.humidity = state.sources.find((s) => s.role === 'relative_humidity')?.source_property ?? null;
			model.maximumAgeSeconds = state.maximum_age_seconds;
			model.maximumSkewSeconds = state.maximum_skew_seconds;
		} catch {
			if (token === generation) error.value = 'reload';
		} finally {
			if (token === generation) busy.value = false;
		}
	}
	async function check() {
		if (!valid()) {
			error.value = 'inputs';
			return;
		}
		const token = ++generation,
			captured = snapshot();
		busy.value = true;
		error.value = null;
		reviewed = null;
		try {
			const result = outputId
				? await backend.client.POST('/plugins/devices-virtual/producers/dew-points/{id}/preview', {
						params: { path: { id: outputId } },
						body: configuration(),
					})
				: await backend.client.POST('/plugins/devices-virtual/producers/dew-points/draft-preview', { body: draft() });
			if (!result.data || result.error) throw new Error('dewPointPreview');
			if (token !== generation || captured !== snapshot()) return;
			preview.value = result.data.data;
			graphRevision = preview.value.graph_revision;
			reviewed = captured;
		} catch {
			if (token === generation) error.value = 'preview';
		} finally {
			if (token === generation) busy.value = false;
		}
	}
	async function save(): Promise<string | null> {
		if (!canSave.value) return null;
		const token = ++generation;
		busy.value = true;
		error.value = null;
		try {
			if (outputId) {
				const result = await backend.client.PUT('/plugins/devices-virtual/producers/dew-points/{id}', {
					params: { path: { id: outputId } },
					body: configuration(),
				});
				if (!result.data || result.error) throw new Error('revision');
				if (token === generation) {
					current.value = result.data.data;
					revision = current.value.revision;
					graphRevision = current.value.graph_revision;
				}
				return null;
			}
			const result = await backend.client.POST('/plugins/devices-virtual/producers/dew-points', { body: draft() });
			if (!result.data || result.error) throw new Error('revision');
			return token === generation ? result.data.data.device.id : null;
		} catch {
			if (token === generation) error.value = 'revision';
			return null;
		} finally {
			if (token === generation) {
				busy.value = false;
				reviewed = null;
				preview.value = null;
			}
		}
	}
	watch(
		model,
		() => {
			reviewed = null;
			preview.value = null;
		},
		{ deep: true, flush: 'sync' }
	);
	onMounted(reload);
	return { model, current, preview, busy, error, canSave, reload, check, save };
}
