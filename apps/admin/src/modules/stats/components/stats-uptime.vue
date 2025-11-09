<template>
	<el-card
		shadow="never"
		header-class="px-3! py-3! font-bold"
	>
		<template #header>
			{{ t('statsModule.headings.uptime') }}
		</template>

		<div class="flex flex-col gap-2">
			<div class="font-bold text-2xl">
				<el-tooltip
					v-if="systemModuleSection?.systemUptimeSec.lastUpdated"
					:content="t('statsModule.texts.updated', { time: formatRelative(systemModuleSection?.systemUptimeSec.lastUpdated) })"
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

				{{ fmtUptime(systemModuleSection?.systemUptimeSec.value) }}
			</div>

			<div class="color-[var(--el-text-color-secondary)]">
				{{
					t('statsModule.fields.uptime.process.title', {
						uptime: fmtUptime(systemModuleSection?.processUptimeSec.value),
					})
				}}
			</div>
		</div>
	</el-card>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';

import { ElCard, ElIcon, ElTooltip } from 'element-plus';

import { Icon } from '@iconify/vue';

import { formatRelative } from '../../../common';
import { STALE_MS } from '../stats.constants';

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
