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
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';

import { ElAlert, ElButton, ElText } from 'element-plus';

import { useSourceReportings } from '../composables/use-source-reportings';
import {
	type ISourceReporting,
	type SourceAgeAdvice,
	type SourceReportingConsequence,
	formatReportingDuration,
	sourceAgeAdvice,
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

const tt = (key: string, params: Record<string, unknown> = {}): string => t(`devicesVirtualPlugin.sourceReporting.${key}`, params);
const duration = (seconds: number | null): string => formatReportingDuration(seconds, locale.value);
const observed = (reporting: ISourceReporting, sources: number): string =>
	tt(sources > 1 ? 'observedSlowest' : 'observed', {
		typical: duration(reporting.typicalIntervalSeconds),
		longest: duration(reporting.longestIntervalSeconds),
	});

const reportings = useSourceReportings(() => props.properties);

const advice = computed<SourceAgeAdvice>(() => sourceAgeAdvice(reportings.value, props.maximumAgeSeconds ?? null));
</script>
