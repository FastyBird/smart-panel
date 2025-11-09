<template>
	<div class="flex flex-row items-center">
		<el-tooltip
			v-if="devicesModuleSection?.onlineNow.lastUpdated"
			:content="t('statsModule.texts.updated', { time: formatRelative(devicesModuleSection?.onlineNow.lastUpdated) })"
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
			{{ t('statsModule.headings.devices') }}
		</span>
	</div>

	<div class="text-3xl mt-1 flex flex-row items-center">
		{{ devicesModuleSection?.onlineNow.value ?? 0 }}
	</div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';

import { ElIcon, ElTooltip } from 'element-plus';

import { Icon } from '@iconify/vue';

import { formatRelative } from '../../../common';
import { STALE_MS } from '../stats.constants';

import type { IStatsDevicesProps } from './stats-devices.types';

defineOptions({
	name: 'StatsDevices',
});

const props = withDefaults(defineProps<IStatsDevicesProps>(), {
	loading: false,
});

const { t } = useI18n();

const isStale = computed<boolean>((): boolean => {
	const lu = props.devicesModuleSection?.onlineNow.lastUpdated ? props.devicesModuleSection?.onlineNow.lastUpdated.getTime() : 0;

	return lu ? Date.now() - lu > STALE_MS : true;
});
</script>
