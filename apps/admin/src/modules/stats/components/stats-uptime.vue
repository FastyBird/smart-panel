<template>
	<stat-tile
		icon="mdi:timer-outline"
		:label="t('statsModule.headings.uptime')"
		:value="systemModuleSection ? fmtUptime(systemModuleSection.systemUptimeSec.value) : ''"
		:hint="t('statsModule.fields.uptime.process.title', { uptime: fmtUptime(systemModuleSection?.processUptimeSec.value) })"
		:last-updated="systemModuleSection?.systemUptimeSec.lastUpdated ?? null"
		:stale="isStale"
		:loading="props.loading"
	/>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';

import { STALE_MS } from '../stats.constants';

import StatTile from './stat-tile.vue';
import type { IStatsUptimeProps } from './stats-uptime.types';

defineOptions({
	name: 'StatsUptime',
});

const props = withDefaults(defineProps<IStatsUptimeProps>(), {
	loading: false,
});

const { t } = useI18n();

const fmtUptime = (s?: number | null): string => {
	if (s == null) {
		return '—';
	}

	const sec = Math.max(0, Math.floor(s));
	const d = Math.floor(sec / 86400);

	const h = Math.floor((sec % 86400) / 3600)
		.toString()
		.padStart(2, '0');

	const m = Math.floor((sec % 3600) / 60)
		.toString()
		.padStart(2, '0');

	const ss = Math.floor(sec % 60)
		.toString()
		.padStart(2, '0');

	return d ? `${d}d ${h}:${m}:${ss}` : `${h}:${m}:${ss}`;
};

const isStale = computed<boolean>((): boolean => {
	const lu = props.systemModuleSection?.systemUptimeSec.lastUpdated ? props.systemModuleSection?.systemUptimeSec.lastUpdated.getTime() : 0;

	return lu ? Date.now() - lu > STALE_MS : true;
});
</script>
