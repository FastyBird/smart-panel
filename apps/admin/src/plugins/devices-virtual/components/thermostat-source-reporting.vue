<template>
	<el-alert
		v-if="advice.kind === 'unknown'"
		type="info"
		:title="tt('unknown.title')"
		:description="tt('unknown.message')"
		:closable="false"
		show-icon
		class="mb-2"
	/>
	<el-alert
		v-else-if="advice.kind === 'too_short'"
		type="warning"
		:title="tt('tooShort.title')"
		:closable="false"
		show-icon
		class="mb-2"
	>
		<p class="m-0">
			{{ tt('observed', { typical: duration(advice.reporting.typicalIntervalSeconds), longest: duration(advice.reporting.longestIntervalSeconds) }) }}
			{{ tt('tooShort.message') }}
		</p>
		<el-button
			v-if="advice.recommended !== null"
			size="small"
			type="warning"
			plain
			class="mt-2"
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
	>
		{{ tt('observed', { typical: duration(advice.reporting.typicalIntervalSeconds), longest: duration(advice.reporting.longestIntervalSeconds) }) }}
		{{ tt('fits') }}
	</el-text>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';

import { ElAlert, ElButton, ElText } from 'element-plus';

import { PLUGINS_PREFIX } from '../../../app.constants';
import { useBackend } from '../../../common';
import { DEVICES_VIRTUAL_PLUGIN_PREFIX } from '../devices-virtual.constants';
import { formatSourceSampleAge } from '../utils/source-sample-age';
import {
	type IThermostatSourceReporting,
	type ThermostatSourceAgeAdvice,
	thermostatSourceAgeAdvice,
	transformThermostatSourceReporting,
} from '../utils/thermostat-source-reporting';

defineOptions({
	name: 'ThermostatSourceReporting',
});

const props = defineProps<{
	property: string | null;
	maximumAgeSeconds: number | null;
}>();

const emit = defineEmits<{
	(e: 'apply', maximumAgeSeconds: number): void;
}>();

const { t, locale } = useI18n();
const backend = useBackend();

const tt = (key: string, params: Record<string, unknown> = {}): string => t(`devicesVirtualPlugin.thermostat.sources.reporting.${key}`, params);
const duration = (seconds: number | null): string => formatSourceSampleAge(seconds, locale.value);

const reporting = ref<IThermostatSourceReporting | null>(null);

let generation = 0;
const load = async (id: string | null): Promise<void> => {
	const current = ++generation;
	reporting.value = null;
	if (!id) return;
	try {
		const { data } = await backend.client.GET(`/${PLUGINS_PREFIX}/${DEVICES_VIRTUAL_PLUGIN_PREFIX}/producers/thermostats/source-reporting/{id}`, {
			params: { path: { id } },
		});
		if (current !== generation || !data) return;
		reporting.value = transformThermostatSourceReporting(data.data);
	} catch {
		// Guidance only: without it the field works as before.
		if (current === generation) reporting.value = null;
	}
};

watch(
	(): string | null => props.property,
	(id) => void load(id),
	{ immediate: true }
);

const advice = computed<ThermostatSourceAgeAdvice>(() => thermostatSourceAgeAdvice(reporting.value, props.maximumAgeSeconds));
</script>
