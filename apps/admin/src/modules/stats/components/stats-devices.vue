<template>
	<stat-tile
		icon="mdi:devices"
		:label="t('statsModule.headings.devices')"
		:value="devicesModuleSection ? format(devicesModuleSection.onlineNow.value, { maximumFractionDigits: 0 }) : ''"
		:last-updated="devicesModuleSection?.onlineNow.lastUpdated ?? null"
		:stale="isStale"
		:loading="props.loading"
	/>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';

import { useNumberFormat } from '../../../common';
import { STALE_MS } from '../stats.constants';

import StatTile from './stat-tile.vue';
import type { IStatsDevicesProps } from './stats-devices.types';

defineOptions({
	name: 'StatsDevices',
});

const props = withDefaults(defineProps<IStatsDevicesProps>(), {
	loading: false,
});

const { t } = useI18n();
const { format } = useNumberFormat();

const isStale = computed<boolean>((): boolean => {
	const lu = props.devicesModuleSection?.onlineNow.lastUpdated ? props.devicesModuleSection?.onlineNow.lastUpdated.getTime() : 0;

	return lu ? Date.now() - lu > STALE_MS : true;
});
</script>
