<template>
	<stat-tile
		icon="mdi:swap-vertical"
		:label="t('statsModule.headings.devicesCommunication')"
		:value="format(devicesModuleSection?.updatesToday.value ?? 0, { maximumFractionDigits: 0 })"
		:last-updated="devicesModuleSection?.updatesToday.lastUpdated ?? null"
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
import type { IStatsDevicesCommunicationProps } from './stats-devices-communication.types';

defineOptions({
	name: 'StatsDevicesCommunication',
});

const props = withDefaults(defineProps<IStatsDevicesCommunicationProps>(), {
	loading: false,
});

const { t } = useI18n();
const { format } = useNumberFormat();

const isStale = computed<boolean>((): boolean => {
	const lu = props.devicesModuleSection?.updatesToday.lastUpdated ? props.devicesModuleSection?.updatesToday.lastUpdated.getTime() : 0;

	return lu ? Date.now() - lu > STALE_MS : true;
});
</script>
