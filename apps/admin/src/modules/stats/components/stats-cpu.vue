<template>
	<el-card
		shadow="never"
		header-class="px-3! py-3! font-bold"
	>
		<template #header>
			{{ t('statsModule.headings.cpu') }}
		</template>

		<div class="flex flex-col gap-2">
			<div class="font-bold text-2xl">
				<el-tooltip
					v-if="systemModuleSection?.cpuLoad1m.lastUpdated"
					:content="t('statsModule.texts.updated', { time: formatRelative(systemModuleSection?.cpuLoad1m.lastUpdated) })"
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

				{{ formatPercent(systemModuleSection?.cpuLoad1m.value) }}
			</div>

			<div class="color-[var(--el-text-color-secondary)]">
				{{
					t('statsModule.fields.cpu.temperature.title', {
						temperature: systemInfo?.temperature.cpu ?? t('application.value.notAvailable'),
						unit: '°C',
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

import { formatPercent, formatRelative } from '../../../common';
import { STALE_MS } from '../stats.constants';

import type { IStatsCpuProps } from './stats-cpu.types';

defineOptions({
	name: 'StatsCpu',
});

const props = withDefaults(defineProps<IStatsCpuProps>(), {
	loading: false,
});

const { t } = useI18n();

const isStale = computed<boolean>((): boolean => {
	const lu = props.systemModuleSection?.cpuLoad1m.lastUpdated ? props.systemModuleSection?.cpuLoad1m.lastUpdated.getTime() : 0;

	return lu ? Date.now() - lu > STALE_MS : true;
});

const percentage = computed<number>((): number => {
	return Number(props.systemModuleSection?.cpuLoad1m.value ?? 0);
});
</script>
