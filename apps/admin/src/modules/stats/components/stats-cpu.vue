<template>
	<stat-tile
		icon="mdi:cpu-64-bit"
		:label="t('statsModule.headings.cpu')"
		:value="formatPct(systemModuleSection?.cpuLoad1m.value)"
		:hint="
			t('statsModule.fields.cpu.temperature.title', {
				temperature: systemInfo?.temperature.cpu ?? t('application.value.notAvailable'),
				unit: '°C',
			})
		"
		:last-updated="systemModuleSection?.cpuLoad1m.lastUpdated ?? null"
		:stale="isStale"
		:progress="percentage"
		:loading="props.loading"
	/>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';

import { useNumberFormat } from '../../../common';
import { STALE_MS } from '../stats.constants';

import StatTile from './stat-tile.vue';
import type { IStatsCpuProps } from './stats-cpu.types';

defineOptions({
	name: 'StatsCpu',
});

const props = withDefaults(defineProps<IStatsCpuProps>(), {
	loading: false,
});

const { t } = useI18n();
const { formatPct } = useNumberFormat();

const isStale = computed<boolean>((): boolean => {
	const lu = props.systemModuleSection?.cpuLoad1m.lastUpdated ? props.systemModuleSection?.cpuLoad1m.lastUpdated.getTime() : 0;

	return lu ? Date.now() - lu > STALE_MS : true;
});

const percentage = computed<number>((): number => {
	return Number(props.systemModuleSection?.cpuLoad1m.value ?? 0);
});
</script>
