<template>
	<el-card
		shadow="never"
		header-class="px-3! py-3! font-bold"
	>
		<template #header>
			{{ t('statsModule.headings.memory') }}
		</template>

		<div class="flex flex-col gap-2">
			<div class="font-bold text-2xl">
				<el-tooltip
					v-if="systemModuleSection?.memUsedPct.lastUpdated"
					:content="t('statsModule.texts.updated', { time: formatRelative(systemModuleSection?.memUsedPct.lastUpdated) })"
					placement="top-start"
				>
					<el-icon :size="18">
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

				{{ formatNumber((systemInfo?.memory.used ?? 0) / 1024 / 1024, { maximumFractionDigits: 0 }) }} MB
			</div>

			<div class="color-[var(--el-text-color-secondary)]">
				{{
					t('statsModule.fields.memory.total.title', {
						total: formatNumber((systemInfo?.memory.total ?? 0) / 1024 / 1024, { maximumFractionDigits: 0 }),
						unit: 'MB',
					})
				}}
			</div>

			<el-progress
				:percentage="percentage"
				:stroke-width="10"
				:show-text="false"
				:color="[
					{ color: 'var(--el-color-success)', percentage: 60 },
					{ color: 'var(--el-color-warning)', percentage: 85 },
					{ color: 'var(--el-color-error)', percentage: 100 },
				]"
				class="mt-2"
			/>
		</div>
	</el-card>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';

import { ElCard, ElIcon, ElProgress, ElTooltip } from 'element-plus';

import { Icon } from '@iconify/vue';

import { formatNumber, formatRelative } from '../../../common';
import { STALE_MS } from '../stats.constants';

import type { IStatsMemoryProps } from './stats-memory.types';

defineOptions({
	name: 'StatsMemory',
});

const props = withDefaults(defineProps<IStatsMemoryProps>(), {
	loading: false,
});

const { t } = useI18n();

const isStale = computed<boolean>((): boolean => {
	const lu = props.systemModuleSection?.memUsedPct.lastUpdated ? props.systemModuleSection?.memUsedPct.lastUpdated.getTime() : 0;

	return lu ? Date.now() - lu > STALE_MS : true;
});

const percentage = computed<number>((): number => {
	return Number(props.systemModuleSection?.memUsedPct.value ?? 0);
});
</script>
