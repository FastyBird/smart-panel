<template>
	<stat-tile
		icon="mdi:view-dashboard-outline"
		:label="t('statsModule.headings.dashboard')"
		:value="dashboardModuleSection ? String(dashboardModuleSection.registeredPages.value) : ''"
		:last-updated="dashboardModuleSection?.registeredPages.lastUpdated ?? null"
		:stale="isStale"
		:loading="props.loading"
	/>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';

import { STALE_MS } from '../stats.constants';

import StatTile from './stat-tile.vue';
import type { IStatsDashboardProps } from './stats-dashboard.types';

defineOptions({
	name: 'StatsDashboard',
});

const props = withDefaults(defineProps<IStatsDashboardProps>(), {
	loading: false,
});

const { t } = useI18n();

const isStale = computed<boolean>((): boolean => {
	const lu = props.dashboardModuleSection?.registeredPages.lastUpdated ? props.dashboardModuleSection?.registeredPages.lastUpdated.getTime() : 0;

	return lu ? Date.now() - lu > STALE_MS : true;
});
</script>
