<template>
	<div class="flex flex-row items-center">
		<el-tooltip
			v-if="dashboardModuleSection?.registeredPages.lastUpdated"
			:content="t('statsModule.texts.updated', { time: formatRelative(dashboardModuleSection?.registeredPages.lastUpdated) })"
			placement="top-start"
		>
			<el-icon
				:size="12"
				class="mr-1"
			>
				<icon
					v-if="isStale"
					icon="mdi:warning"
				/>
				<icon
					v-else
					icon="mdi:info-circle-outline"
				/>
			</el-icon>
		</el-tooltip>

		<span class="color-[var(--el-text-color-secondary)]">
			{{ t('statsModule.headings.dashboard') }}
		</span>
	</div>

	<div class="text-3xl mt-1 flex flex-row items-center">
		{{ dashboardModuleSection?.registeredPages.value ?? 0 }}
	</div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';

import { ElIcon, ElTooltip } from 'element-plus';

import { Icon } from '@iconify/vue';

import { formatRelative } from '../../../common';
import { STALE_MS } from '../stats.constants';

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
