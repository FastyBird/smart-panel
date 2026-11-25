<template>
	<stat-tile
		icon="mdi:memory"
		:label="t('statsModule.headings.memory')"
		:value="`${format((systemInfo?.memory.used ?? 0) / 1024 / 1024, { maximumFractionDigits: 0 })} MB`"
		:hint="
			t('statsModule.fields.memory.total.title', {
				total: format((systemInfo?.memory.total ?? 0) / 1024 / 1024, { maximumFractionDigits: 0 }),
				unit: 'MB',
			})
		"
		:last-updated="systemModuleSection?.memUsedPct.lastUpdated ?? null"
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
import type { IStatsMemoryProps } from './stats-memory.types';

defineOptions({
	name: 'StatsMemory',
});

const props = withDefaults(defineProps<IStatsMemoryProps>(), {
	loading: false,
});

const { t } = useI18n();
const { format } = useNumberFormat();

const isStale = computed<boolean>((): boolean => {
	const lu = props.systemModuleSection?.memUsedPct.lastUpdated ? props.systemModuleSection?.memUsedPct.lastUpdated.getTime() : 0;

	return lu ? Date.now() - lu > STALE_MS : true;
});

const percentage = computed<number>((): number => {
	return Number(props.systemModuleSection?.memUsedPct.value ?? 0);
});
</script>
