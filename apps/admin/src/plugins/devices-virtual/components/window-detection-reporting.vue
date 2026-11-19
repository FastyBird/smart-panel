<template>
	<template v-if="advice.requiredIntervalSeconds !== null">
		<el-alert
			v-if="advice.kind === 'too_slow'"
			type="warning"
			:title="tt('tooSlow.title')"
			:closable="false"
			show-icon
			class="mb-2"
			data-test-id="window-detection-too-slow"
		>
			<p class="m-0">
				{{
					tt('tooSlow.message', { typical: duration(advice.reporting.typicalIntervalSeconds), required: duration(advice.requiredIntervalSeconds) })
				}}
			</p>
		</el-alert>
		<el-text
			v-else
			size="small"
			type="info"
			class="block mb-2"
			data-test-id="window-detection-requirement"
		>
			{{ tt('requirement', { required: duration(advice.requiredIntervalSeconds) }) }}
			<template v-if="advice.kind === 'fits'">{{ tt('fits', { typical: duration(advice.reporting.typicalIntervalSeconds) }) }}</template>
		</el-text>
	</template>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';

import { ElAlert, ElText } from 'element-plus';

import { useSourceReportings } from '../composables/use-source-reportings';
import { type IWindowDetectionCadence, type WindowDetectionAdvice, formatReportingDuration, windowDetectionAdvice } from '../utils/source-reporting';

defineOptions({
	name: 'WindowDetectionReporting',
});

const props = defineProps<{
	/** The thermostat's room temperature source. */
	property: string | null | undefined;
	cadence: IWindowDetectionCadence;
}>();

const { t, locale } = useI18n();

const tt = (key: string, params: Record<string, unknown> = {}): string => t(`devicesVirtualPlugin.windowDetection.${key}`, params);
const duration = (seconds: number | null): string => formatReportingDuration(seconds, locale.value);

const reportings = useSourceReportings(() => [props.property]);

const advice = computed<WindowDetectionAdvice>(() => windowDetectionAdvice(reportings.value[0] ?? null, props.cadence));
</script>
