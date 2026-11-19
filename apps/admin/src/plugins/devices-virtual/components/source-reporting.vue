<template>
	<el-alert
		v-if="advice.kind === 'unknown'"
		type="info"
		:title="tt('unknown.title')"
		:description="tt(advice.sources > 1 ? 'unknown.messageMany' : 'unknown.message')"
		:closable="false"
		show-icon
		class="mb-2"
		data-test-id="source-reporting-unknown"
	/>
	<el-alert
		v-else-if="advice.kind === 'too_short'"
		type="warning"
		:title="tt(advice.sources > 1 ? 'tooShort.titleMany' : 'tooShort.title')"
		:closable="false"
		show-icon
		class="mb-2"
		data-test-id="source-reporting-too-short"
	>
		<p class="m-0">
			{{ observed(advice.reporting, advice.sources) }}
			{{ tt('tooShort.message', { consequence: tt(`consequence.${consequence}`) }) }}
		</p>
		<el-button
			v-if="advice.recommended !== null"
			size="small"
			type="warning"
			plain
			class="mt-2"
			data-test-id="source-reporting-apply"
			@click="emit('apply', advice.recommended)"
		>
			{{ tt('tooShort.apply', { seconds: advice.recommended, duration: duration(advice.recommended) }) }}
		</el-button>
	</el-alert>
	<el-text
		v-else-if="advice.kind === 'fits'"
		size="small"
		type="info"
		class="block mb-2"
		data-test-id="source-reporting-fits"
	>
		{{ observed(advice.reporting, advice.sources) }}
		{{ tt('fits') }}
	</el-text>
</template>

<script setup lang="ts">
import { computed, reactive, watch } from 'vue';
import { useI18n } from 'vue-i18n';

import { ElAlert, ElButton, ElText } from 'element-plus';

import { PLUGINS_PREFIX } from '../../../app.constants';
import { useBackend } from '../../../common';
import { DEVICES_VIRTUAL_PLUGIN_PREFIX } from '../devices-virtual.constants';
import {
	type ISourceReporting,
	type SourceAgeAdvice,
	type SourceReportingConsequence,
	formatReportingDuration,
	sourceAgeAdvice,
	transformSourceReporting,
} from '../utils/source-reporting';

defineOptions({
	name: 'SourceReporting',
});

const props = defineProps<{
	/** The sources sharing one maximum age; unselected entries are ignored. */
	properties: (string | null | undefined)[];
	maximumAgeSeconds: number | null | undefined;
	/** What a stale reading does to the virtual device using these sources. */
	consequence: SourceReportingConsequence;
}>();

const emit = defineEmits<{
	(e: 'apply', maximumAgeSeconds: number): void;
}>();

const { t, locale } = useI18n();
const backend = useBackend();

const tt = (key: string, params: Record<string, unknown> = {}): string => t(`devicesVirtualPlugin.sourceReporting.${key}`, params);
const duration = (seconds: number | null): string => formatReportingDuration(seconds, locale.value);
const observed = (reporting: ISourceReporting, sources: number): string =>
	tt(sources > 1 ? 'observedSlowest' : 'observed', {
		typical: duration(reporting.typicalIntervalSeconds),
		longest: duration(reporting.longestIntervalSeconds),
	});

// Profiles of the selected sources by property id; a source is fetched once while it stays selected.
const reportings = reactive(new Map<string, ISourceReporting | null>());
// The active load of each selected source: a response of a superseded load (deselected, then selected again) is dropped.
const loads = new Map<string, number>();
let lastLoad = 0;

const selected = computed<string[]>(() => [...new Set(props.properties.filter((id): id is string => typeof id === 'string' && id.length > 0))]);

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

const advice = computed<SourceAgeAdvice>(() =>
	sourceAgeAdvice(
		selected.value.map((id) => reportings.get(id) ?? null),
		props.maximumAgeSeconds ?? null
	)
);
</script>
